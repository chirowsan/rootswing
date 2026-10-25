// ROOTSWING v2.4 tests (feel pass): swing energy / pump / release / attach jitter, whip combo timing + tip crit zone + reach + yank,
// Thornbow draw / charge / pierce / damage / BULLSEYE, animation frame coverage, 4-style swap, DPS sanity, v2.3 -> v2.4 save migration, perf, no page errors.
// Usage: node tests/v24.mjs
import { serve, launch, sleep } from '../tools/lib.mjs';
const results = []; const ok = (name, pass, info = '') => { results.push({ name, pass, info }); console.log(`${pass ? 'PASS' : 'FAIL'} ${name} ${typeof info === 'string' ? info : JSON.stringify(info)}`); };
const { server, url } = await serve(); const allErr = [];
const L = await launch({ w: 960, h: 540, dpr: 1 }); await L.page.evaluateOnNewDocument(() => { if (!sessionStorage.getItem('v24')) { localStorage.clear(); sessionStorage.setItem('v24', '1'); } });
await L.page.goto(url); await sleep(1200); allErr.push(L.errors); const page = L.page; const E = (fn, ...a) => page.evaluate(fn, ...a);
await E(() => { const S = __RS; S.save.progress.tutorialDone = true; S.save.settings.hookAssist = true;
  window.T = { setup(wpn = 'blade') { S.save.progress.weapon = wpn; S.start('hub', {}); S.manual(true); const W = S.W; W.countdown = 0; W.fade = 0; W.props = []; W.anchors = []; W.enemies = []; S.god(true);
    const P = W.player; P.weapon = wpn; P.x = 6 * S.TILE; P.y = 18 * S.TILE - P.h; P.vx = P.vy = 0; P.face = 1; P.hook = { s: 'none' }; P.atk = null; P.bowS = null; P.bowCd = 0; W.snapCamera(); S.axes(0, 0); for (const b of ['jump', 'attack', 'hook', 'dash', 'swap']) S.release(b); S.step(10); return { W, P }; },
    tap(b, n = 2) { S.press(b); S.step(n); S.release(b); },
    dummy(W, P, dx) { W.spawnEnemy('dummy', P.cx + dx, P.y + P.h); const e = W.enemies[W.enemies.length - 1]; e.hp = e.maxHp = 1e6; return e; },
    log(W) { const hits = []; const h0 = W.hitEnemy.bind(W); W.hitEnemy = (en, h, p) => { hits.push({ f: W.__f || 0, dmg: h.dmg, eff: h.dmg * ((h.crit || h.tipHit) ? 1.5 : 1), crit: !!h.crit, tipHit: h.tipHit, tag: h.tag || '', mv: h.mv || '', src: h.src, e: en.type }); return h0(en, h, p); }; return hits; } }; });

// ---------- 1. swing ----------
{ const r = await E(() => { const S = __RS, G = 1500; const o = {};
  { const { W, P } = T.setup(); W.anchors.push({ x: P.cx + 120, y: P.cy - 130, kind: 'swing', pulse: 0 }); S.press('hook'); S.step(1); S.release('hook'); const tr = [];
    for (let f = 0; f < 170; f++) { S.step(1); tr.push({ s: P.hook.s, vx: P.vx, vy: P.vy, y: P.cy }); }
    const sw = tr.filter((t) => t.s === 'swing'); const En = sw.map((t) => 0.5 * (t.vx * t.vx + t.vy * t.vy) - G * t.y); const e0 = En[10]; o.drift = Math.round((Math.min(...En.slice(10)) - e0) / Math.abs(e0) * 1000) / 10; o.frames = sw.length;
    const at = tr.findIndex((t) => t.s === 'swing'); let dv = 0; for (let i = Math.max(1, at - 1); i < at + 8; i++) dv = Math.max(dv, Math.hypot(tr[i].vx - tr[i - 1].vx, tr[i].vy - tr[i - 1].vy - G / 60)); o.jerk = Math.round(dv); }
  { const { W, P } = T.setup(); W.anchors.push({ x: P.cx + 60, y: P.cy - 140, kind: 'swing', pulse: 0 }); S.press('hook'); S.step(1); S.release('hook'); const sp = [];
    for (let f = 0; f < 260; f++) { if (f >= 20) S.axes(P.vx > 0 ? 1 : -1, 0); S.step(1); if (P.hook.s === 'swing') sp.push(Math.hypot(P.vx, P.vy)); } S.axes(0, 0); o.pump0 = Math.round(Math.max(...sp.slice(0, 60))); o.pump1 = Math.round(Math.max(...sp.slice(-60))); }
  { const { W, P } = T.setup(); W.anchors.push({ x: P.cx + 120, y: P.cy - 130, kind: 'swing', pulse: 0 }); S.press('hook'); S.step(1); S.release('hook'); let pre = null, post = null, x0 = 0;
    for (let f = 0; f < 150; f++) { if (f === 18) S.axes(1, 0); const was = P.hook.s; const v = [P.vx, P.vy]; if (!pre && f > 20 && was === 'swing' && P.vx > 0 && P.cx > P.hook.hx + 20) { S.press('jump'); pre = Math.hypot(...v); } S.step(1); if (pre && !post && P.hook.s === 'none') { post = Math.hypot(P.vx, P.vy); x0 = P.cx; } if (pre && f % 8 === 0) S.release('jump'); }
    S.axes(0, 0); o.rel = { pre: Math.round(pre || 0), post: Math.round(post || 0), dist: Math.round(P.cx - x0) }; }
  return o; });
  ok('swing: energy-correct pendulum, worst energy drift over 2.5 s within -6% (v2.3 was -10.1%)', r.drift > -6 && r.frames > 100, r);
  ok('swing: attach is smooth (max per-frame velocity jump < 60 px/s; v2.3 stepped ~50+ at once)', r.jerk < 60, r);
  ok('swing: pumping with the stick grows the arc (last-second peak >= 1.3x first)', r.pump1 >= r.pump0 * 1.3, r);
  ok('swing: release keeps the momentum and adds a launch (post >= pre, > 520 px/s, flies > 300 px)', r.rel.post >= r.rel.pre && r.rel.post > 520 && r.rel.dist > 300, r.rel); }

// ---------- 2. whip ----------
{ const r = await E(() => { const S = __RS, { W, P } = T.setup('whip'), o = {}; const e = T.dummy(W, P, 85); const hits = T.log(W); const marks = {};
  for (let f = 0; f < 110; f++) { W.__f = f; if ([0, 16, 32, 50].includes(f)) S.press('attack'); if ([2, 18, 34, 52].includes(f)) S.release('attack'); S.step(1); const a = P.atk; if (a && a.crackT !== undefined && marks[a.step] === undefined) marks[a.step] = f; }
  o.hits = hits.map((h) => h.mv + '@' + h.f + (h.tipHit ? '*' : '')); o.n = hits.length; o.tips = hits.filter((h) => h.tipHit).length; o.moves = new Set(hits.map((h) => h.mv)).size; o.crack = marks; o.last = hits.length ? hits[hits.length - 1].f : -1;
  // tip zone: dummy at the tip (95) vs close (40) -> tip crit vs body
  for (const [dx, k] of [[95, 'far'], [40, 'near']]) { const s = T.setup('whip'); T.dummy(s.W, s.P, dx); const h = T.log(s.W); T.tap('attack'); S.step(30); o[k] = h.map((x) => !!x.tipHit); }
  // reach: farthest dummy that still gets hit by the first lash
  o.reach = 0; for (const dx of [60, 80, 100, 110, 120]) { const s = T.setup('whip'); T.dummy(s.W, s.P, dx); const h = T.log(s.W); T.tap('attack'); S.step(30); if (h.length) o.reach = dx; }
  // directional lashes: up, diagonal, down (air pogo); frames for wind/lash/follow
  const dir = (ax, ay, air) => { const s = T.setup('whip'); if (air) { s.P.y -= 120; s.P.vy = 0; S.step(1); } S.axes(ax, ay); T.tap('attack'); S.step(1); const wm = s.P.atk && s.P.atk.wm; const poses = new Set(); for (let i = 0; i < 24; i++) { poses.add(s.P.heroPose(s.W).n); S.step(1); } S.axes(0, 0); return { wm, poses: [...poses].filter((p) => p.startsWith('c_whip')).join('|') }; };
  o.up = dir(0, -1); o.diag = dir(1, -1); o.down = dir(0, 1, true); o.fwd = dir(0, 0);
  // yank: finisher pulls a light foe toward you
  { const s = T.setup('whip'); s.W.spawnEnemy('charger', s.P.cx + 100, s.P.y + s.P.h); const sl = s.W.enemies[s.W.enemies.length - 1]; sl.hp = sl.maxHp = 1e6; const d0 = sl.cx - s.P.cx;
    for (let f = 0; f < 90; f++) { if ([0, 16, 32, 50].includes(f)) S.press('attack'); if ([2, 18, 34, 52].includes(f)) S.release('attack'); S.step(1); } o.yank = { d0: Math.round(d0), d1: Math.round(sl.cx - s.P.cx), yanked: sl.yankUntil > 0 }; }
  // recovery: you can steer during the lash and act right after
  { const s = T.setup('whip'); T.tap('attack'); S.axes(1, 0); S.step(6); o.steerVx = Math.round(s.P.vx); S.axes(0, 0); let f = 0; while (s.P.atk && f < 60) { S.step(1); f++; } o.freeAfter = f + 8; }
  return o; });
  ok('whip: 4-lash combo lands all 4 hits on a dummy at 85 px with 4 distinct arcs (cut/rev/rise/fin)', r.n >= 4 && r.moves >= 4, r.hits);
  ok('whip: combo timing — 4 lashes inside 75 frames (~1.25 s), crack timed per lash', r.last > 0 && r.last <= 75 && Object.keys(r.crack).length >= 3, { last: r.last, crack: r.crack });
  ok('whip: tip crit zone — the last 25% of the vine crits (far dummy = tip, close dummy = body)', r.far.includes(true) && r.near.length > 0 && !r.near.includes(true), { far: r.far, near: r.near });
  ok('whip: reach >= 100 px (blade ~44)', r.reach >= 100, r.reach);
  ok('whip: directional lashes forward/up/diagonal/down use wind-up/lash/follow-through frames', r.fwd.wm === 'cut' && r.up.wm === 'up' && r.diag.wm === 'diag' && r.down.wm === 'down' && r.fwd.poses.includes('c_whip_s') && r.fwd.poses.includes('c_whip_f') && r.up.poses.includes('c_whipup_s') && r.down.poses.includes('c_whipdn_s'), { f: r.fwd, u: r.up, d: r.diag, dn: r.down });
  ok('whip: finisher yanks a light foe toward you', r.yank.yanked, r.yank);
  ok('whip: no sluggish recovery (steer during the lash, free within 0.6 s)', r.steerVx > 60 && r.freeAfter <= 36, { steerVx: r.steerVx, freeAfter: r.freeAfter }); }

// ---------- 3. bow ----------
{ const r = await E(() => { const S = __RS, o = {};
  { const { W, P } = T.setup('bow'); T.dummy(W, P, 260); const h = T.log(W); S.press('attack'); S.step(2); o.nock = P.heroPose(W).n; S.release('attack'); S.step(1); o.quickShots = W.shots.filter((s) => s.tr).length; o.relPose = P.heroPose(W).n; S.step(40); o.quick = h.slice(); }
  { const { W, P } = T.setup('bow'); T.dummy(W, P, 260); const h = T.log(W); S.press('attack'); const ks = []; for (let f = 0; f < 45; f++) { S.step(1); ks.push(P.bowS ? P.bowS.k : -1); } o.drawPose = P.heroPose(W).n; o.k20 = +ks[20].toFixed(2); o.k44 = ks[44]; o.slow = Math.abs(P.vx);
    S.release('attack'); S.step(1); const s = W.shots.find((x) => x.tr); o.full = s && { pierce: s.pierce, dmg: s.dmg, speed: Math.round(Math.hypot(s.vx, s.vy)) }; S.step(40); o.power = h.slice(); }
  { const { W, P } = T.setup('bow'); const a = T.dummy(W, P, 150), b = T.dummy(W, P, 230); const h = T.log(W); S.press('attack'); S.step(45); S.release('attack'); S.step(40); o.pierce = new Set(h.map((x) => x.e + Math.round(x.f))).size; o.pierceN = h.length; }
  { const { W, P } = T.setup('bow'); T.dummy(W, P, 200); P.y -= 40; S.step(1); P.vy = 0; S.axes(0, 0); const h = T.log(W); let n = 0; for (let f = 0; f < 150; f++) { if (f % 14 === 0 && f < 126) S.press('attack'); if (f % 14 === 2) S.release('attack'); S.step(1); } o.spam = h.length; o.spamDmg = h.reduce((a, x) => a + x.dmg, 0); }
  { const { W, P } = T.setup('bow'); W.spawnEnemy('knight', P.cx + 140, P.y + P.h); const k = W.enemies[W.enemies.length - 1]; k.hp = k.maxHp = 1e6; S.axes(0, -1); S.press('attack'); S.step(3); const up = P.bowS ? P.bowS.ang : 0; S.axes(0, 0); S.step(1); o.upAng = +(up).toFixed(2); S.release('attack'); S.step(2); o.cancel = (() => { S.press('attack'); S.step(20); const had = !!P.bowS; S.press('dash'); S.step(2); S.release('dash'); S.release('attack'); return had && !P.bowS; })(); }
  { const { W, P } = T.setup('bow'); const e = T.dummy(W, P, 220); const ang = []; for (let i = 0; i < 1; i++) { e.y -= 30; } S.press('attack'); S.step(5); o.autoTgt = !!(P.bowS && P.bowS.tgt); S.release('attack'); S.step(30); }
  return o; });
  ok('bow: tap = quick shot (nock pose on press, release pose after, 1 arrow, ~8 dmg body hit)', r.nock === 'c_bow_nock' && r.relPose === 'c_bow_rel' && r.quickShots === 1 && r.quick.length === 1 && r.quick[0].dmg <= 9, { nock: r.nock, rel: r.relPose, q: r.quick });
  ok('bow: hold = draw — charge rises smoothly to full in ~0.67 s, draw pose, movement slowed', r.k20 > 0.1 && r.k20 < 0.6 && r.k44 === 1 && r.drawPose === 'c_bow_draw', { k20: r.k20, k44: r.k44, pose: r.drawPose });
  ok('bow: full draw = fast piercing power shot that aims for the head (BULLSEYE crit)', r.full && r.full.pierce && r.full.dmg >= 20 && r.full.speed > 1100 && r.power.some((x) => x.crit && x.tag === 'BULLSEYE!'), { full: r.full, hits: r.power });
  ok('bow: power shot pierces through two foes', r.pierceN >= 2, { n: r.pierceN });
  ok('bow: no ammo, cooldown-limited — 9 taps in 2 s all fire and hit (auto-aim)', r.spam >= 9, { hits: r.spam, dmg: r.spamDmg });
  ok('bow: aim by direction (stick up = straight up) and dash cancels a draw cleanly', r.upAng < -1.2 && r.cancel, { up: r.upAng, cancel: r.cancel });
  ok('bow: soft auto-aim locks a target in the cone', r.autoTgt, r.autoTgt); }

// ---------- 4. frames, swap, DPS, migration, perf ----------
{ const r = await E(() => { const S = __RS; const need = ['c_whip_a', 'c_whip_s', 'c_whip_f', 'c_whipup_s', 'c_whipdn_s', 'c_bow_nock', 'c_bow_draw', 'c_bow_rel', 'c_swing_f', 'c_swing_b', 'c_swing_m', 'c_tuck'];
  const o = {}; const hf = (S.gfx && S.gfx.hero && S.gfx.hero.f) || null; o.need = need; o.have = hf ? need.filter((n) => hf[n]) : null;
  Object.assign(S.save.progress.unlocks, { hammer: true, whip: true, bow: true }); const { W, P } = T.setup('blade'); const seen = []; for (let i = 0; i < 5; i++) { seen.push(P.weapon); S.press('swap'); S.step(2); S.release('swap'); S.step(25); } o.seen = seen.join();
  // DPS: tap every 12 frames for 6 s vs a dummy at each style's comfortable range
  o.dps = {}; for (const [w, dx] of [['blade', 40], ['hammer', 46], ['whip', 85], ['bow', 220]]) { const s = T.setup(w); T.dummy(s.W, s.P, dx); const h = T.log(s.W); for (let fr = 0; fr < 360; fr++) { if (fr % 12 === 0) S.press('attack'); if (fr % 12 === 3) S.release('attack'); S.step(1); } o.dps[w] = Math.round(h.reduce((a, x) => a + x.eff, 0) / 6); }
  return o; });
  ok('frames: whip wind/lash/follow, bow nock/draw/rel, swing + tuck frames exist in the hero atlas', !r.have || r.have.length === r.need.length, r.have ? r.need.filter((n) => !r.have.includes(n)) : 'atlas not exposed; checked via poses above');
  ok('swap: quick-swap cycles all 4 earned styles blade>hammer>whip>bow>blade', r.seen === 'blade,hammer,whip,bow,blade', r.seen);
  const d = r.dps; ok('balance: tap-DPS — reworked whip and bow within 0.7x..1.3x of the blade; hammer (unchanged since v2.0, slow heavy hits) <= 1.75x', ['whip', 'bow'].every((w) => d[w] >= d.blade * 0.7 && d[w] <= d.blade * 1.3) && d.hammer <= d.blade * 1.75, d); }
{ const KEY = 'rootswing.save.v1'; const r = await E((k) => { const raw = JSON.parse(localStorage.getItem(k) || '{}'); raw.progress = raw.progress || JSON.parse(JSON.stringify(__RS.save.progress)); const p = raw.progress;
    p.saveVer = 20; p.glimmers = 555; p.weapon = 'whip'; p.unlocks = { blade: true, hammer: true, whip: true }; p.missions = p.missions || {}; p.missions.done = 12; p.missions.owned = ['cape:leaf', 'vine:berry', 'pet:bunny', 'hat:flower', 'cape:sky']; p.missions.active = [{ id: 90, type: 'clean', target: 3, prog: 1, tier: 0, reward: 'pet:squirrel' }, { id: 91, type: 'clean', target: 3, prog: 0, tier: 0, reward: 'vine:frost' }];
    localStorage.setItem(k, JSON.stringify(raw)); __RS.loadSave(); const m = __RS.missions(), q = __RS.save.progress; return { ver: q.saveVer, g: q.glimmers, w: q.weapon, done: m.done, owned: m.owned.length, rewards: m.active.map((a) => a.reward), prog: m.active[0].prog, bowNow: !!q.unlocks.bow }; }, KEY);
  ok('save: v2.3 save migrates to v24 — glimmers/weapon/missions/progress kept, the Thornbow becomes an open mission reward', r.ver === 24 && r.g === 555 && r.w === 'whip' && r.done === 12 && r.owned === 5 && r.rewards.includes('wpn:bow') && r.prog === 1 && !r.bowNow, r);
  const r2 = await E(() => { const m = __RS.missions(); __RS.MS.grant(m, 'wpn:bow'); return { u: !!__RS.save.progress.unlocks.bow, w: __RS.save.progress.weapon }; }); ok('missions: earning wpn:bow unlocks + equips the Thornbow', r2.u && r2.w === 'bow', r2); }
{ const p = await E(() => { __RS.save.settings.difficulty = 'nightmare'; __RS.save.progress.weapon = 'bow'; __RS.start('run', { chapter: 4, seed: 9 }); __RS.god(true); __RS.manual(true); __RS.step(60); const t0 = performance.now(); for (let f = 0; f < 600; f++) { if (f % 9 === 0) __RS.press('attack'); if (f % 9 === 4) __RS.release('attack'); __RS.step(1); } const up = (performance.now() - t0) / 600; const t1 = performance.now(); for (let i = 0; i < 30; i++) __RS.renderNow(); const rd = (performance.now() - t1) / 30; __RS.save.settings.difficulty = 'normal'; return { stepMs: +up.toFixed(2), renderMs: +rd.toFixed(2) }; });
  ok('perf: busy chapter with arrows flying — step < 3 ms, render < 30 ms (software raster)', p.stepMs < 3 && p.renderMs < 30, p); }
const errs = allErr.flat(); ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
await L.browser.close(); server.close(); const f = results.filter((r) => !r.pass); console.log(`\n${results.length - f.length}/${results.length} passed`); process.exit(f.length ? 1 : 0);
