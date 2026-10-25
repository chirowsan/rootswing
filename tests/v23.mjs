// ROOTSWING v2.3 tests: adaptive audio graph, settings persistence, quality tiers, perf budget, layout overflow at
// 640x360 / 915x412 / 360x640, v2.2 save migration (+ damaged-save fallback), presentation hooks, no page errors.
// Usage: node tests/v23.mjs
import { serve, launch, sleep } from '../tools/lib.mjs';
const results = []; const ok = (name, pass, info = '') => { results.push({ name, pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name} ${typeof info === 'string' ? info : JSON.stringify(info)}`); };
const { server, url } = await serve(); const allErr = [];
async function open(w, h, pre) { const L = await launch({ w, h, dpr: 1 }); if (pre) await L.page.evaluateOnNewDocument(pre); await L.page.goto(url); await sleep(900); allErr.push(L.errors); return L; }
let { browser, page } = await open(915, 412, () => { if (!sessionStorage.getItem('v23')) { localStorage.clear(); sessionStorage.setItem('v23', '1'); } });
const E = (fn, ...a) => page.evaluate(fn, ...a);

// ---------- 1. audio graph: buses, director picks songs/ambience, stingers duck, mute ----------
{ const r = await E(async () => { const A = __RS.AU, S = __RS.save; S.progress.tutorialDone = true; A.initAudio(); await new Promise((r) => setTimeout(r, 300)); const g0 = A.graph();
    __RS.start('hub'); await new Promise((r) => setTimeout(r, 600)); const hub = A.graph();
    __RS.start('run', { chapter: 2, seed: 5 }); __RS.god(true); await new Promise((r) => setTimeout(r, 900)); const ch2 = A.graph();
    const d0 = A.graph().duckN; A.stinger('mission'); await new Promise((r) => setTimeout(r, 120)); const st = A.graph();
    return { g0, hub, ch2, d0, st }; }).catch((e) => ({ err: String(e) }));
  ok('audio: context + all mix buses exist', !!r.g0 && ['master', 'mus', 'duck', 'tens', 'sting', 'amb', 'sfx'].every((k) => typeof r.g0[k] === 'number'), r.g0);
  ok('audio: director picks hub song + hub ambience', r.hub && r.hub.song === 'hub' && r.hub.ambName === 'hub', r.hub && [r.hub.song, r.hub.ambName]);
  ok('audio: chapter 2 gets its own theme + ambience', r.ch2 && r.ch2.song === 'ch2' && r.ch2.ambName === 'ch2', r.ch2 && [r.ch2.song, r.ch2.ambName]);
  ok('audio: stinger plays and ducks the music', r.st && r.st.lastSting === 'mission' && r.st.duckN > r.d0, r.st && [r.st.lastSting, r.d0, r.st.duckN]); }
{ const m = await E(async () => { __RS.UI.showSettings('title'); const btn = document.querySelector('[data-v="mute:true"]'); btn.click(); await new Promise((r) => setTimeout(r, 400)); return { mute: __RS.save.settings.mute, master: __RS.AU.graph().master }; });
  ok('audio: Muted is a real boolean and silences the master', m.mute === true && m.master < 0.02, m);
  await E(() => document.querySelector('[data-v="mute:false"]').click()); }

// ---------- 2. settings persist across a reload (booleans stay booleans) ----------
{ await E(() => { for (const v of ['bigText:true', 'flash:reduced', 'quality:med', 'breakMin:20']) document.querySelector(`[data-v="${v}"]`).click(); const r = document.querySelector('[data-k="amb"]'); r.value = '0.3'; r.dispatchEvent(new Event('input', { bubbles: true })); r.dispatchEvent(new Event('change', { bubbles: true })); __RS.writeSave(); });
  await page.reload(); await sleep(900);
  const s = await E(() => ({ ...__RS.save.settings, cls: document.documentElement.className }));
  ok('settings: survive reload with the right types', s.bigText === true && s.flash === 'reduced' && s.quality === 'med' && s.breakMin === 20 && s.mute === false, { bigText: s.bigText, flash: s.flash, q: s.quality, br: s.breakMin, mute: s.mute });
  ok('settings: Forest sounds slider saved', Math.abs(s.amb - 0.3) < 0.01, s.amb);
  ok('settings: Bigger text + Gentle flashes apply to the page', /big-text/.test(s.cls) && /gentle/.test(s.cls), s.cls);
  await E(() => { Object.assign(__RS.save.settings, { bigText: false, flash: 'normal', quality: 'auto', breakMin: 0, amb: 0.6 }); __RS.writeSave(); __RS.UI.applyA11y(); }); }

// ---------- 3. quality tiers: resolution cap + particle budget ----------
{ const q = await E(async () => { const out = {}; for (const t of ['high', 'med', 'low']) { __RS.save.settings.quality = t; dispatchEvent(new Event('resize')); await new Promise((r) => setTimeout(r, 80)); __RS.start('run', { chapter: 1, seed: 3 }); await new Promise((r) => setTimeout(r, 150)); out[t] = { dpr: __RS.game.dpr, cap: __RS.W.fx.cap }; } __RS.save.settings.quality = 'auto'; dispatchEvent(new Event('resize')); return out; });
  ok('quality: High > Medium > Low particle budget', q.high.cap > q.med.cap && q.med.cap > q.low.cap, q);
  ok('quality: Low renders at 1x, Medium <= 1.5x', q.low.dpr <= 1 && q.med.dpr <= 1.5, q); }

// ---------- 4. perf budget: simulation cost per 60 Hz step in a busy chapter (CPU only, no raster) ----------
{ const p = await E(() => { __RS.save.settings.difficulty = 'nightmare'; __RS.start('run', { chapter: 4, seed: 9 }); __RS.god(true); __RS.manual(true); __RS.step(120); const t0 = performance.now(); __RS.step(600); const up = (performance.now() - t0) / 600; const t1 = performance.now(); for (let i = 0; i < 30; i++) __RS.renderNow(); const rd = (performance.now() - t1) / 30; __RS.save.settings.difficulty = 'normal'; return { stepMs: +up.toFixed(2), renderMs: +rd.toFixed(2), foes: __RS.W.enemies.length }; });
  ok('perf: update step under 3 ms (budget 16.7 ms/frame)', p.stepMs < 3, p);
  ok('perf: one frame of draw calls under 30 ms even in software raster', p.renderMs < 30, p); }

// ---------- 5. presentation hooks: boss/warden intro card, chapter ribbon, break reminder ----------
{ const c = await E(async () => { __RS.start('run', { chapter: 3, seed: 4 }); __RS.god(true); await new Promise((r) => setTimeout(r, 300)); const W = __RS.W, e = W.enemies[0]; __RS.game.bossBar(null); __RS.game.bossBar(e); const card = W.icard && W.icard.name; __RS.game.bossBar(null);
    __RS.save.settings.breakMin = 1; __RS.game.sess = 1e6; await new Promise((r) => setTimeout(r, 400)); const brk = !!document.querySelector('.breaknote') && __RS.game.paused; __RS.save.settings.breakMin = 0; return { card, banner: W.story && W.story.banner > 0, brk }; });
  ok('polish: chapter ribbon + warden intro card', !!c.card && c.banner, c);
  ok('grown-ups: break reminder pauses with a friendly note', c.brk, c); }
await browser.close();

// ---------- 6. layout: no horizontal overflow, every button reachable at phone sizes ----------
for (const [w, h] of [[640, 360], [915, 412]]) {
  const L = await open(w, h); const P = L.page;
  const bad = await P.evaluate(async () => { const S = __RS.save; S.progress.tutorialDone = true; const out = [];
    const check = (name) => { const vw = innerWidth, vh = innerHeight; document.querySelectorAll('#ui button').forEach((b) => { const r = b.getBoundingClientRect(); if (!r.width) return; const sc = b.closest('.scroll'); const inScroll = sc && sc.scrollHeight > sc.clientHeight;
      if (r.left < -1 || r.right > vw + 1 || (!inScroll && (r.top < -1 || r.bottom > vh + 1))) out.push(name + ':' + (b.textContent || '').trim().slice(0, 14)); if (r.height < 34) out.push(name + ':small:' + (b.textContent || '').trim().slice(0, 14)); });
      document.querySelectorAll('#ui .card, #ui .scroll').forEach((c) => { if (c.scrollWidth > c.clientWidth + 2) out.push(name + ':hscroll'); }); };
    __RS.UI.showTitle(); await new Promise((r) => setTimeout(r, 900)); check('title'); __RS.UI.showSettings('title'); await new Promise((r) => setTimeout(r, 400)); check('settings');
    __RS.UI.showShop && (__RS.UI.showShop(), await new Promise((r) => setTimeout(r, 400)), check('shop'));
    __RS.start('run', { chapter: 1, seed: 2 }); await new Promise((r) => setTimeout(r, 400)); __RS.game.pause(); await new Promise((r) => setTimeout(r, 400)); check('pause'); return out; });
  ok(`layout ${w}x${h}: nothing off-screen, no sideways scroll, buttons >= 34 px`, bad.length === 0, bad.slice(0, 6).join(', ')); await L.browser.close(); }
{ const L = await open(360, 640); const r = await L.page.evaluate(() => ({ rot: getComputedStyle(document.getElementById('rotate')).display, hs: document.documentElement.scrollWidth > innerWidth + 1 })); ok('layout 360x640 portrait: no sideways scroll (rotate hint or fitted UI)', !r.hs, r); await L.browser.close(); }

// ---------- 7. save migration from v2.2 + damaged-save fallback ----------
const KEY = 'rootswing.save.v1';
{ const v22 = { settings: { difficulty: 'hard', music: 0.4, sfx: 0.7, mute: 'true', quality: 'low', shake: 'off', speed: 0.9 }, progress: { glimmers: 321, tutorialDone: true, unlocks: { blade: true, dash: true } }, run: null };
  const L = await launch({ w: 915, h: 412, dpr: 1 }); allErr.push(L.errors);
  await L.page.evaluateOnNewDocument((k, s) => { if (!sessionStorage.getItem('m')) { sessionStorage.setItem('m', '1'); localStorage.clear(); localStorage.setItem(k, s); } }, KEY, JSON.stringify(v22)); await L.page.goto(url); await sleep(900);
  const m = await L.page.evaluate(() => ({ s: __RS.save.settings, p: __RS.save.progress }));
  ok('save: v2.2 progress + settings carried over', m.p.glimmers === 321 && m.p.unlocks.dash && m.s.difficulty === 'hard' && m.s.quality === 'low' && m.s.speed === 0.9, { g: m.p.glimmers, d: m.s.difficulty });
  ok('save: new v2.3 settings get safe defaults, old string booleans fixed', m.s.amb === 0.6 && m.s.flash === 'normal' && m.s.bigText === false && m.s.breakMin === 0 && m.s.mute === true, { amb: m.s.amb, flash: m.s.flash, mute: m.s.mute });
  const fb = await L.page.evaluate((k) => { __RS.writeSave(); const good = localStorage.getItem(k); localStorage.setItem(k + '.bak', good); localStorage.setItem(k, '{broken'); __RS.loadSave(); return __RS.save.progress.glimmers; }, KEY);
  ok('save: a damaged save falls back to the backup copy', fb === 321, fb); await L.browser.close(); }

const errs = allErr.flat(); ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
server.close(); const f = results.filter((r) => !r.pass); console.log(`\n${results.length - f.length}/${results.length} passed`); process.exit(f.length ? 1 : 0);
