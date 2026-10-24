// ROOTSWING headless test suite (puppeteer + swiftshader). Usage: node tests/run-all.mjs
import { serve, launch, sleep } from '../tools/lib.mjs';
import { enemyStates } from '../tools/enemy-rig.mjs';
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
  await sleep(3200); const tr = await E(page, () => ({ mode: __RS.W.mode, stage: __RS.W.stage, biome: __RS.W.biome.key, saved: __RS.save.run && __RS.save.run.stage, cells: __RS.W.cells.length }));
  ok('Furnace -> biome 2 (Drowned Glowroots) + between-biome checkpoint', tr.mode === 'run' && tr.stage === 1 && tr.biome === 'caverns' && tr.saved === 1 && tr.cells >= 40, JSON.stringify(tr));
  const r2 = await E(page, () => { __RS.god(true); __RS.manual(true); __RS.step(120); const W = __RS.W, P = W.player;
    const path = W.cells.filter((c) => !c.branch); let entered = 0, cps = 0; W.on((n) => { if (n === 'checkpoint') cps++; });
    for (const c of path) { const p = W.findFloorIn(c); P.x = p.x; P.y = p.y - P.h; P.vx = P.vy = 0; __RS.step(20); if (W.curCell === c) entered++; }
    const d = W.props.find((o) => o.kind === 'door'); P.x = d.x + d.w / 2 - P.w / 2; P.y = d.y + d.h - P.h - 2; __RS.step(30); __RS.press('attack'); __RS.step(1); __RS.release('attack'); __RS.step(5);
    return { cells: path.length, entered, cps, mode: __RS.W.mode, stage: __RS.W.stage, boss: __RS.W.boss && __RS.W.boss.type }; });
  ok('biome 2: every main-path cell enterable, checkpoints fire, door -> final boss', r2.entered === r2.cells && r2.cps >= 2 && r2.mode === 'boss' && r2.stage === 1 && r2.boss === 'drowned', JSON.stringify(r2));
  const b2 = await E(page, () => { const W = __RS.W, P = W.player, B = W.boss; const ph = new Set(), seen = new Set(); let f = 0;
    for (; f < 9000 && B.hp > 0; f++) { ph.add(B.phase); seen.add(B.st); const dx = B.x + B.w / 2 - P.cx; __RS.axes(Math.abs(dx) > 30 ? Math.sign(dx) : 0, 0); if (f % 9 === 0) __RS.press('attack'); if (f % 9 === 3) __RS.release('attack'); __RS.step(1); }
    __RS.axes(0, 0); __RS.step(400); return { hp: B.hp, phases: [...ph], frames: f, tide: W.markers.length >= 0 }; });
  ok('final boss (Drowned Bloom): all phases + defeated', b2.hp <= 0 && b2.phases.length >= 3, JSON.stringify(b2));
  await sleep(3200); const vui = await E(page, () => ({ ui: __RS.state().ui, prog: __RS.save.progress }));
  await page.screenshot({ path: 'shots/test-victory.png' }); ok('victory card + permanent progress saved', vui.ui === 'victory' && vui.prog.wins >= 1, JSON.stringify({ ui: vui.ui, glim: vui.prog.glimmers, wins: vui.prog.wins }));
  ok('boss: all phases + defeated', b.hp <= 0 && b.phases.length >= 3, JSON.stringify(b));
  ok('no page errors (run/boss)', errors.length === 0, errors.slice(0, 2).join(' | ')); await browser.close(); }
// 6. save / load / continue
{ const { browser, page, errors } = await fresh();
  await E(page, () => { __RS.save.progress.glimmers = 321; __RS.save.settings.speed = 0.7; __RS.writeSave(); __RS.start('run', { seed: 99 }); __RS.manual(true); __RS.step(120); const W = __RS.W; const n = W.cells.find((c) => !c.branch && c.index > 0 && c.kind === 'normal'); let p = W.findFloorIn(n); W.player.x = p.x; W.player.y = p.y - W.player.h; __RS.step(10); window.__afterNormal = __RS.save.run.cellIndex; const c = W.cells.find((c) => c.kind === 'checkpoint'); p = W.findFloorIn(c); W.player.x = p.x; W.player.y = p.y - W.player.h; __RS.step(10); window.__cp = c.index; localStorage.setItem('__cp', JSON.stringify([c.index, window.__afterNormal])); });
  await page.reload(); await sleep(700);
  const s = await E(page, () => ({ cp: JSON.parse(localStorage.getItem('__cp')), g: __RS.save.progress.glimmers, sp: __RS.save.settings.speed, run: __RS.save.run, cont: !!document.querySelector('[data-act="continueRun"]') }));
  const c = await E(page, () => { __RS.continueRun(); __RS.manual(true); __RS.step(5); return { mode: __RS.W.mode, cell: __RS.W.curCell && __RS.W.curCell.index, seed: __RS.W.seed }; });
  ok('save: progress + settings persist across reload', s.g === 321 && s.sp === 0.7, JSON.stringify({ g: s.g, sp: s.sp }));
  ok('save: normal rooms do not save; checkpoint shrine saves; Continue resumes there', s.cont && s.run && s.cp[1] === 0 && s.run.cellIndex === s.cp[0] && c.mode === 'run' && c.seed === s.run.seed && c.cell === s.run.cellIndex, JSON.stringify({ cp: s.cp, run: s.run && { seed: s.run.seed, cell: s.run.cellIndex }, c }));
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
// 7b. v1.3 long maps: room count, checkpoint spacing and reachability over many seeds (pure generator, both biomes)
{ const { analyze } = await import('../tools/reach.mjs'); const { generateRun } = await import('../src/level.js');
  for (const biome of ['overpass', 'caverns']) { let lo = 1e9, hi = 0, maxGap = 0, bad = 0, n = 0, total = 0;
    for (let sd = 1; sd <= 120; sd++) { const seed = sd * 104729 + (biome === 'caverns' ? 7919 : 0); const r = analyze(seed, biome); n++; total += r.cells; lo = Math.min(lo, r.cells); hi = Math.max(hi, r.cells); if (r.fails.length) bad++;
      const path = r.R.cells.filter((c) => !c.branch); let last = 0; path.forEach((c, i) => { if (c.kind === 'checkpoint' || c.kind === 'exit') { maxGap = Math.max(maxGap, i - last); last = i; } }); }
    ok(`long map (${biome}): 40-60 rooms per biome over ${n} seeds`, lo >= 40 && hi <= 60, `min ${lo} max ${hi} avg ${(total / n).toFixed(1)}`);
    ok(`long map (${biome}): checkpoint every <= 12 rooms`, maxGap <= 12, `largest main-path gap ${maxGap}`);
    ok(`reachability (${biome}): every door/chest/weapon/boss door reachable, ${n} seeds`, bad === 0, `${bad} seeds with problems`); }
  const a = generateRun(4242, 'caverns'), b = generateRun(4242, 'caverns'); ok('generator deterministic per seed', JSON.stringify(a.map.t.slice(0, 4000)) === JSON.stringify(b.map.t.slice(0, 4000))); }
// 7c. v1.3 biome 2: new enemies spawn, telegraph, hurt and die; mini-boss; new weapons; Ember Heart; minimap / pause map; streaming
{ const { browser, page, errors } = await fresh();
  const en = await E(page, () => { __RS.start('run', { seed: 77, stage: 1 }); __RS.god(true); __RS.manual(true); __RS.skipCountdown(); __RS.step(150); const W = __RS.W, P = W.player, out = {};
    for (const type of ['lurefish', 'jelly', 'shellback']) { for (const e of W.enemies) if (e.type !== 'tidegolem') e.dead = true; let hits = 0; const hp0 = 1e9; W.spawnEnemy(type, P.cx + 110, P.y - 10); const e = W.enemies[W.enemies.length - 1]; const st = new Set(); const php = P.hp; let dmg = 0;
      __RS.god(false); P.hp = P.maxHp = 9999; for (let f = 0; f < 600; f++) { st.add(e.st); __RS.step(1); } dmg = 9999 - P.hp; __RS.god(true);
      let f = 0; for (; f < 3000 && !e.dead; f++) { const dx = e.cx - P.cx; P.x += Math.sign(dx) * Math.min(3, Math.max(0, Math.abs(dx) - 26)); P.y = e.y + e.h - P.h; P.vy = 0; if (f % 8 === 0) __RS.press('attack'); if (f % 8 === 3) __RS.release('attack'); __RS.step(1); }
      out[type] = { st: [...st].join('/'), telegraphed: st.has('tele'), hurtPlayer: dmg > 0, killed: e.dead, frames: f }; }
    return { biome: W.biome.key, out }; });
  for (const [t, r] of Object.entries(en.out)) ok(`biome-2 enemy ${t}: telegraphs, hurts, killable`, en.biome === 'caverns' && r.telegraphed && r.hurtPlayer && r.killed, JSON.stringify(r));
  const mb = await E(page, () => { const W = __RS.W, P = W.player; const g = W.enemies.find((e) => e.type === 'tidegolem' && !e.dead); if (!g) return { found: false }; const c = W.cells[g.cell]; const p = W.findFloorIn(c); P.x = p.x; P.y = p.y - P.h; __RS.step(30);
    let f = 0; for (; f < 12000 && g.hp > 0; f++) { const dx = g.cx - P.cx; __RS.axes(Math.abs(dx) > 30 ? Math.sign(dx) : 0, 0); if (f % 9 === 0) __RS.press('attack'); if (f % 9 === 3) __RS.release('attack'); __RS.step(1); } __RS.axes(0, 0); __RS.step(60);
    return { found: true, dead: g.hp <= 0, frames: f, cleared: W.cleared.has(g.cell) }; });
  ok('biome-2 mini-boss Tide Golem: found in run + defeated', mb.found && mb.dead, JSON.stringify(mb));
  const mm = await E(page, () => { const W = __RS.W; const cv = document.createElement('canvas'); cv.width = 300; cv.height = 200; const g = cv.getContext('2d'); __RS.drawMap(g, W, 0, 0, 24, 16, true);
    const info = __RS.mapInfo(W); const cur = W.curCell; const px = g.getImageData(cur.x * 24 + 12, cur.y * 16 + 3, 1, 1).data;
    return { seen: info.filter((i) => i.state === 'seen').length, visited: W.visited.size, boss: info.filter((i) => i.state === 'boss').length, hidden: info.filter((i) => i.state === 'hidden').length, curPx: [...px] }; });
  ok('minimap: explored rooms, current room highlighted, boss door always shown, unexplored hidden', mm.seen === mm.visited && mm.boss === 1 && mm.hidden > 0 && mm.curPx[0] > 200 && mm.curPx[1] > 180, JSON.stringify(mm));
  await E(page, () => { __RS.manual(false); __RS.game.pause(); }); await sleep(400);
  const pm = await E(page, () => { const cv = document.getElementById('pmap'); if (!cv) return { canvas: false }; const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let lit = 0; for (let i = 3; i < d.length; i += 16) if (d[i] > 0) lit++; const r = cv.getBoundingClientRect(); return { canvas: true, lit, w: r.width, h: r.height, bottom: r.bottom, vh: innerHeight, btn: !!document.querySelector('[data-act=resume]') }; });
  await page.screenshot({ path: 'shots/test-pausemap.png' });
  ok('pause map: drawn, fits the screen, Resume available', pm.canvas && pm.lit > 200 && pm.bottom <= pm.vh && pm.btn, JSON.stringify(pm));
  await E(page, () => { document.querySelector('[data-act=resume]').click(); __RS.manual(true); __RS.skipCountdown(); __RS.step(5); });
  const st = await E(page, () => { const W = __RS.W, P = W.player; let maxC = 0; for (const c of W.cells.filter((c) => !c.branch)) { const p = W.findFloorIn(c); P.x = p.x; P.y = p.y - P.h; __RS.step(3); __RS.renderNow && __RS.renderNow(); maxC = Math.max(maxC, W.chunkCache.size); } return { maxC, made: W.chunkMade || 0, evicted: W.chunkEvicted || 0 }; });
  ok('streaming: render chunks are evicted (cache stays bounded on long maps)', st.maxC <= 40 && st.evicted > 0, JSON.stringify(st));
  const wp = await E(page, () => { const W = __RS.W, P = W.player, r = {}; for (const w of ['spear', 'sickle']) { P.weapon = w; P.atk = null; for (const e of W.enemies) e.dead = true; __RS.step(20); W.spawnEnemy('hopper', P.cx + 60 * P.face, P.y + P.h - 2); const d = W.enemies[W.enemies.length - 1]; d.maxHp = d.hp = 5000; const h0 = d.hp; for (let f = 0; f < 120; f++) { d.x = P.cx + 50 * P.face - d.w / 2; d.vx = 0; if (f % 10 === 0) __RS.press('attack'); if (f % 10 === 3) __RS.release('attack'); __RS.step(1); } r[w] = h0 - d.hp; } return r; });
  ok('new weapons Tidespear + Glowsickle deal damage', wp.spear > 0 && wp.sickle > 0, JSON.stringify(wp));
  const rv = await E(page, () => { const W = __RS.W, P = W.player; __RS.god(false); __RS.save.progress.unlocks.revive = true; P.iframes = 0; P.hp = 5; W.damagePlayer(50, P.cx + 10, { name: 'test' }); const a = { hp: P.hp, dead: P.dead }; P.iframes = 0; P.hp = 5; W.damagePlayer(50, P.cx + 10, { name: 'test' }); const b = { dead: P.dead }; delete __RS.save.progress.unlocks.revive; return { a, b }; });
  ok('hub skill Ember Heart: revives once per biome', !rv.a.dead && rv.a.hp > 0 && rv.b.dead, JSON.stringify(rv));
  ok('no page errors (biome 2)', errors.length === 0, errors.slice(0, 3).join(' | ')); await browser.close(); }
// 7d. checkpoint resume inside biome 2
{ const { browser, page, errors } = await fresh();
  await E(page, () => { __RS.start('run', { seed: 555, stage: 1 }); __RS.god(true); __RS.manual(true); __RS.skipCountdown(); __RS.step(60); const W = __RS.W; const cs = W.cells.filter((c) => c.kind === 'checkpoint'); const c = cs[cs.length - 1]; const p = W.findFloorIn(c); W.player.x = p.x; W.player.y = p.y - W.player.h; __RS.step(10); localStorage.setItem('__cp2', c.index); });
  await page.reload(); await sleep(800);
  const r = await E(page, () => { const want = +localStorage.getItem('__cp2'); __RS.continueRun(); const W = __RS.W; return { want, cell: W.curCell && W.curCell.index, stage: W.stage, biome: W.biome.key, mode: W.mode, saved: __RS.save.run && __RS.save.run.stage }; });
  ok('checkpoint resume in biome 2 (stage, biome, room)', r.mode === 'run' && r.stage === 1 && r.biome === 'caverns' && r.cell === r.want && r.saved === 1, JSON.stringify(r));
  ok('no page errors (biome-2 resume)', errors.length === 0, errors.slice(0, 2).join(' | ')); await browser.close(); }
// 8. perf: CPU cost per frame (simulation + draw); swiftshader rasterises on CPU so wall-clock fps is not phone-representative
{ const { browser, page, errors } = await fresh();
  const p = await E(page, () => { __RS.start('run', { seed: 31337 }); __RS.manual(true); __RS.step(200); const W = __RS.W; const cv = document.querySelector('canvas'); const g = cv.getContext('2d'); let up = 0, dr = 0; const N = 300;
    for (let i = 0; i < N; i++) { __RS.axes(i % 200 < 100 ? 1 : -1, 0); let t = performance.now(); __RS.step(1); up += performance.now() - t; }
    __RS.axes(0, 0); return { updMs: up / N, ents: W.enemies.length, parts: W.fx.parts ? W.fx.parts.length : -1 }; });
  await E(page, () => __RS.manual(false)); await sleep(3000);
  const fps = await E(page, () => __RS.state().fps);
  ok('perf: simulation step < 2 ms', p.updMs < 2, `update ${p.updMs.toFixed(3)} ms/step; headless swiftshader fps ${fps.toFixed(1)} (CPU-rasterised, informational)`);
  ok('no page errors (perf)', errors.length === 0, errors.slice(0, 2).join(' | ')); await browser.close(); }
// v1.4 enemy animation: every foe has painted frames, every state animates, frames change while moving, death shatters
{ const { browser, page, errors } = await fresh();
  await page.waitForFunction(() => __RS.gfx.ready && __RS.gfx.en, { timeout: 20000 });
  const names = ['hopper', 'charger', 'moth', 'puffcap', 'knight', 'bomber', 'lurefish', 'jelly', 'shellback', 'dummy', 'tturret', 'warden', 'tidegolem', 'boss', 'boss2'];
  const miss = await E(page, (n) => n.filter((k) => !__RS.gfx.en.f[k + '_base'] && !__RS.gfx.en.f[k + '_walk0']), names);
  ok('enemy anim: painted frames for all 15 foes', miss.length === 0, miss.join(','));
  const r = await enemyStates(page); const bad = [], still = [], few = []; let states = 0;
  for (const [n, v] of Object.entries(r)) { const fr = new Set(Object.values(v.frames).flat()); if (fr.size < 3) few.push(n + ':' + fr.size);
    for (const [st, h] of Object.entries(v.hashes)) { states++; if (new Set(h).size < 2) bad.push(n + '/' + st);
      if (/^move/.test(st) && new Set(v.frames[st]).size < 2 && !['hopper'].includes(n)) still.push(n); }
    if (v.errors.length) bad.push(n + ' ' + v.errors[0]); }
  ok('enemy anim: >1 distinct frame in every state', bad.length === 0, `${states} states; ${bad.join(', ')}`);
  ok('enemy anim: painted frame swaps while moving', still.length === 0, still.join(','));
  ok('enemy anim: >=3 painted poses per foe', few.length === 0, few.join(','));
  ok('no page errors (enemy anim)', errors.length === 0, errors.slice(0, 2).join(' | ')); await browser.close(); }
// v1.4.1 hero locomotion: painted walk + run cycles, distance-driven cadence (planted feet don't slide), shared pivot, alternating feet
{ const { browser, page, errors } = await fresh();
  await page.waitForFunction(() => __RS.gfx.ready && __RS.gfx.hero, { timeout: 20000 });
  const g = await E(page, () => {
    __RS.save.progress.tutorialDone = true; __RS.start('hub'); __RS.manual(true); __RS.step(60);
    const W = __RS.W, P = W.player, M = W.map, T = __RS.TILE, Hf = __RS.gfx.hero.f; let best = null;
    const sol = (x, y) => M.solid(x, y) || M.hazard(x, y);
    for (let ty = 3; ty < M.h - 1; ty++) { let run = 0; for (let tx = 1; tx < M.w - 1; tx++) { const ok = M.solid(tx, ty + 1) && !sol(tx, ty) && !sol(tx, ty - 1) && !sol(tx, ty - 2) && !M.hazard(tx, ty + 1); run = ok ? run + 1 : 0; if (!best || run > best.n) best = { n: run, tx: tx - run + 1, ty }; } }
    const out = {};
    for (const [k, ax] of [['walk', 0.38], ['run', 1]]) {
      P.x = (best.tx + 2) * T; P.y = (best.ty + 1) * T - P.h - 0.5; P.vx = P.vy = 0; P.face = 1; __RS.axes(0, 0); __RS.step(40); __RS.axes(ax, 0); __RS.step(40);
      const names = new Set(), slides = []; let cur = null, near = 0, far = 0, noPv = 0;
      for (let f = 0; f < 240; f++) { __RS.step(1); const p = P.heroPose(W), F = Hf[p.n]; names.add(p.n); if (!F || F.length < 10) { noPv++; if (cur) slides.push(cur.hi - cur.lo); cur = null; continue; }
        const foot = F[8] != null ? 0 : F[9] != null ? 1 : -1; if (foot < 0) { if (cur) slides.push(cur.hi - cur.lo); cur = null; continue; } foot ? far++ : near++;
        const wx = p.X + F[8 + foot] * p.K * p.face;
        if (cur && cur.foot === foot) { cur.lo = Math.min(cur.lo, wx); cur.hi = Math.max(cur.hi, wx); } else { if (cur) slides.push(cur.hi - cur.lo); cur = { foot, lo: wx, hi: wx }; } }
      slides.sort((a, b) => a - b);
      out[k] = { distinct: [...names].filter((n) => n.startsWith(k)).length, near, far, noPv, slideMax: +(slides[slides.length - 1] || 0).toFixed(2), slideP50: +(slides[slides.length >> 1] || 0).toFixed(2), vx: +P.vx.toFixed(0) };
    }
    return out; });
  ok('hero gait: >=8 painted walk frames and >=8 run frames in use', g.walk.distinct >= 8 && g.run.distinct >= 8, JSON.stringify({ walk: g.walk.distinct, run: g.run.distinct }));
  ok('hero gait: feet alternate (both feet plant in walk and run)', g.walk.near > 0 && g.walk.far > 0 && g.run.near > 0 && g.run.far > 0, JSON.stringify(g));
  ok('hero gait: planted foot slides < 1 frame step (walk < 2u, run < 3.5u)', g.walk.slideMax < 2 && g.run.slideMax < 3.5 && g.walk.noPv + g.run.noPv === 0, `walk ${g.walk.slideMax} run ${g.run.slideMax}`);
  ok('no page errors (hero gait)', errors.length === 0, errors.slice(0, 2).join(' | ')); await browser.close(); }
server.close(); const fail = results.filter((r) => !r.pass);
console.log(`\n${results.length - fail.length}/${results.length} passed`); process.exit(fail.length ? 1 : 0);
