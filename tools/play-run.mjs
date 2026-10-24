// Scripted god-mode run: walk the main path cell by cell (teleporting between cells), fight every enemy with a
// simple combat bot, beat the Scrap Warden, take the boss door, and fight Grumblestack through its phases.
import { serve, launch, sleep, drive } from './lib.mjs';
const SEED = +(process.argv[2] || 12345), OUT = '../shots/';
const { server, url } = await serve(); const { browser, page, errors } = await launch({ dpr: 1 });
await page.goto(url); await sleep(600);
await page.evaluate((seed) => { localStorage.clear(); __RS.save.tutorialDone = true; __RS.start('run', { seed }); __RS.god(true); __RS.manual(true); }, SEED); await sleep(300);
const info = await page.evaluate(() => { const W = __RS.W; return { cells: W.cells.map((c) => ({ i: c.index, kind: c.kind, id: c.id, x: c.x, y: c.y, need: [...c.need], branch: !!c.branch })), enemies: W.enemies.length }; });
console.log('cells', info.cells.length, 'enemies', info.enemies, info.cells.filter((c) => !c.branch).map((c) => c.id + ':' + c.kind[0]).join(' '));
const FIGHT = (W, P, f, m) => {
  if (W.countdown > 0) return {};
  if (m.cell == null) return null; const T = __RS.TILE;
  const live = W.enemies.filter((e) => !e.dead && (e.cell === m.cell || e === W.boss) && !(e.type === 'dummy'));
  m.maxE = Math.max(m.maxE || 0, live.length); if (!m.on) { m.on = 1; m.ev = {}; W.on((n) => { m.ev[n] = (m.ev[n] || 0) + 1; }); }
  if (W.boss) { m.ph = m.ph || []; if (!m.ph.includes(W.boss.phase)) m.ph.push(W.boss.phase); }
  if (!live.length) { m.idle = (m.idle || 0) + 1; return m.idle > 30 ? null : {}; } m.idle = 0;
  let tg = live[0], bd = 1e9; for (const e of live) { const d = Math.hypot(e.x + e.w / 2 - P.cx, e.y + e.h / 2 - P.cy); if (d < bd) { bd = d; tg = e; } }
  const dx = tg.x + tg.w / 2 - P.cx, dy = tg.y + tg.h / 2 - P.cy; const a = { mx: Math.abs(dx) > 28 ? Math.sign(dx) : 0, b: [] };
  if (Math.abs(dx) < 28 && P.face !== Math.sign(dx) && dx) a.mx = Math.sign(dx) * 0.3;
  if ((dy < -50 && P.onGround) || (P.onWall && f % 20 < 10)) a.b.push('jump');
  if (P.onGround && Math.abs(P.vx) < 5 && a.mx && f % 40 === 0) a.b.push('jump'); // stuck: hop
  if (Math.abs(dx) < 60 && Math.abs(dy) < 60 && f % 9 < 4) a.b.push(f % 90 < 70 ? 'attack' : 'heavy');
  if (f % 300 === 150) a.b.push('skill1'); if (f % 300 === 220) a.b.push('skill2');
  // bail out of a cell after a long stalemate (unreachable flyer etc.)
  if (f > (m.limit || 1500)) return null; return a;
};
const tele = (i) => page.evaluate((i) => { const W = __RS.W, P = W.player, c = W.cells[i], T = __RS.TILE, M = W.map; const ox = c.x * 34, oy = c.y * 20;
  let tx = ox + 2, ty = oy + 17; if (c.need.has('U') && !c.need.has('L')) { tx = ox + 16; ty = oy + 2; }
  if (c.kind === 'start') return; P.x = tx * T + 3; P.y = (ty + 1) * T - P.h - 1; P.vx = P.vy = 0; P.hook.s = 'none'; W.updateRoom(false); W.snapCamera(); }, i);
const path = info.cells.filter((c) => !c.branch); const log = []; let shots = 0, total = 0;
for (const c of path) {
  await tele(c.i);
  const r = await drive(page, `(${FIGHT.toString()})`.replace('m.cell == null', `(m.cell = ${c.i}, m.limit = ${c.kind === 'miniboss' ? 4000 : 1500}, false)`), 4200);
  total += r.frames; const left = await page.evaluate((i) => __RS.W.enemies.filter((e) => !e.dead && e.cell === i).length, c.i);
  log.push(`${c.id}(${c.kind[0]}) frames ${r.frames} maxE ${r.mem.maxE || 0} left ${left} ev ${JSON.stringify(r.mem.ev || {})}`);
  if (c.kind === 'miniboss' || (c.kind === 'normal' && shots < 2 && r.mem.maxE >= 3)) { await page.evaluate(() => __RS.step(1)); await sleep(150); await page.screenshot({ path: `${OUT}run-${c.kind}-${c.id.replace('~', '')}.png` }); shots++; }
}
console.log(log.join('\n'));
// boss door
const door = await page.evaluate(() => { const W = __RS.W, P = W.player, d = W.props.find((o) => o.kind === 'door'); if (!d) return null; P.x = d.x + d.w / 2 - P.w / 2; P.y = d.y + d.h - P.h - 2; P.vx = P.vy = 0; W.updateRoom(false); W.snapCamera(); return { x: d.x, y: d.y }; });
await drive(page, (W, P, f) => (f > 40 ? null : { b: f % 10 === 5 ? ['attack'] : [] }), 60);
for (let k = 0; k < 120; k++) { await page.evaluate(() => __RS.step(1)); const m = await page.evaluate(() => __RS.W && __RS.W.mode); if (m === 'boss') break; }
const bs = await page.evaluate(() => __RS.state()); console.log('door', JSON.stringify(door), 'now', bs.mode, JSON.stringify(bs.boss));
await page.evaluate(() => __RS.step(30)); await sleep(150); await page.screenshot({ path: `${OUT}run-boss-intro.png` });
let phases = new Set(), bf = 0, phShot = new Set();
for (let chunk = 0; chunk < 20; chunk++) {
  const r = await drive(page, `(${FIGHT.toString()})`.replace('m.cell == null', '(m.cell = -1, m.limit = 1200, false)'), 1200); bf += r.frames;
  const s = await page.evaluate(() => __RS.state()); if (s.boss) { phases.add(s.boss.phase); if (!phShot.has(s.boss.phase)) { phShot.add(s.boss.phase); await sleep(120); await page.screenshot({ path: `${OUT}run-boss-p${s.boss.phase}.png` }); } }
  console.log('boss chunk', chunk, 'frames', r.frames, JSON.stringify(s.boss), 'mode', s.mode, 'ui', s.ui);
  if (!s.boss || s.boss.hp <= 0 || s.mode !== 'boss' || s.ui) break;
}
for (let k = 0; k < 8; k++) await page.evaluate(() => __RS.step(30));
await sleep(200); await page.screenshot({ path: `${OUT}run-end.png` });
const end = await page.evaluate(() => ({ s: __RS.state(), save: { glim: __RS.save.glim ?? __RS.save.data?.glim, wins: __RS.save.wins ?? __RS.save.stats?.wins } }));
console.log('END', JSON.stringify(end), 'path frames', total, 'boss frames', bf, 'phases', [...phases]);
console.log('ERRORS', errors.length, errors.slice(0, 5).join('\n'));
await browser.close(); server.close();
