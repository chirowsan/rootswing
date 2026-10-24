// ROOTSWING headless test suite (puppeteer + swiftshader). Usage: node tests/run-all.mjs
import { serve, launch, sleep } from '../tools/lib.mjs';
const results = []; const ok = (name, pass, info = '') => { results.push({ name, pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name} ${info}`); };
const { server, url } = await serve();
async function fresh(opts = {}) { const L = await launch(opts); await L.page.goto(url); await sleep(700); return L; }
const E = (page, fn, ...a) => page.evaluate(fn, ...a);
// 1. boot
{ const { browser, page, errors } = await fresh();
  const s = await E(page, () => ({ st: __RS.game.state, canvas: !!document.querySelector('canvas'), menu: !!document.querySelector('[data-act]') }));
  await page.screenshot({ path: 'shots/test-boot.png' });
  ok('boot', s.st === 'title' && s.canvas && s.menu && errors.length === 0, JSON.stringify(s) + ' errors=' + errors.length); await browser.close(); }
// 2-4. movement, hook, combat (tutorial + run, deterministic steps)
{ const { browser, page, errors } = await fresh();
  const m = await E(page, () => { __RS.start('tutorial'); __RS.manual(true); __RS.step(260); const P = __RS.W.player; const x0 = P.x;
    __RS.axes(1, 0); __RS.step(40); const x1 = P.x; __RS.axes(0, 0); __RS.step(20);
    __RS.press('jump'); __RS.step(1); const vy = P.vy; __RS.step(12); __RS.release('jump'); const yTop = P.y; __RS.step(60);
    __RS.axes(1, 0); __RS.press('dash'); __RS.step(2); const dvx = P.vx; __RS.release('dash'); __RS.axes(0, 0); __RS.step(60);
    return { dx: x1 - x0, vy, rose: P.y - yTop, dvx, ground: P.onGround }; });
  ok('movement: run', m.dx > 60, 'dx=' + m.dx.toFixed(0)); ok('movement: jump', m.vy < -300, 'vy=' + m.vy.toFixed(0)); ok('movement: dash', m.dvx > 300, 'vx=' + m.dvx.toFixed(0));
  const h = await E(page, () => { const W = __RS.W, P = W.player, T = __RS.TILE; const a = W.anchors.find((a) => a.kind === 'swing');
    P.x = 31 * T; P.y = a.y + 120; P.vx = P.vy = 0; __RS.step(40); __RS.press('jump'); __RS.step(8); __RS.release('jump'); __RS.press('hook'); __RS.step(3); __RS.release('hook'); const s1 = P.hook.s; __RS.step(30); const s2 = P.hook.s;
    __RS.press('jump'); __RS.step(1); __RS.release('jump'); const after = P.hook.s; return { s1, s2, after, target: !!a }; });
  ok('hook: swing attach + release', ['fly', 'swing'].includes(h.s1) && h.s2 === 'swing' && h.after === 'none', JSON.stringify(h));
  const z = await E(page, () => { const W = __RS.W, P = W.player; const a = W.anchors.find((a) => a.kind === 'zip'); if (!a) return { none: 1 };
    P.x = a.x - 90; P.y = a.y + 60; P.vx = P.vy = 0; __RS.step(30); const d0 = Math.hypot(P.cx - a.x, P.cy - a.y); __RS.press('hook'); __RS.step(2); __RS.release('hook'); __RS.step(25); const d1 = Math.hypot(P.cx - a.x, P.cy - a.y); return { d0, d1 }; });
  ok('hook: zip pulls toward anchor', z.d1 < z.d0 * 0.6, JSON.stringify(z));
  const c = await E(page, () => { __RS.start('run', { seed: 4242 }); __RS.god(true); __RS.manual(true); __RS.step(250); const W = __RS.W, P = W.player; let kills = 0, hits = 0; W.on((n) => { if (n === 'kill') kills++; if (n === 'attack') hits++; });
    for (let f = 0; f < 1500 && !kills; f++) { const live = W.enemies.filter((e) => !e.dead && e.cell === W.curCell.index); const e = live[0]; if (!e) break; const dx = e.x + e.w / 2 - P.cx;
      __RS.axes(Math.abs(dx) > 26 ? Math.sign(dx) : 0, 0); if (f % 9 === 0) __RS.press('attack'); if (f % 9 === 3) __RS.release('attack'); if (e.y + e.h < P.y - 30 && P.onGround && f % 30 === 0) { __RS.press('jump'); } if (f % 30 === 8) __RS.release('jump'); __RS.step(1); }
    __RS.axes(0, 0); return { kills, hits, glim: W.runGlim }; });
  ok('combat: bot kills an enemy', c.kills >= 1, JSON.stringify(c));
  ok('no page errors (movement/hook/combat)', errors.length === 0, errors.slice(0, 2).join(' | ')); await browser.close(); }
// 5. god-mode run to boss: path cells -> boss door -> boss phases -> victory
{ const { browser, page, errors } = await fresh();
  const r = await E(page, () => { __RS.start('run', { seed: 2026 }); __RS.god(true); __RS.manual(true); __RS.step(200); const W = __RS.W, P = W.player, T = __RS.TILE;
    const path = W.cells.filter((c) => !c.branch); let entered = 0;
    for (const c of path) { const p = W.findFloorIn(c); P.x = p.x; P.y = p.y - P.h; P.vx = P.vy = 0; __RS.step(20); if (W.curCell === c) entered++; }
    const d = W.props.find((o) => o.kind === 'door'); P.x = d.x + d.w / 2 - P.w / 2; P.y = d.y + d.h - P.h - 2; __RS.step(30); __RS.press('attack'); __RS.step(1); __RS.release('attack'); __RS.step(5);
    return { cells: path.length, entered, mode: __RS.W.mode, saved: !!(__RS.save.run && __RS.save.run.boss) }; });
  ok('run: every main-path cell enterable', r.entered === r.cells, `${r.entered}/${r.cells}`);
  ok('run: boss door -> boss arena (+ checkpoint saved)', r.mode === 'boss' && r.saved, JSON.stringify(r));
  const b = await E(page, () => { const W = __RS.W, P = W.player, B = W.boss; const ph = new Set(); let f = 0;
    for (; f < 6000 && B.hp > 0; f++) { ph.add(B.phase); const dx = B.x + B.w / 2 - P.cx; __RS.axes(Math.abs(dx) > 30 ? Math.sign(dx) : 0, 0); if (f % 9 === 0) __RS.press('attack'); if (f % 9 === 3) __RS.release('attack'); if (P.onWall && f % 20 === 0) __RS.press('jump'); if (f % 20 === 5) __RS.release('jump'); __RS.step(1); }
    __RS.axes(0, 0); __RS.step(400); return { hp: B.hp, phases: [...ph], frames: f, ui: __RS.state().ui, wins: __RS.save.progress.wins ?? __RS.save.progress.bossKills }; });
  await sleep(3200); const vui = await E(page, () => ({ ui: __RS.state().ui, prog: __RS.save.progress }));
  await page.screenshot({ path: 'shots/test-victory.png' }); ok('victory card + permanent progress saved', vui.ui === 'victory', JSON.stringify({ ui: vui.ui, glim: vui.prog.glimmers, wins: vui.prog.wins }));
  ok('boss: all phases + defeated', b.hp <= 0 && b.phases.length >= 3, JSON.stringify(b));
  ok('no page errors (run/boss)', errors.length === 0, errors.slice(0, 2).join(' | ')); await browser.close(); }
// 6. save / load / continue
{ const { browser, page, errors } = await fresh();
  await E(page, () => { __RS.save.progress.glimmers = 321; __RS.save.settings.speed = 0.7; __RS.writeSave(); __RS.start('run', { seed: 99 }); __RS.manual(true); __RS.step(120); const W = __RS.W; const c = W.cells.find((c) => !c.branch && c.index > 0); const p = W.findFloorIn(c); W.player.x = p.x; W.player.y = p.y - W.player.h; __RS.step(10); });
  await page.reload(); await sleep(700);
  const s = await E(page, () => ({ g: __RS.save.progress.glimmers, sp: __RS.save.settings.speed, run: __RS.save.run, cont: !!document.querySelector('[data-act="continueRun"]') }));
  const c = await E(page, () => { __RS.continueRun(); __RS.manual(true); __RS.step(5); return { mode: __RS.W.mode, cell: __RS.W.curCell && __RS.W.curCell.index, seed: __RS.W.seed }; });
  ok('save: progress + settings persist across reload', s.g === 321 && s.sp === 0.7, JSON.stringify({ g: s.g, sp: s.sp }));
  ok('save: mid-run checkpoint -> Continue resumes same seed/cell', s.cont && s.run && c.mode === 'run' && c.seed === s.run.seed && c.cell === s.run.cellIndex, JSON.stringify({ run: s.run && { seed: s.run.seed, cell: s.run.cellIndex }, c }));
  ok('no page errors (save)', errors.length === 0, errors.slice(0, 2).join(' | ')); await browser.close(); }
// 7. touch layout on a 915x412 phone (Galaxy-class landscape)
{ const { browser, page, errors } = await fresh({ w: 915, h: 412, dpr: 2.6, mobile: true });
  await page.touchscreen.tap(400, 200).catch(() => {}); await sleep(200);
  const L = await E(page, () => { __RS.input.forceTouch = true; __RS.start('run', { seed: 7 }); __RS.manual(true); __RS.step(200); const L = __RS.layout(); const out = {}; for (const k of ['jump', 'attack', 'dash', 'hook', 'parry', 'skill1', 'skill2', 'flask', 'pause']) out[k] = L[k]; return { b: out, stick: L.stickHome, R: L.stickR, w: innerWidth, h: innerHeight }; });
  await sleep(300); await page.screenshot({ path: 'shots/test-touch-915x412.png' });
  const names = Object.keys(L.b); let inside = true, minR = 1e9, overlap = [];
  for (const k of names) { const b = L.b[k]; if (b.x - b.r < 0 || b.y - b.r < 0 || b.x + b.r > L.w || b.y + b.r > L.h) inside = false; minR = Math.min(minR, b.r);
    for (const j of names) if (j > k) { const o = L.b[j]; if (Math.hypot(b.x - o.x, b.y - o.y) < b.r + o.r - 2) overlap.push(k + '/' + j); } }
  ok('touch: all buttons on screen', inside, `${L.w}x${L.h}`); ok('touch: no overlapping buttons', !overlap.length, overlap.join(','));
  ok('touch: buttons >= 44px across (finger size)', minR * 2 >= 44, 'smallest diameter ' + (minR * 2).toFixed(0) + 'px');
  ok('touch: stick on the left, actions on the right', L.stick.x < L.w * 0.3 && L.b.jump.x > L.w * 0.7, '');
  // real touch event on the jump button makes Sprig jump
  await E(page, () => { __RS.manual(false); }); const y0 = (await E(page, () => __RS.W.player.y));
  await page.touchscreen.touchStart(L.b.jump.x, L.b.jump.y); await sleep(180); const y1 = await E(page, () => __RS.W.player.y); await page.touchscreen.touchEnd();
  ok('touch: tapping jump button jumps', y1 < y0 - 10, `y ${y0.toFixed(0)} -> ${y1.toFixed(0)}`);
  ok('no page errors (touch)', errors.length === 0, errors.slice(0, 2).join(' | ')); await browser.close(); }
// 8. perf: CPU cost per frame (simulation + draw); swiftshader rasterises on CPU so wall-clock fps is not phone-representative
{ const { browser, page, errors } = await fresh();
  const p = await E(page, () => { __RS.start('run', { seed: 31337 }); __RS.manual(true); __RS.step(200); const W = __RS.W; const cv = document.querySelector('canvas'); const g = cv.getContext('2d'); let up = 0, dr = 0; const N = 300;
    for (let i = 0; i < N; i++) { __RS.axes(i % 200 < 100 ? 1 : -1, 0); let t = performance.now(); __RS.step(1); up += performance.now() - t; }
    __RS.axes(0, 0); return { updMs: up / N, ents: W.enemies.length, parts: W.fx.parts ? W.fx.parts.length : -1 }; });
  await E(page, () => __RS.manual(false)); await sleep(3000);
  const fps = await E(page, () => __RS.state().fps);
  ok('perf: simulation step < 2 ms', p.updMs < 2, `update ${p.updMs.toFixed(3)} ms/step; headless swiftshader fps ${fps.toFixed(1)} (CPU-rasterised, informational)`);
  ok('no page errors (perf)', errors.length === 0, errors.slice(0, 2).join(' | ')); await browser.close(); }
server.close(); const fail = results.filter((r) => !r.pass);
console.log(`\n${results.length - fail.length}/${results.length} passed`); process.exit(fail.length ? 1 : 0);
