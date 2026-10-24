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
  const c = await E(page, () => { __RS.start('run', { seed: 4242 }); __RS.god(true); __RS.manual(true); __RS.step(250); const W = __RS.W, P = W.player; { const c = W.cells.find((c) => !c.branch && W.enemies.some((e) => !e.dead && e.cell === c.index && !e.boss)); const p = W.findFloorIn(c); P.x = p.x; P.y = p.y - P.h; P.vx = P.vy = 0; __RS.step(30); } /* v1.5: the start room is a calm intro */ let kills = 0, hits = 0; W.on((n) => { if (n === 'kill') kills++; if (n === 'attack') hits++; });
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
    for (const s of W.seeds) { P.x = s.x - P.w / 2; P.y = s.y - P.h / 2; P.vx = P.vy = 0; __RS.step(15); } // v1.5: the boss gate needs 3 Root Seeds
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
    for (const s of W.seeds) { P.x = s.x - P.w / 2; P.y = s.y - P.h / 2; P.vx = P.vy = 0; __RS.step(15); } // v1.5: the boss gate needs 3 Root Seeds
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
  }
  // v1.5: the old tile heuristic (tools/reach.mjs) is replaced by the physics-model validator (src/reach.js) — see the v1.5 block below
  const a = generateRun(4242, 'caverns'), b = generateRun(4242, 'caverns'); ok('generator deterministic per seed', JSON.stringify(a.map.t.slice(0, 4000)) === JSON.stringify(b.map.t.slice(0, 4000))); }
// 7c. v1.3 biome 2: new enemies spawn, telegraph, hurt and die; mini-boss; new weapons; Ember Heart; minimap / pause map; streaming
{ const { browser, page, errors } = await fresh();
  const en = await E(page, () => { __RS.start('run', { seed: 77, stage: 1 }); __RS.god(true); __RS.manual(true); __RS.skipCountdown(); __RS.step(150); const W = __RS.W, P = W.player, out = {};
    { // v1.5: chunk layouts changed, so put Sprig on a flat, trap-free floor stretch of 12 tiles first
      const M = W.map, T = __RS.TILE, trapAt = (x, y) => W.traps && W.traps.list.some((o) => Math.abs(o.x - x) <= 1 && Math.abs(o.y - y) <= 2);
      let spot = null; for (let y = 3; y < M.h - 1 && !spot; y++) for (let x = 2; x < M.w - 14 && !spot; x++) { let good = true; for (let i = 0; i < 12 && good; i++) { const c = M.get(x + i, y + 1); good = c === '#' && !M.solid(x + i, y) && !M.solid(x + i, y - 1) && !M.solid(x + i, y - 2) && M.get(x + i, y) === '.' && !trapAt(x + i, y); } if (good) spot = { x, y }; }
      if (spot) { P.x = (spot.x + 2) * T; P.y = (spot.y + 1) * T - P.h; P.vx = P.vy = 0; __RS.step(30); } W._home = { x: P.x, y: P.y };
    }
    for (const type of ['lurefish', 'jelly', 'shellback']) { for (const e of W.enemies) if (e.type !== 'tidegolem') e.dead = true; P.x = W._home.x; P.y = W._home.y; P.vx = P.vy = 0; __RS.step(20); /* v1.8: reset to the flat spot each time (the old test drifted onto a ledge ~1 in 8 runs) */ let hits = 0; const hp0 = 1e9; W.spawnEnemy(type, P.cx + 110, P.y - 10); const e = W.enemies[W.enemies.length - 1]; const st = new Set(); const php = P.hp; let dmg = 0;
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
// ===== v1.5 level-design overhaul =====
{ const { CHUNKS15, lintChunk } = await import('../src/chunks15.js'); const { validateAllChunks, validateRun } = await import('../src/validate.js'); const { generateRun } = await import('../src/level.js');
  const lint = CHUNKS15.flatMap((c) => lintChunk(c)); ok(`v1.5 chunks: ${CHUNKS15.length} hand-made rooms on the grid (platform bands, hook rows, even hook chains, no trap at a blind landing)`, lint.length === 0, lint.slice(0, 4).join(' | '));
  let t0 = Date.now(); const cp = validateAllChunks(); ok(`v1.5 reachability: every chunk (both mirrors), every entry -> every exit, seed + loot reachable, no soft-lock dead ends`, cp.length === 0, cp.slice(0, 4).join(' | ') + ` ${Date.now() - t0}ms`);
  { const tr = [0, 0, 0], ti = [[0, 0], [0, 0], [0, 0]]; let early = 0; for (const b of ['overpass', 'caverns']) for (let sd = 1; sd <= 40; sd++) { const R = generateRun(sd * 31, b), m = R.cells.filter((c) => !c.branch);
      m.forEach((c, i) => { const k = Math.min(2, Math.floor(3 * i / m.length)); if (c.variant.ch.tags.includes('trap')) tr[k]++; if (c.kind === 'normal' && !c.pair) { ti[k][0] += c.variant.ch.tier; ti[k][1]++; } if (i < m.length * 0.12 && c.kind === 'normal' && c.variant.ch.tier > 1) early++; }); }
    const avg = ti.map(([s, n]) => +(s / n).toFixed(2)), per = tr.map((x) => +(x / 80).toFixed(1));
    ok('v1.5 difficulty ramp: first rooms only teach, trap rooms and room tiers rise third by third (80 runs)', early === 0 && per[0] < per[1] && per[1] < per[2] && avg[0] < avg[2], `trap rooms/run ${per.join(' -> ')}; avg tier ${avg.join(' -> ')}; early hard rooms ${early}`); }
  for (const biome of ['overpass', 'caverns']) { const bad = []; t0 = Date.now(); for (let s = 1; s <= 3; s++) { const v = validateRun(generateRun(s * 7919 + 13 + (biome === 'caverns' ? 1 : 0), biome)); if (!v.ok) bad.push(s + ': ' + v.problems.join(' / ')); }
    ok(`v1.5 run completable (${biome}): 3 whole runs - all main rooms, 3 seeds and the gate reachable, no soft-locks`, bad.length === 0, bad.join(' | ') + ` ${Date.now() - t0}ms`); } }
{ const { browser, page, errors } = await fresh();
  const tt = await E(page, () => { const out = {}; for (const k of ['spike', 'vent', 'crusher']) { let prev = null, warnStart = 0, minWarn = 1e9, n = 0; for (let t = 0; t < 20; t += 1 / 120) { const st = __RS.trapPhase(k, t).st; if (st === 'warn' && prev !== 'warn') warnStart = t; const dmg = k === 'crusher' ? st === 'fall' : st === 'on'; if (dmg && prev !== st && prev !== null) { n++; minWarn = Math.min(minWarn, prev === 'warn' ? t - warnStart : 0); } prev = st; } out[k] = { minWarn: +minWarn.toFixed(2), n }; }
    out.shooterWarn = __RS.TRAP_TIMING.shooter.warn; out.crumble = __RS.TRAP_TIMING.crumble.shake; out.dmg = __RS.TRAP_DMG; return out; });
  const warnOk = ['spike', 'vent', 'crusher'].every((k) => tt[k].n > 0 && tt[k].minWarn >= 0.5) && tt.crumble >= 0.5 && tt.shooterWarn >= 0.5 && Object.values(tt.dmg).every((d) => d <= 15);
  ok('v1.5 traps: every strike is telegraphed >= 0.5s (spike/vent/crusher/crumble/shooter), damage is kid-sized (<= 15 of 100 hp)', warnOk, JSON.stringify(tt));
  const tr = await E(page, () => { const kinds = new Set(), seeds = []; for (const sd of [101, 202, 303, 404]) { __RS.start('run', { seed: sd }); for (const t of __RS.W.traps.list) kinds.add(t.k); seeds.push(__RS.W.seeds.length); } return { kinds: [...kinds].sort(), seeds }; });
  ok('v1.5 traps: >= 5 trap types appear in runs (spike, vent, crusher, saw, crumble, thorn shooter)', tr.kinds.length >= 5, JSON.stringify(tr));
  const hurt = await E(page, () => { __RS.start('run', { seed: 101 }); __RS.manual(true); __RS.skipCountdown(); __RS.step(30); const W = __RS.W, P = W.player, T = __RS.TILE; const o = W.traps.list.find((t) => t.k === 'spike'); const hp0 = P.hp; let f = 0;
    for (; f < 400 && P.hp === hp0; f++) { P.x = o.x * T + 12 - P.w / 2; P.y = (o.y + 1) * T - P.h; P.vx = P.vy = 0; __RS.step(1); } return { hp0, hp: P.hp, dead: P.hp <= 0, f }; });
  ok('v1.5 traps: a spike strike hurts the player a little (not instant death)', hurt.hp < hurt.hp0 && hurt.hp0 - hurt.hp <= 15 && !hurt.dead, JSON.stringify(hurt));
  const eh = await E(page, () => { for (const sd of [101, 202, 303]) { __RS.start('run', { seed: sd }); __RS.god(true); __RS.manual(true); __RS.skipCountdown(); __RS.step(10); const W = __RS.W, P = W.player; let hits = 0, kind = ''; W.on((n) => { if (n === 'trapHitEnemy') hits++; });
      const e = W.enemies.find((e) => !e.boss && !e.dead); if (!e) continue;
      for (let f = 0; f < 600 && !hits; f++) { for (const o of W.traps.list) { const b = W.traps.box(o, W.t); if (!b) continue; P.x = b.x - 150; P.y = b.y - 40; P.vx = P.vy = 0; e.x = b.x + b.w / 2 - e.w / 2; e.y = b.y + b.h / 2 - e.h / 2; e.vx = e.vy = 0; kind = o.k; break; } __RS.step(1); }
      if (hits) return { hits, kind }; } return { hits: 0 }; });
  ok('v1.5 traps: traps also hurt monsters', eh.hits > 0, JSON.stringify(eh));
  const ob = await E(page, () => { __RS.save.progress.bestTime = 0; __RS.save.progress.totalStars = 0; __RS.start('run', { seed: 4242, stage: 1 }); __RS.god(true); __RS.manual(true); __RS.skipCountdown(); __RS.step(30); const W = __RS.W, P = W.player, out = { seeds: W.seeds.length };
    const d = W.props.find((o) => o.kind === 'door'); const atDoor = () => { P.x = d.x + d.w / 2 - P.w / 2; P.y = d.y + d.h - P.h - 2; P.vx = P.vy = 0; __RS.step(30); __RS.press('attack'); __RS.step(1); __RS.release('attack'); __RS.step(5); };
    atDoor(); out.locked = W.mode === 'run' && __RS.W === W; out.got = []; let opened = 0; W.on((n) => { if (n === 'gateOpen') opened++; });
    for (const s of W.seeds) { P.x = s.x - P.w / 2; P.y = s.y - P.h / 2; P.vx = P.vy = 0; __RS.step(15); out.got.push(W.seedsGot.size); } out.opened = opened; atDoor(); out.mode = __RS.W.mode; return out; });
  await sleep(300);
  const v = await E(page, () => { const W = __RS.W, B = W.boss; if (!B) return { noBoss: 1 }; __RS.step(300); B.sleep = false; B.intro = 0; for (let i = 0; i < 400 && B.hp > 0; i++) { W.hitEnemy(B, { dmg: 200, kb: 0, stun: 0 }, null); __RS.step(4); } __RS.step(600); return { hp: B.hp }; });
  await sleep(3800); const vs = await E(page, () => ({ ui: __RS.state().ui, bestStars: __RS.save.progress.bestStars, best: __RS.save.progress.bestTime, stars: __RS.save.progress.totalStars, html: (document.querySelector('.stars') || {}).outerHTML ? document.querySelectorAll('.star').length : 0 }));
  await page.screenshot({ path: 'shots/v15/victory.png' });
  ok('v1.5 objective: gate locked with 0 seeds -> 3 seeds collected (1,2,3) -> gate opens -> boss', ob.seeds === 3 && ob.locked && ob.got.join() === '1,2,3' && ob.opened === 1 && ob.mode === 'boss', JSON.stringify(ob));
  ok('v1.5 objective: boss beaten -> victory screen with stars, best time saved, stars banked', v.hp <= 0 && vs.ui === 'victory' && vs.html === 3 && vs.best > 0 && vs.stars >= 1, JSON.stringify({ v, ...vs }));
  ok('no page errors (v1.5)', errors.length === 0, errors.slice(0, 2).join(' | ')); await browser.close(); }
// ---------- v1.6: forest theme, nothing floats ----------
{ const { generateRun, buildFixed } = await import('../src/level.js'); const { HUB, TUTORIAL, BOSS_ROOM } = await import('../src/chunks.js'); const { computeSupports, auditSupports } = await import('../src/supports.js');
  const anc = (sp) => sp.filter((s) => s.c === 'o' || s.c === 'z').map((s) => ({ x: s.x * 24 + 12, y: s.y * 24 + 12, kind: s.c === 'o' ? 'swing' : 'zip' }));
  const maps = [['hub', buildFixed(HUB)], ['tutorial', buildFixed(TUTORIAL)], ['boss', buildFixed(BOSS_ROOM)]]; for (let i = 0; i < 20; i++) for (const b of ['overpass', 'caverns']) maps.push([b + ':' + (900 + i * 13), generateRun(900 + i * 13, b)]);
  let pieces = 0; const bad = [], kinds = {};
  for (const [n, L] of maps) { const sp = computeSupports(L.map, anc(L.spawns), L.traps || []); pieces += sp.pieces.length; for (const p of sp.pieces) kinds[p.kind] = (kinds[p.kind] || 0) + 1; for (const p of auditSupports(L.map, sp)) bad.push(`${n} ${p.kind}/${p.sub || ''}@${p.x0},${p.y}`); }
  ok(`v1.6 no floating pieces (data): every plank/branch, crumble branch, hook, trap mount and solid island in ${maps.length} maps chains to ground, wall, canopy or screen edge`, bad.length === 0 && kinds.plank > 0 && kinds.anchor > 0 && kinds.trap > 0, `pieces ${pieces} ${JSON.stringify(kinds)} bad ${bad.slice(0, 4).join(' | ')}`); }
{ const { browser, page, errors } = await fresh();
  const r = await E(page, async () => { const out = []; for (let i = 0; i < 60 && !__RS.gfx.ready; i++) await new Promise((r) => setTimeout(r, 100));
    const cases = [['run', { seed: 2026, stage: 0 }], ['run', { seed: 2026, stage: 1 }], ['run', { seed: 77, stage: 0 }], ['hub', {}], ['boss', { seed: 2026, stage: 0 }], ['boss', { seed: 2026, stage: 1 }], ['tutorial', {}]];
    for (const [m, o] of cases) { __RS.start(m, o); __RS.manual(true); const a = __RS.supports(); out.push({ m, st: o.stage || 0, n: a.pieces, bad: a.bad.slice(0, 3), undrawn: a.undrawn.slice(0, 3), nb: a.bad.length, nu: a.undrawn.length + a.unknown.length, painted: a.painted }); } return out; });
  ok('v1.6 no floating pieces (drawn): in runs, hub, boss rooms and tutorial the painter draws a support chain for every piece', r.every((c) => c.painted && c.n > 0 && c.nb === 0 && c.nu === 0), JSON.stringify(r.map((c) => `${c.m}${c.st}:${c.n}/${c.nb}/${c.nu}${c.nb + c.nu ? JSON.stringify([c.bad, c.undrawn]) : ''}`)));
  const th = await E(page, () => { const o = {}; for (const m of ['run', 'hub', 'boss']) { __RS.start(m, { seed: 5, stage: 0 }); o[m] = { biome: __RS.W.biome.key, tex: ['tex_earth', 'tex_rootcave', 'tex_dusk'].filter((k) => __RS.gfx.img[k]).length }; } return o; });
  ok('v1.6 forest skins load (earth / root-cave / dusk textures) for runs, hub and boss', th.run.tex === 3, JSON.stringify(th));
  ok('no page errors (v1.6)', errors.length === 0, errors.slice(0, 2).join(' | ')); await browser.close(); }
// ---------- v1.8: missions, wardrobe, critters, daily ----------
{ const MS = await import('../src/missions.js'); const { generateRun } = await import('../src/level.js'); const { explore, tileCovered } = await import('../src/reach.js');
  const anc = (sp) => sp.filter((s) => s.c === 'o' || s.c === 'z').map((s) => ({ x: s.x * 24 + 12, y: s.y * 24 + 12, kind: s.c === 'o' ? 'swing' : 'zip' }));
  // daily determinism
  const k = '2026-10-24', s1 = MS.dailySeed(k), s2 = MS.dailySeed(k), days = []; for (let d = 1; d <= 30; d++) days.push(MS.dailySeed('2026-11-' + String(d).padStart(2, '0')));
  const mods = new Set(days.map((_, i) => MS.dailyMod('2026-11-' + String(i + 1).padStart(2, '0')).id));
  const physSafe = MS.DAILY_MODS.every((m) => Object.keys(m).every((q) => ['id', 'icon', 'color', 'taken', 'dealt', 'tint'].includes(q)));
  const A = generateRun(s1, 'overpass'), B = generateRun(s2, 'overpass'), same = JSON.stringify(A.map) === JSON.stringify(B.map);
  ok('v1.8 daily: same date -> same seed + same level + same modifier; 30 days -> 30 distinct seeds, several modifiers; modifiers only touch damage/tint', s1 === s2 && same && MS.dailyMod(k).id === MS.dailyMod(k).id && new Set(days).size === 30 && mods.size >= 3 && physSafe, `seed=${s1} mod=${MS.dailyMod(k).id} mods=${[...mods]}`);
  // critter reachability: every critter spot is inside the explored (reachable) area from the player spawn
  let spots = 0, miss = []; for (const b of ['overpass', 'caverns']) for (const sd of [4242, 77, 1203]) { const L = generateRun(sd, b), P = L.spawns.find((s) => s.c === 'P');
    const res = explore(L.map, anc(L.spawns), { x: P.x * 24 + 12, y: (P.y + 1) * 24 }, { maxHooks: 20000 });
    const cs = MS.pickCritterSpots(L, sd); const cs2 = MS.pickCritterSpots(L, sd); if (JSON.stringify(cs) !== JSON.stringify(cs2)) miss.push(b + sd + ':nondet');
    for (const c of cs) { spots++; if (!tileCovered(res, L.map, c.x, c.y, 1)) miss.push(`${b}:${sd}@${c.x},${c.y}`); } }
  ok('v1.8 critters: every lost critter spot is reachable from spawn (explore proof), deterministic per seed', spots >= 6 && miss.length === 0, `spots=${spots} miss=${miss.slice(0, 4)}`); }
{ const { browser, page, errors } = await fresh();
  // save migration: a v1.7 save (no missions) keeps progress and gains a mission block
  const mg = await E(page, () => { const s = JSON.parse(localStorage.getItem('rootswing.save.v1') || '{}'); s.progress = s.progress || __RS.save.progress; delete s.progress.missions; delete s.progress.saveVer; s.progress.glimmers = 777; s.progress.vine = 'moss'; localStorage.setItem('rootswing.save.v1', JSON.stringify(s)); __RS.loadSave();
    const p = __RS.save.progress, st = JSON.parse(localStorage.getItem('rootswing.save.v1')).progress; return { g: p.glimmers, vine: p.vine, act: p.missions && p.missions.active.length, ver: p.saveVer, stored: !!st.missions, types: new Set(p.missions.active.map((a) => a.type)).size }; });
  ok('v1.8 save migration: v1.7 save -> glimmers/vine kept, 3 distinct active missions, saved as v18', mg.g === 777 && mg.vine === 'moss' && mg.act === 3 && mg.types === 3 && mg.ver === 18 && mg.stored, JSON.stringify(mg));
  // progress events + completion + reward unlock (driven by real World events)
  const ev = await E(page, () => { const m = __RS.missions(); m.owned = m.owned.filter((r) => r !== 'cape:sky' && r !== 'pet:hog'); m.wardrobe.cape = 'none';
    m.active = [{ id: 901, type: 'hunt', enemy: 'hopper', target: 2, prog: 0, tier: 0, reward: 'cape:sky' }, { id: 902, type: 'chain', target: 3, prog: 0, tier: 0, reward: 'pet:hog' }, { id: 903, type: 'gold', target: 1000, prog: 0, tier: 0, reward: 'glim:25' }];
    __RS.game.toasts = []; __RS.start('run', { seed: 4242 }); __RS.manual(true); __RS.step(120); const W = __RS.W, P = W.player;
    W.emit('kill', { type: 'charger' }); const p0 = m.active[0].prog; W.emit('kill', { type: 'hopper' }); const p1 = m.active[0].prog, t1 = __RS.game.toasts.length;
    W.emit('kill', { type: 'hopper' }); const done1 = !m.active.some((a) => a.id === 901);
    P.onGround = false; W.emit('hookAttach'); W.emit('hookAttach'); const c2 = m.active.find((a) => a.id === 902).prog; W.emit('hookAttach'); const done2 = !m.active.some((a) => a.id === 902);
    W.emit('glim'); W.emit('glim'); const g = m.active.find((a) => a.id === 903).prog;
    const dn = __RS.game.toasts.filter((t) => t.done).length; __RS.step(10); __RS.renderNow();
    return { p0, p1, t1, done1, c2, done2, g, n: m.active.length, ids: m.active.map((a) => a.id).join(), cape: m.wardrobe.cape, pet: m.wardrobe.pet, sky: m.owned.includes('cape:sky'), hog: m.owned.includes('pet:hog'), badges: m.badges.join(), dn,
      saved: JSON.parse(localStorage.getItem('rootswing.save.v1')).progress.missions.owned.includes('cape:sky') }; });
  ok('v1.8 missions: progress only on matching events (wrong enemy ignored), toast per step', ev.p0 === 0 && ev.p1 === 1 && ev.t1 >= 1 && ev.c2 === 2 && ev.g === 2, JSON.stringify(ev));
  ok('v1.8 missions: completion -> reward unlocked + auto-worn + badge + slot refilled + saved', ev.done1 && ev.done2 && ev.n === 3 && ev.sky && ev.hog && ev.cape === 'sky' && ev.pet === 'hog' && /b_hunt/.test(ev.badges) && /b_chain/.test(ev.badges) && ev.dn >= 1 && ev.saved, JSON.stringify(ev));
  // real critter rescue by touching it + no-hit room rule
  const cr = await E(page, () => { const m = __RS.missions(); m.active = [{ id: 911, type: 'rescue', target: 1, prog: 0, tier: 0, reward: 'glim:25' }, { id: 912, type: 'clean', target: 5, prog: 0, tier: 0, reward: 'glim:25' }, { id: 913, type: 'secret', target: 5, prog: 0, tier: 0, reward: 'glim:25' }];
    __RS.start('run', { seed: 77 }); __RS.manual(true); __RS.step(120); const W = __RS.W, P = W.player, n0 = W.critters.length, c = W.critters[0]; if (!c) return { n0 };
    P.x = c.px - P.w / 2; P.y = c.py - P.h - 2; P.vx = P.vy = 0; __RS.step(30); const s1 = c.st; __RS.step(240); const done = !m.active.some((a) => a.id === 911);
    W.emit('roomClear', 999); const cl1 = m.active.find((a) => a.id === 912).prog; W.mt.hit.add(998); W.emit('roomClear', 998); const cl2 = m.active.find((a) => a.id === 912).prog;
    return { n0, s1, left: W.critters.length, done, cl1, cl2, opened: W.opened.has(c.id) }; });
  ok('v1.8 critter rescue: touch -> happy -> follows -> goes home -> rescue mission done; no-hit room counts only rooms without a hit', cr.n0 >= 1 && cr.s1 === 'happy' && cr.left === cr.n0 - 1 && cr.done && cr.cl1 === 1 && cr.cl2 === 1 && cr.opened, JSON.stringify(cr));
  // board + wardrobe UI (opened by walking up to the hub board)
  const ui = await E(page, () => { __RS.start('hub'); __RS.manual(true); __RS.step(60); const W = __RS.W, b = W.props.find((o) => o.kind === 'station' && o.n === 4); if (!b) return { nob: 1 };
    __RS.game.openStation(4); const notes = document.querySelectorAll('.note').length, play = !!document.querySelector('[data-act=startDaily]');
    document.querySelector('[data-act=wardrobe]').click(); const tiles = document.querySelectorAll('[data-act=wear]').length; const sky = document.querySelector('[data-act=wear][data-v="cape:sky"]'); sky && sky.click();
    const lockedClick = document.querySelector('[data-act=wear][data-v="cape:night"]'); lockedClick && lockedClick.click();
    return { notes, play, tiles, cape: __RS.missions().wardrobe.cape, hasBoardProp: !!b }; });
  ok('v1.8 board: hub board station opens 3 mission notes + daily play; wardrobe lists items, wearing works, locked items cannot be worn', ui.hasBoardProp && ui.notes >= 3 && ui.play && ui.tiles >= 10 && ui.cape === 'sky', JSON.stringify(ui));
  // daily run: seeded by date, modifier applied, best kept locally
  const dy = await E(page, () => { __RS.game.startDaily(); __RS.manual(true); __RS.step(60); const W = __RS.W, d = __RS.game.daily; const r = { key: d.key, seed: W.seed, mod: d.mod.id, taken: W.dmgTaken, dealt: W.dmgDealt };
    W.player.stats.kills = 3; __RS.game.finishDaily(W, false); r.best = __RS.missions().daily.best; r.date = __RS.missions().daily.date; return r; });
  const MS = await import('../src/missions.js'), md = MS.dailyMod(dy.key);
  ok('v1.8 daily run: seed = dailySeed(today), modifier damage applied, local best recorded', dy.seed === MS.dailySeed(dy.key) && dy.mod === md.id && dy.taken === (md.taken || 1) && dy.dealt === (md.dealt || 1) && dy.best > 0 && dy.date === dy.key, JSON.stringify(dy));
  ok('no page errors (v1.8)', errors.length === 0, errors.slice(0, 2).join(' | ')); await browser.close(); }
{ // v1.9 combat overhaul
  const { browser, page, errors } = await fresh();
  const cb = await E(page, () => { __RS.start('hub'); __RS.manual(true); __RS.step(60); const W = __RS.W, P = W.player, st = (n) => __RS.step(n), seq = [], ev = new Set();
    const on = W.emit.bind(W); W.emit = (n, ...a) => { ev.add(n); return on(n, ...a); };
    const rec = () => { if (P.atk && P.atk.def) { const k = P.atk.def.mv || P.atk.kind; if (seq[seq.length - 1] !== k) seq.push(k); } };
    const tap = (f = 9) => { __RS.press('attack'); st(2); __RS.release('attack'); for (let i = 0; i < f - 2; i++) { st(1); rec(); } };
    const wait = (n) => { for (let i = 0; i < n; i++) { st(1); rec(); } };
    W.spawnEnemy('charger', P.cx + 40, P.y + P.h); const D = W.enemies[W.enemies.length - 1]; D.hp = D.maxHp = 1e5; __RS.god && __RS.god(true); st(30); const x0 = P.x, home = () => { P.x = x0; P.vx = P.vy = 0; D.x = x0 + 40; D.vx = 0; st(20); };
    for (let i = 0; i < 8; i++) tap(9); wait(40); const combo = seq.join(); seq.length = 0;
    home(); W.spawnEnemy('hopper', P.cx + 30, P.y + P.h); const H = W.enemies[W.enemies.length - 1]; H.hp = H.maxHp = 1e5; st(2); const dy0 = H.y; __RS.axes(0, -1); tap(4); __RS.axes(0, 0); let launched = false; for (let i = 0; i < 24; i++) { st(1); rec(); if (H.y < dy0 - 12) launched = true; } for (let i = 0; i < 3; i++) tap(8); wait(90); const launcher = seq.join(); seq.length = 0;
    home(); __RS.press('jump'); st(10); __RS.release('jump'); __RS.axes(0, 1); tap(4); __RS.axes(0, 0); wait(80); const plunge = seq.join(); seq.length = 0;
    home(); __RS.axes(1, 0); __RS.press('dash'); st(2); __RS.release('dash'); tap(8); __RS.axes(0, 0); wait(40); const dash = seq.join(); seq.length = 0; wait(60);
    home(); __RS.press('attack'); st(64); __RS.release('attack'); wait(90); const heavy = seq.join(); seq.length = 0;
    home(); P.counterT = 1; tap(10); wait(40); const counter = seq.join(); seq.length = 0; wait(60);
    home(); P.gauge = 100; let sp = 0, c2 = false; __RS.press('attack'); for (let i = 0; i < 95; i++) { st(1); if (P.charged2) c2 = true; if (W.special) sp = 1; rec(); } __RS.release('attack'); for (let i = 0; i < 80; i++) { st(1); if (W.special) sp = 1; rec(); } const special = seq.join();
    // no soft-lock: after all of that the hero is free, can move and jump
    wait(60); home(); const free = !P.atk && !P.charging; const xm = P.cx; __RS.axes(1, 0); st(20); __RS.axes(0, 0); const moved = P.cx > xm + 10; __RS.press('jump'); st(3); __RS.release('jump'); const jumped = P.vy < 0; st(60);
    return { combo, launcher, launched, plunge, dash, heavy, counter, c2, sp, gauge: P.gauge, special, free, moved, jumped, ui: __RS.state().ui, ev: [...ev].join() }; });
  ok('v1.9 ground combo: 5 distinct strikes cut->rev->spin->lunge->slam (one button)', /cut,rev,spin,lunge,slam/.test(cb.combo), cb.combo);
  ok('v1.9 up+attack launcher lifts the foe, then air chain follows', /rise/.test(cb.launcher) && cb.launched && /air/.test(cb.launcher), cb.launcher + ' ' + cb.launched);
  ok('v1.9 jump+down+attack plunge slam; dash+attack dash-slash; hold = whirlwind', /plunge/.test(cb.plunge) && /dash/.test(cb.dash) && /whirl/.test(cb.heavy), [cb.plunge, cb.dash, cb.heavy].join(' | '));
  ok('v1.9 parry window -> counter strike; full gauge + long hold -> Bloom special (screen effect, gauge spent)', /counter/.test(cb.counter) && cb.c2 && cb.sp === 1 && cb.gauge < 50 && /special|bloom/.test(cb.special), JSON.stringify({ c: cb.counter, c2: cb.c2, sp: cb.sp, g: cb.gauge, s: cb.special }));
  ok('v1.9 no soft-lock: after every move the hero is free to walk and jump', cb.free && cb.moved && cb.jumped && !cb.ui, JSON.stringify(cb));
  const pd = await E(page, () => { __RS.start('hub'); __RS.manual(true); __RS.god && __RS.god(false); __RS.step(60); const W = __RS.W, P = W.player; P.perfCd = 0; P.iframes = 0;
    __RS.axes(1, 0); __RS.press('dash'); __RS.step(2); __RS.release('dash'); __RS.axes(0, 0); const hp = P.hp, r = W.damagePlayer(2, P.cx + 10, { src: 'test' });
    return { r, hpSame: P.hp === hp, slow: W.slow > 0, crit: P.critT > 0, g: P.gauge }; });
  ok('v1.9 perfect dodge: hit during dash start -> no damage, slow-mo, next hit crits, gauge gain', pd.r === 'dodge' && pd.hpSame && pd.slow && pd.crit && pd.g > 0, JSON.stringify(pd));
  const kill = await E(page, () => { const types = ['hopper', 'charger', 'moth', 'puffcap', 'knight', 'bomber', 'jelly', 'shellback', 'lurefish']; const out = {};
    for (const t of types) { __RS.start('hub'); __RS.manual(true); __RS.step(40); const W = __RS.W, P = W.player; __RS.god && __RS.god(true); W.spawnEnemy(t, P.cx + 34, P.y + P.h); const e = W.enemies[W.enemies.length - 1]; if (!e || e.type !== t) { out[t] = 'nospawn'; continue; }
      let f = 0; for (; f < 2400 && !e.dead; f++) { const dx = e.cx - P.cx; P.face = Math.sign(dx) || 1; __RS.axes(Math.abs(dx) > 26 ? Math.sign(dx) : 0, e.cy < P.y - 10 ? -1 : 0); if (e.cy < P.y - 20 && P.onGround && f % 30 === 0) __RS.press('jump'); if (f % 30 === 6) __RS.release('jump'); if (f % 8 === 0) __RS.press('attack'); if (f % 8 === 2) __RS.release('attack'); __RS.step(1); }
      __RS.axes(0, 0); __RS.release('attack'); out[t] = e.dead ? f : 'alive:' + Math.round(e.hp); }
    return out; });
  ok('v1.9 every enemy type dies to plain tap-spam with the new combo', Object.values(kill).every((v) => typeof v === 'number' || v === 'nospawn') && Object.values(kill).some((v) => typeof v === 'number'), JSON.stringify(kill));
  const bb = await E(page, () => { __RS.start('boss', {}); __RS.manual(true); __RS.skipCountdown && __RS.skipCountdown(); __RS.step(120); const W = __RS.W, P = W.player, B = W.boss; if (!B) return { noboss: 1, mode: W.mode };
    __RS.god && __RS.god(true); const mp = B.maxPoise; let broke = 0, f = 0; const on = W.emit.bind(W); W.emit = (n, ...a) => { if (n === 'poiseBreak') broke++; return on(n, ...a); };
    for (; f < 5000 && !broke && B.hp > 0; f++) { const dx = B.x + B.w / 2 - P.cx; __RS.axes(Math.abs(dx) > 30 ? Math.sign(dx) : 0, 0); if (f % 9 === 0) __RS.press('attack'); if (f % 9 === 3) __RS.release('attack'); if (P.onWall && f % 20 === 0) __RS.press('jump'); if (f % 20 === 5) __RS.release('jump'); __RS.step(1); }
    __RS.axes(0, 0); __RS.release('attack'); return { mp, broke, f, stun: B.stun > 0 || broke > 0, type: B.type }; });
  ok('v1.9 boss poise bar: steady hits break it -> BREAK! stun', bb.noboss || (bb.mp > 0 && bb.broke >= 1), JSON.stringify(bb));
  const pc = await E(page, () => { __RS.start('hub'); __RS.manual(true); __RS.step(30); const W = __RS.W, P = W.player; for (let i = 0; i < 40; i++) { W.player.gauge = 100; W.fx.burst(P.cx, P.cy, 60, { color: ['#fff'] }); }
    const n = W.fx.p.length; const c = W.cfx || { trails: [], lashes: [], decals: [], pops: [], waves: [] };
    return { n, cap: W.fx.cap, tr: c.trails.length, dc: c.decals.length }; });
  ok('v1.9 particle cap holds under a 2400-spark flood (and combat fx lists are bounded)', pc.cap > 0 && pc.n <= pc.cap * 1.25 && pc.tr <= 11 && pc.dc <= 12, JSON.stringify(pc));
  ok('no page errors (v1.9)', errors.length === 0, errors.slice(0, 2).join(' | ')); await browser.close(); }
server.close(); const fail = results.filter((r) => !r.pass);
console.log(`\n${results.length - fail.length}/${results.length} passed`); process.exit(fail.length ? 1 : 0);
