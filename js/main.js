(() => {
  'use strict';

  /* ---------------------------------------------------------
     Settings you may want to change
     --------------------------------------------------------- */
  const CONFIG = {
    email: 'filip.dyduch@gmail.com',   // where the brief goes
    // Optional. URL of your own server function that talks to a language model.
    // It receives {lang, answers} as JSON and returns {summary, followup}.
    // Left empty, the bot runs on its built-in script and nothing leaves the browser.
    llmEndpoint: '',
    // Optional. URL that accepts the finished brief as JSON. Left empty, the brief opens in the visitor's mail app.
    sendEndpoint: ''
  };

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const wait = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
  var lang = 'pl';

  /* =========================================================
     Field: a halftone tide. Dots grow from nothing to solid, the
     edge between them rolls like a wave, one contour of dots
     carries the accent. The pointer sends ripples through it.
     ========================================================= */
  let ACCENT = '#3d2fe6';
  let heroP = 0;

  class Field {
    constructor(canvas) {
      this.c = canvas;
      this.ctx = canvas.getContext('2d');
      this.up = canvas.dataset.wave === 'up';
      this.hero = !!canvas.closest('.hero');
      this.seed = Math.random() * 100;
      this.p = { x: -999, y: -999, tx: -999, ty: -999, s: 0, ts: 0 };
      this.visible = false;
      this.born = null;
      this.resize();
      new ResizeObserver(() => { this.resize(); this.draw(this.t || 0); }).observe(canvas);
      new IntersectionObserver(([e]) => { this.visible = e.isIntersecting; }, { rootMargin: '10%' }).observe(canvas);
      const host = canvas.closest('.hero') || canvas;
      host.addEventListener('pointermove', e => {
        const r = canvas.getBoundingClientRect();
        this.p.tx = e.clientX - r.left; this.p.ty = e.clientY - r.top; this.p.ts = 1;
        if (this.p.s < 0.01) { this.p.x = this.p.tx; this.p.y = this.p.ty; }
      });
      host.addEventListener('pointerleave', () => { this.p.ts = 0; });
      this.draw(0);
    }
    resize() {
      const r = this.c.getBoundingClientRect();
      this.dpr = Math.min(devicePixelRatio || 1, 2);
      this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
      this.c.width = Math.round(this.w * this.dpr); this.c.height = Math.round(this.h * this.dpr);
      const cs = getComputedStyle(this.c);
      this.lead = parseFloat(cs.getPropertyValue('--lead')) || 0.1;
      this.tail = parseFloat(cs.getPropertyValue('--tail')) || 0;
      if (this.hero) {
        const nm = document.querySelector('.hero__name'), intro = document.querySelector('.hero__intro');
        // the solid band is only as tall as the intro that sits on it
        if (intro) this.tail = (this.h - intro.offsetTop + Math.min(40, this.h * 0.04)) / this.h;
        // the field sits as high as it can: at the crest of its swing the top dots just touch the letters
        if (nm) {
          const fs = parseFloat(getComputedStyle(nm).fontSize);
          const touch = nm.offsetTop + nm.offsetHeight * 0.95 - fs * 0.1;
          const reach = 0.243;                                  // crest height as a share of the field's span
          this.lead = (touch / this.h + reach * (1 - this.tail)) / (1 + reach);
        }
        this.lead = Math.min(this.lead, 0.7);
        this.tail = Math.max(0.02, Math.min(this.tail, 1 - this.lead - 0.14));
      }
    }
    draw(time) {
      this.t = time;
      const { ctx, w, h, dpr, p, lead, tail } = this;
      const t = time / 1000 + this.seed;
      if (this.born === null && time > 0) this.born = time;
      const age = reduce || !this.hero ? 1 : Math.min(1, (time - (this.born || time)) / 2400);
      const grow = 1 - Math.pow(1 - age, 3);
      p.x += (p.tx - p.x) * 0.12; p.y += (p.ty - p.y) * 0.12; p.s += (p.ts - p.s) * 0.05;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (this.up) { ctx.translate(0, h); ctx.scale(1, -1); }
      const py = this.up ? h - p.y : p.y;

      const s = Math.max(15, Math.min(34, w / 46));        // grid pitch
      const rowH = s * 0.866, rMax = s * 0.74;
      const span = 1 - lead - tail;
      const y0 = h * lead, yEnd = h * (1 - tail);
      const k = (Math.PI * 2) / w;
      const cyc = Math.max(0.45, Math.min(1, w / 1250));
      const swing = 0.2 * (1 + (this.hero ? heroP * 0.6 : 0));
      const rad = Math.max(160, Math.min(w, h) * 0.4);
      const black = new Path2D(), mark = new Path2D();
      const rows = Math.ceil((yEnd - y0) / rowH) + 5;

      for (let j = -4; j < rows; j++) {
        const y = y0 + j * rowH;
        if (y > yEnd + s) break;
        const off = (j & 1) * s * 0.5;
        for (let x = -s + off; x < w + s; x += s) {
          // where this dot sits between "nothing" (0) and "solid" (1); the boundary itself rolls
          const tide = Math.sin(x * k * 1.25 * cyc + t * 0.42 + 1.3 * Math.sin(x * k * 0.7 * cyc - t * 0.23))
                     + 0.35 * Math.sin(x * k * 3.1 * cyc - t * 0.6 + 2);
          let u = (y - y0) / (h * span * (this.hero ? 0.9 : 0.8)) + swing * tide * grow;
          if (u <= 0.02) continue;
          const uc = Math.min(1.2, u);
          let r = rMax * Math.pow(uc, 1.2) * (0.25 + 0.75 * grow);
          // a slow diagonal swell through the mid-tones
          r *= 1 + 0.3 * Math.sin((x * 0.9 + y * 1.8) * k * 2.2 - t * 0.9) * Math.sin(Math.PI * Math.min(1, uc));
          if (p.s > 0.004) {
            const d = Math.hypot(x - p.x, y - py);
            const fall = Math.exp(-(d * d) / (rad * rad)) * p.s;
            r *= 1 + 0.75 * fall * Math.sin(d * 0.05 - t * 5);
            r += fall * s * 0.16;
          }
          if (r < 0.5) continue;
          if (r > rMax) r = rMax;
          const path = (u > 0.4 && u < 0.52) ? mark : black;
          path.moveTo(x + r, y);
          path.arc(x, y, r, 0, 6.2832);
        }
      }
      ctx.fillStyle = '#000';
      ctx.fill(black);
      if (tail > 0) ctx.fillRect(0, yEnd - 1, w, h - yEnd + 2);
      ctx.fillStyle = ACCENT;
      ctx.fill(mark);
    }
  }
  const fields = $$('canvas[data-wave]').map(c => new Field(c));

  /* Row dividers: flat at rest, a wave while the row has attention. */
  const lines = $$('.row').map(row => {
    const svg = row.querySelector('.row__line'), path = svg.querySelector('path');
    const o = { row, svg, path, a: 0, ta: 0, ph: Math.random() * 6, w: 0 };
    const set = v => () => { o.ta = v; };
    row.addEventListener('pointerenter', set(1)); row.addEventListener('pointerleave', set(0));
    row.addEventListener('focus', set(1)); row.addEventListener('blur', set(0));
    return o;
  });
  const drawLine = (o, t) => {
    const w = o.w || (o.w = o.svg.getBoundingClientRect().width);
    if (o.a < 0.004) { o.path.setAttribute('d', `M0 16H${w}`); return; }
    let d = '';
    for (let x = 0; x <= w + 8; x += 8) {
      const edge = Math.sin(Math.PI * Math.min(1, x / w));
      const y = 16 + o.a * 11 * edge * Math.sin(x * 0.018 + o.ph + t * 0.0022) * (0.6 + 0.4 * Math.sin(x * 0.004 - t * 0.0011));
      d += (x ? 'L' : 'M') + x + ' ' + y.toFixed(2);
    }
    o.path.setAttribute('d', d);
  };
  addEventListener('resize', () => { lines.forEach(o => { o.w = 0; o.a = Math.max(o.a, 0.005); }); });
  lines.forEach(o => drawLine(o, 0));

  const frame = time => {
    for (const f of fields) if (f.visible) f.draw(time);
    for (const o of lines) if (o.ta || o.a > 0.004) { o.a += (o.ta - o.a) * 0.08; drawLine(o, time); }
    requestAnimationFrame(frame);
  };
  if (!reduce) requestAnimationFrame(frame);

  /* =========================================================
     Text: word masks, highlighted phrase, language switch
     ========================================================= */
  const splitWords = (el, text) => {
    let i = 0, c = 0, hl = false, html = '';
    const ripple = el.hasAttribute('data-ripple');
    for (let w of text.trim().split(/\s+/)) {
      if (w.startsWith('[[')) { hl = true; w = w.slice(2); }
      const end = w.indexOf(']]');
      const tail = end > -1 ? w.slice(end + 2) : '';
      if (end > -1) w = w.slice(0, end);
      let inner = ripple ? [...w].map(ch => `<span class="rc" style="--c:${c++}">${esc(ch)}</span>`).join('') : esc(w);
      // inside a marked phrase the space belongs to the word before it, so the mark runs unbroken
      const joined = hl && end === -1;
      if (hl) inner = `<b class="hl">${inner}${joined ? ' ' : ''}</b>${esc(tail)}`;
      html += `<span class="w${hl ? ' w--hl' : ''}"><span style="--i:${i++}">${inner}</span></span>` + (joined ? '' : ' ');
      if (end > -1) hl = false;
    }
    el.innerHTML = html.trim();
  };
  const plain = t => t.replace(/\[\[|\]\]/g, '');

  const name = document.querySelector('.hero__name');
  let ci = 0;
  $$('.hero__word', name).forEach(wd => {
    wd.innerHTML = [...wd.textContent].map(ch => `<span class="ch"><span style="--i:${ci++}">${ch}</span></span>`).join('');
  });

  const marq = document.getElementById('marq');
  const MARQ = {
    pl: ['UX', 'UI', 'interaktywny prototyp', 'visual MVP', 'pojedyncza funkcja', 'prezentacja dla klienta'],
    en: ['UX', 'UI', 'interactive prototype', 'visual MVP', 'a single feature', 'a client presentation']
  };
  let marqW = 0, marqX = 0;
  function buildMarquee() {
    const one = MARQ[lang].map(t => `<span>${t}<i></i></span>`).join('');
    marq.innerHTML = one + one + one;
    marqW = marq.scrollWidth / 3;
  }

  const scrubEl = document.querySelector('[data-scrub]');
  function scrub() {
    const ws = $$('.w', scrubEl), r = scrubEl.getBoundingClientRect(), vh = innerHeight;
    const p = reduce ? 1 : Math.max(0, Math.min(1, (vh * 0.82 - r.top) / (r.height + vh * 0.22)));
    const n = Math.round(p * ws.length);
    ws.forEach((w, i) => w.classList.toggle('lit', i < n));
  }

  const i18n = $$('[data-en]');
  i18n.forEach(el => { el.dataset.pl = el.textContent.trim(); });
  const langBtn = document.getElementById('lang');
  const META = {
    pl: { title: 'Filip Dyduch. UX, UI i visual MVP', nav: 'Główna', sw: 'Switch to English', btn: 'EN', accent: 'Zmień kolor akcentu' },
    en: { title: 'Filip Dyduch. UX, UI and visual MVPs', nav: 'Main', sw: 'Przełącz na polski', btn: 'PL', accent: 'Change the accent colour' }
  };
  const setLang = l => {
    lang = l;
    document.documentElement.lang = l;
    i18n.forEach(el => {
      if (el.hasAttribute('data-split')) splitWords(el, el.dataset[l]);
      else el.textContent = plain(el.dataset[l]);
    });
    document.title = META[l].title;
    document.querySelector('.top__nav').setAttribute('aria-label', META[l].nav);
    langBtn.textContent = META[l].btn;
    langBtn.setAttribute('aria-label', META[l].sw);
    document.getElementById('accent').setAttribute('aria-label', META[l].accent);
    try { localStorage.setItem('lang', l); } catch (e) {}
    buildMarquee();
    scrub();
    bot.render(true);
  };
  langBtn.addEventListener('click', () => setLang(lang === 'pl' ? 'en' : 'pl'));

  /* Live prototype: keep the 800x480 screen at native pixels, scaled */
  const proto = document.getElementById('proto');
  if (proto) {
    const fr = proto.querySelector('iframe');
    const fit = () => { fr.style.transform = `scale(${proto.clientWidth / 800})`; };
    new ResizeObserver(fit).observe(proto);
    fit();
  }

  /* =========================================================
     Brief bot: a short conversation that fills in a brief and
     ends in the contact form. Runs on a built-in script; when
     CONFIG.llmEndpoint is set, the free-text answer is sent
     there to be summarised and to get one follow-up question.
     ========================================================= */
  const T = {
    pl: {
      steps: [
        { key: 'scope', label: 'Zakres', q: 'Co ma powstać?', opts: ['Visual MVP', 'Interaktywny prototyp', 'Pojedyncza funkcja', 'UX i UI', 'Jeszcze nie wiem'],
          re: ['Dobrze. Cały produkt do przeklikania.', 'Jasne. Prototyp, który działa.', 'Jedna funkcja, zrobiona do końca.', 'Projekt od przepływów po interfejs.', 'Nie szkodzi. Ustalimy to razem.'] },
        { key: 'audience', label: 'Odbiorca', q: 'Komu to pokażecie?', opts: ['Klientowi', 'Inwestorowi', 'Użytkownikom w testach', 'Developerom'],
          re: ['Czyli musi wyglądać jak gotowy produkt.', 'Czyli liczy się pierwsze wrażenie.', 'Czyli najważniejsze ścieżki muszą działać naprawdę.', 'Czyli stany i przypadki brzegowe na wierzchu.'] },
        { key: 'deadline', label: 'Termin', q: 'Na kiedy?', opts: ['Jak najszybciej', 'W dwa tygodnie', 'W miesiąc', 'Bez sztywnego terminu'],
          re: ['Wtedy zaczynamy od najważniejszej ścieżki.', 'Do zrobienia, jeśli zakres jest jasny.', 'Jest czas, żeby dopracować szczegóły.', 'To ustalimy rytm, który Wam pasuje.'] },
        { key: 'about', label: 'Opis', type: 'text', q: 'Opisz w dwóch zdaniach, o co chodzi.', ph: 'Np. aplikacja do rezerwacji sal, potrzebujemy ścieżki od wyszukania do płatności.' },
        { key: 'ds', label: 'Design system', q: 'Macie własny design system?', opts: ['Tak', 'Częściowo', 'Nie'],
          re: ['Świetnie, pracuję na Waszych komponentach.', 'Wezmę to, co jest, resztę dorobię w tym samym duchu.', 'W porządku, zbuduję spójne podstawy.'] },
        { key: 'contact', label: 'Kontakt', type: 'contact', q: 'Brief gotowy. Do kogo mam się odezwać?' }
      ],
      next: 'Dalej', skip: 'Pomiń', back: 'Wstecz', of: 'z', name: 'Imię i nazwisko', mail: 'E‑mail', send: 'Wyślij brief', copy: 'Skopiuj brief', copied: 'Skopiowane',
      empty: 'czeka na odpowiedź', followLabel: 'Doprecyzowanie', thinking: 'Układam to w brief',
      errName: 'Wpisz imię, żebym wiedział, do kogo piszę.', errMail: 'Ten adres wygląda na niepełny. Sprawdź, czy ma @ i domenę.',
      noteLocal: 'Nic nie jest wysyłane, dopóki nie klikniesz „Wyślij brief”.', noteLlm: 'Opis trafia do modelu językowego, który układa go w brief.',
      doneMail: 'Otworzyłem Twój program pocztowy z gotowym briefem. Wystarczy kliknąć „Wyślij”.', doneSent: 'Brief wysłany. Odezwę się.',
      doneFail: 'Nie udało się wysłać. Otwieram brief w Twoim programie pocztowym.', again: 'Zacznij od nowa',
      subject: 'Brief ze strony', briefTitle: 'Brief'
    },
    en: {
      steps: [
        { key: 'scope', label: 'Scope', q: 'What needs to exist?', opts: ['A visual MVP', 'An interactive prototype', 'A single feature', 'UX and UI', 'Not sure yet'],
          re: ['Good. A whole product to click through.', 'Right. A prototype that works.', 'One feature, taken all the way.', 'Design from flows to interface.', 'That’s fine. We’ll work it out together.'] },
        { key: 'audience', label: 'Audience', q: 'Who will you show it to?', opts: ['A client', 'An investor', 'Users, in testing', 'Developers'],
          re: ['So it has to look like a finished product.', 'So the first impression is what counts.', 'So the key paths have to really work.', 'So states and edge cases go up front.'] },
        { key: 'deadline', label: 'Deadline', q: 'By when?', opts: ['As soon as possible', 'In two weeks', 'In a month', 'No hard deadline'],
          re: ['Then we start with the most important path.', 'Doable, if the scope is clear.', 'There’s time to polish the details.', 'Then we’ll find a rhythm that suits you.'] },
        { key: 'about', label: 'About', type: 'text', q: 'Describe it in two sentences.', ph: 'E.g. a room booking app, we need the path from search to payment.' },
        { key: 'ds', label: 'Design system', q: 'Do you have your own design system?', opts: ['Yes', 'Partly', 'No'],
          re: ['Great, I’ll work with your components.', 'I’ll use what exists and extend it in the same spirit.', 'Fine, I’ll build a consistent foundation.'] },
        { key: 'contact', label: 'Contact', type: 'contact', q: 'The brief is ready. Who should I get back to?' }
      ],
      next: 'Next', skip: 'Skip', back: 'Back', of: 'of', name: 'Your name', mail: 'Email', send: 'Send the brief', copy: 'Copy the brief', copied: 'Copied',
      empty: 'waiting for an answer', followLabel: 'Follow-up', thinking: 'Turning that into a brief',
      errName: 'Add your name so I know who I’m writing to.', errMail: 'That address looks incomplete. Check it has an @ and a domain.',
      noteLocal: 'Nothing is sent until you press “Send the brief”.', noteLlm: 'Your description goes to a language model that turns it into a brief.',
      doneMail: 'I’ve opened your mail app with the finished brief. Just press “Send”.', doneSent: 'Brief sent. I’ll be in touch.',
      doneFail: 'Sending failed. Opening the brief in your mail app instead.', again: 'Start over',
      subject: 'Brief from the website', briefTitle: 'Brief'
    }
  };

  const bot = (() => {
    const elQ = document.getElementById('bot-q'), elA = document.getElementById('bot-a'), elBack = document.getElementById('bot-back');
    const elStep = document.getElementById('bot-step'), elBrief = document.getElementById('brief'), form = document.getElementById('bot');
    const st = { i: 0, ans: {}, summary: '', follow: null, followAns: '', done: null, run: 0, hint: '' };

    const value = step => {
      const a = st.ans[step.key];
      if (step.type === 'text') return st.summary || a || '';
      if (step.type === 'contact') return a ? `${a.name}, ${a.mail}` : '';
      return a === undefined ? '' : step.opts[a];
    };
    const briefRows = D => {
      const rows = D.steps.map(s => [s.label, value(s)]);
      if (st.follow) rows.splice(4, 0, [D.followLabel, st.followAns]);
      return rows;
    };
    const drawBrief = fresh => {
      const D = T[lang];
      document.getElementById('brief-h').textContent = D.briefTitle;
      elBrief.innerHTML = briefRows(D).map(([l, v]) => `<dt>${esc(l)}</dt><dd class="${v ? (fresh === l ? 'new' : '') : 'empty'}">${esc(v || D.empty)}</dd>`).join('');
    };
    const briefText = D => briefRows(D).map(([l, v]) => `${l}: ${v || '-'}`).join('\n') + (st.summary && st.ans.about ? `\n\n"${st.ans.about}"` : '');

    const say = async (text, hint) => {
      const id = ++st.run;
      elQ.innerHTML = hint ? `<span class="hint">${esc(hint)}</span>` : '';
      const out = document.createElement('span');
      elQ.append(out);
      for (const w of text.split(' ')) {
        out.textContent += (out.textContent ? ' ' : '') + w;
        await wait(42);
        if (id !== st.run) return false;
      }
      return true;
    };
    const show = async () => { for (const n of [...elA.children]) { n.classList.add('on'); await wait(60); } };

    async function render(instant) {
      const D = T[lang], steps = D.steps;
      drawBrief();
      elA.innerHTML = '';
      elBack.textContent = D.back;
      if (st.done) return finish(st.done);
      const step = st.i === 'follow' ? { type: 'follow', q: st.follow } : steps[st.i];
      const idx = st.i === 'follow' ? 4 : st.i + (st.follow && st.i > 3 ? 1 : 0);
      const total = steps.length + (st.follow ? 1 : 0);
      elStep.textContent = `${idx + 1} ${D.of} ${total}`;
      elBack.hidden = idx === 0;
      const hint = !instant && st.hint ? st.hint : '';
      st.hint = '';
      if (!(await say(step.q, hint))) return;

      if (step.type === 'text' || step.type === 'follow') {
        const cur = step.type === 'follow' ? st.followAns : (st.ans.about || '');
        elA.innerHTML = `<div class="field"><label for="bot-t" class="sr">${esc(step.q)}</label><textarea id="bot-t" rows="3" placeholder="${esc(step.ph || '')}">${esc(cur)}</textarea></div>
          <button class="bot__go" type="submit">${D.next}<i class="fa-light fa-arrow-right" aria-hidden="true"></i></button>
          <button class="bot__skip" type="button" data-skip>${D.skip}</button>
          <p class="bot__note">${CONFIG.llmEndpoint ? D.noteLlm : D.noteLocal}</p>`;
      } else if (step.type === 'contact') {
        const a = st.ans.contact || { name: '', mail: '' };
        elA.innerHTML = `<div class="field"><label for="bot-n">${D.name}</label><input id="bot-n" name="name" autocomplete="name" value="${esc(a.name)}"></div>
          <div class="field"><label for="bot-m">${D.mail}</label><input id="bot-m" name="email" type="email" autocomplete="email" inputmode="email" value="${esc(a.mail)}"></div>
          <p class="field__err" id="bot-err" role="alert"></p>
          <button class="bot__go" type="submit">${D.send}<i class="fa-light fa-arrow-right" aria-hidden="true"></i></button>
          <p class="bot__note">${D.noteLocal}</p>`;
      } else {
        elA.innerHTML = step.opts.map((o, n) => `<button class="chip" type="button" data-n="${n}" aria-pressed="${st.ans[step.key] === n}">${esc(o)}</button>`).join('');
      }
      show();
    }

    async function advance(step, val) {
      const D = T[lang];
      if (step.type === 'follow') { st.followAns = val; st.i = 4; drawBrief(D.followLabel); return render(); }
      st.ans[step.key] = val;
      if (step.re && typeof val === 'number') st.hint = step.re[val];
      if (step.type === 'text') {
        st.summary = ''; st.follow = null; st.followAns = '';
        if (val && CONFIG.llmEndpoint) {
          elA.innerHTML = '';
          await say(D.thinking + '…');
          try {
            const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), 9000);
            const res = await fetch(CONFIG.llmEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang, answers: st.ans }), signal: ctl.signal });
            clearTimeout(to);
            const data = await res.json();
            if (data && typeof data.summary === 'string') st.summary = data.summary.slice(0, 400);
            if (data && typeof data.followup === 'string' && data.followup.trim()) st.follow = data.followup.slice(0, 200);
          } catch (e) { /* the built-in script carries on */ }
        }
        drawBrief(step.label);
        st.i = st.follow ? 'follow' : 4;
        return render();
      }
      drawBrief(step.label);
      st.i += 1;
      render();
    }

    function finish(kind) {
      const D = T[lang];
      st.done = kind;
      elStep.textContent = '';
      elBack.hidden = true;
      say(kind === 'sent' ? D.doneSent : kind === 'fail' ? D.doneFail : D.doneMail).then(ok => {
        if (!ok) return;
        elA.innerHTML = `<button class="bot__go" type="button" data-copy>${D.copy}</button><button class="bot__skip" type="button" data-again>${D.again}</button>`;
        show();
      });
    }

    form.addEventListener('click', e => {
      const D = T[lang];
      const chip = e.target.closest('.chip');
      if (chip) {
        $$('.chip', elA).forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
        return void setTimeout(() => advance(D.steps[st.i], +chip.dataset.n), reduce ? 0 : 260);
      }
      if (e.target.closest('[data-skip]')) return void advance(st.i === 'follow' ? { type: 'follow' } : D.steps[3], '');
      if (e.target.closest('[data-again]')) { Object.assign(st, { i: 0, ans: {}, summary: '', follow: null, followAns: '', done: null, hint: '' }); return void render(); }
      const cp = e.target.closest('[data-copy]');
      if (cp && navigator.clipboard) navigator.clipboard.writeText(briefText(D)).then(() => { cp.textContent = D.copied; });
    });
    elBack.addEventListener('click', () => {
      if (st.i === 'follow') st.i = 3;
      else if (st.i === 4 && st.follow) st.i = 'follow';
      else if (st.i > 0) st.i -= 1;
      render(true);
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const D = T[lang];
      const ta = document.getElementById('bot-t');
      if (ta) return advance(st.i === 'follow' ? { type: 'follow' } : D.steps[3], ta.value.trim().slice(0, 600));
      const n = document.getElementById('bot-n'), m = document.getElementById('bot-m'), err = document.getElementById('bot-err');
      if (!n) return;
      const nameV = n.value.trim(), mailV = m.value.trim();
      if (!nameV) { err.textContent = D.errName; n.setAttribute('aria-invalid', 'true'); return n.focus(); }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(mailV)) { err.textContent = D.errMail; m.setAttribute('aria-invalid', 'true'); return m.focus(); }
      st.ans.contact = { name: nameV, mail: mailV };
      drawBrief(D.steps[5].label);
      const body = briefText(D);
      const mailto = () => { location.href = `mailto:${CONFIG.email}?subject=${encodeURIComponent(D.subject + ': ' + nameV)}&body=${encodeURIComponent(body)}`; };
      if (CONFIG.sendEndpoint) {
        try {
          const res = await fetch(CONFIG.sendEndpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lang, answers: st.ans, brief: body }) });
          if (!res.ok) throw new Error(res.status);
          return finish('sent');
        } catch (e2) { finish('fail'); return mailto(); }
      }
      finish('mail');
      mailto();
    });
    form.addEventListener('keydown', e => {
      if (e.key === 'Enter' && e.target.tagName === 'TEXTAREA' && (e.metaKey || e.ctrlKey)) form.requestSubmit();
    });
    return { render };
  })();

  /* =========================================================
     Sign-in gate. A mock: the check runs in the browser and only
     hides the page, it does not protect anything.
     ========================================================= */
  const gate = document.getElementById('gate'), gateForm = document.getElementById('gate-form');
  const GATE_HASH = '14301d897aa65d9b2e71b8ab6e85cd9cf7eec34d39638b8a02a38c69b930cc35';
  const GATE_T = { pl: { empty: 'Wpisz login i hasło.', wrong: 'Nieprawidłowy login lub hasło.' }, en: { empty: 'Enter your login and password.', wrong: 'Wrong login or password.' } };
  const mainEl = document.getElementById('main'), topEl = document.querySelector('.top');
  const locked = () => document.documentElement.classList.contains('locked');
  const setInert = v => { [mainEl, topEl, document.querySelector('.skip')].forEach(el => { if (el) el.inert = v; }); };
  setInert(locked());
  if (locked()) requestAnimationFrame(() => document.getElementById('gate-u').focus());
  const sha = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))].map(b => b.toString(16).padStart(2, '0')).join('');
  gateForm.addEventListener('submit', async e => {
    e.preventDefault();
    const u = document.getElementById('gate-u'), p = document.getElementById('gate-p'), err = document.getElementById('gate-err');
    const fail = msg => {
      err.textContent = msg;
      gate.classList.remove('is-wrong'); void gate.offsetWidth; gate.classList.add('is-wrong');
      (u.value.trim() ? p : u).focus();
    };
    if (!u.value.trim() || !p.value) return fail(GATE_T[lang].empty);
    let ok = false;
    try { ok = (await sha(u.value.trim() + ':' + p.value)) === GATE_HASH; } catch (e2) { ok = false; }
    if (!ok) { p.value = ''; return fail(GATE_T[lang].wrong); }
    try { sessionStorage.setItem('gate', 'open'); } catch (e3) {}
    gate.classList.add('is-leaving');
    document.documentElement.classList.remove('locked');
    setInert(false);
    scrollTo(0, 0);
    setTimeout(() => { gate.classList.remove('is-leaving'); }, reduce ? 0 : 950);
  });

  /* =========================================================
     Boot, accent, scroll-driven motion
     ========================================================= */
  let saved = null;
  try { saved = localStorage.getItem('lang'); } catch (e) {}
  setLang(saved === 'en' ? 'en' : 'pl');

  const io = new IntersectionObserver(es => {
    es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
  $$('[data-split],[data-reveal],[data-clip],[data-wipe]').forEach(el => io.observe(el));
  requestAnimationFrame(() => requestAnimationFrame(() => name.classList.add('is-ready')));

  /* Accent: blue-violet by default; the small square in the footer (or the C key) cycles it */
  const ACCENTS = ['violet', 'yellow', 'green'];
  const root = document.documentElement;
  const readAccent = () => { ACCENT = getComputedStyle(root).getPropertyValue('--accent').trim() || ACCENT; fields.forEach(f => f.draw(f.t || 0)); };
  const cycleAccent = () => {
    const next = ACCENTS[(ACCENTS.indexOf(root.dataset.accent || 'violet') + 1) % ACCENTS.length];
    if (next === 'violet') delete root.dataset.accent; else root.dataset.accent = next;
    try { next === 'violet' ? localStorage.removeItem('accent2') : localStorage.setItem('accent2', next); } catch (e) {}
    readAccent();
  };
  document.getElementById('accent').addEventListener('click', cycleAccent);
  addEventListener('keydown', e => {
    if ((e.key === 'c' || e.key === 'C') && !e.metaKey && !e.ctrlKey && !e.altKey && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) cycleAccent();
  });
  readAccent();
  const topBar = document.querySelector('.top');
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY, vh = innerHeight, past = y > 40;
    heroP = Math.max(0, Math.min(1, y / vh));
    if (!reduce && y < vh * 1.2) name.style.transform = `translate3d(0,${(-y * 0.22).toFixed(1)}px,0)`;
    topBar.classList.toggle('is-bar', past);
    if (!past) topBar.classList.remove('is-hidden');
    else if (Math.abs(y - lastY) > 6) topBar.classList.toggle('is-hidden', y > lastY);
    lastY = y;
    scrub();
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  if (!reduce) {
    let vel = 0, prevY = scrollY, dir = -1;
    const tick = () => {
      const y = scrollY, d = y - prevY; prevY = y;
      vel += (d - vel) * 0.12;
      if (Math.abs(d) > 0.5) dir = d > 0 ? -1 : 1;
      marqX += dir * (1.1 + Math.abs(vel) * 0.55);
      if (marqW) { if (marqX <= -marqW) marqX += marqW; if (marqX > 0) marqX -= marqW; }
      const skew = Math.max(-9, Math.min(9, vel * 0.35));
      marq.style.transform = `translate3d(${marqX.toFixed(1)}px,0,0) skewX(${(-skew).toFixed(2)}deg)`;
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* Pointer follower */
  const cur = document.querySelector('.cursor');
  if (cur && matchMedia('(hover:hover) and (pointer:fine)').matches && !reduce) {
    let cx = 0, cy = 0, tx = 0, ty = 0;
    addEventListener('pointermove', e => {
      tx = e.clientX; ty = e.clientY;
      cur.classList.add('on');
      cur.classList.toggle('big', !!e.target.closest('a,button,.row'));
    });
    document.addEventListener('pointerleave', () => cur.classList.remove('on'));
    $$('iframe').forEach(f => f.addEventListener('pointerenter', () => cur.classList.remove('on')));
    const follow = () => { cx += (tx - cx) * 0.2; cy += (ty - cy) * 0.2; cur.style.transform = `translate3d(${cx.toFixed(1)}px,${cy.toFixed(1)}px,0)`; requestAnimationFrame(follow); };
    requestAnimationFrame(follow);
  }
})();
