// v2.2 screenshots -> shots/v22/  (node tools/shots-v22.mjs)
import { serve, launch, sleep } from './lib.mjs';
import fs from 'fs';
fs.mkdirSync('shots/v22', { recursive: true });
const { server, url } = await serve(); const { browser, page, errors } = await launch({ dpr: 1 });
await page.goto(url); await sleep(800);
const E = (f, ...a) => page.evaluate(f, ...a);
const shot = async (n) => { await E(() => __RS.renderNow()); await sleep(120); await page.screenshot({ path: `shots/v22/${n}.png` }); console.log('shot', n); };
await E(() => { localStorage.clear(); const c = __RS.story.camp(); c.intro = true; c.unlocked = 6; __RS.save.progress.tutorialDone = true; __RS.writeSave(); });
const run = (ch, seed, cellPick = 'normal') => E(([ch, seed, cellPick]) => { __RS.game.spRun = null; __RS.game.daily = null; __RS.start('run', { seed, chapter: ch }); __RS.manual(true); __RS.god(true); __RS.step(3); if (__RS.skipComic) __RS.skipComic();
  const W = __RS.W, P = W.player, T = __RS.TILE, c = W.cells.filter((c) => c.kind === cellPick)[2] || W.cells.find((c) => c.kind === 'normal'); const ox = c.x * 34, oy = c.y * 20; let spot = null;
  for (let y = oy + 17; y > oy + 2 && !spot; y--) for (let x = ox + 6; x < ox + 28; x++) if (W.map.get(x, y) === '.' && W.map.get(x, y - 1) === '.' && W.map.solid(x, y + 1)) { spot = { x, y }; break; }
  for (const e of W.enemies) if (!e.boss && e.cell === W.cells.indexOf(c)) e.dead = true;
  P.x = spot.x * T + 3; P.y = (spot.y + 1) * T - P.h - 1; P.vx = P.vy = 0; W.updateRoom(false); W.snapCamera(); W.countdown = 0; __RS.step(30); return { idx: W.cells.indexOf(c), spot }; }, [ch, seed, cellPick]);
const steps = (n) => E((n) => { for (let i = 0; i < n; i++) { const b = document.querySelector('#ui [data-act="boonPick0"]'); __RS.step(1); void b; } }, n);
// 1 boons
await run(2, 1214); await E(() => __RS.SP.offerBoons(__RS.W, 'Ambush cleared!')); await sleep(400); await shot('01-boons-3-cards');
await E(() => document.querySelector('[data-act="boonPick0"]').click());
// 2 shrine
await E(() => { const W = __RS.W, P = W.player; const o = { kind: 'sp', ev: 'shrine', x: P.x + 60, y: P.y + P.h - 52, w: 40, h: 52, id: 'shot-shrine' }; W.props.push(o); __RS.step(10); __RS.renderNow(); }); await shot('02-shrine-world');
await E(() => { const W = __RS.W; __RS.SP.interact(W, W.props.find((o) => o.id === 'shot-shrine'), W.player); }); await sleep(400); await shot('03-shrine-pacts');
await E(() => { const b = document.querySelector('#ui button.pact') || document.querySelector('#ui [data-act="close"]'); b && b.click(); });
// 3 merchant
await run(3, 777); await E(() => { const W = __RS.W, P = W.player; W.runGlim = 260; const o = { kind: 'sp', ev: 'merchant', x: P.x + 50, y: P.y + P.h - 48, w: 40, h: 48, id: 'shot-m' }; W.props.push(o); __RS.step(10); }); await shot('04-merchant-world');
await E(() => { const W = __RS.W; __RS.SP.interact(W, W.props.find((o) => o.id === 'shot-m'), W.player); }); await sleep(400); await shot('05-merchant-stock');
await E(() => { const b = document.querySelector('#ui [data-act="close"]') || document.querySelector('#ui [data-act="resume"]'); b && b.click(); __RS.game.paused = false; });
// 4 events
for (const [k, ch, n] of [['storm', 4, 120], ['ambush', 3, 70], ['hunter', 5, 160], ['fireflies', 1, 60], ['blight', 5, 90]]) {
  const r = await run(ch, 900 + ch); await E(([k, idx]) => { const W = __RS.W; W.sp.cellEv.clear(); W.sp.cur = -1; W.sp.cellEv.set(idx, { k, cell: idx, id: 'shot' + k }); __RS.SP.onEnterCell(W, W.cells[idx]); }, [k, r.idx]); await steps(n); await shot(`06-event-${k}`); }
// 5 mimic
{ const r = await run(3, 31); await E((idx) => { const W = __RS.W, P = W.player; const o = { kind: 'sp', ev: 'mimic', x: P.x + 70, y: P.y + P.h - 32, w: 30, h: 32, id: 'shot-mimic', cell: idx }; W.props.push(o); __RS.step(5); }, r.idx); await shot('07-mimic-chest');
  await E(() => { const W = __RS.W; __RS.SP.interact(W, W.props.find((o) => o.id === 'shot-mimic'), W.player); }); await steps(40); await shot('08-mimic-awake'); }
// 6 set-pieces
for (const [k, ch, n] of [['logchase', 2, 150], ['bridge', 3, 110], ['escape', 5, 140], ['dark', 4, 60]]) {
  const r = await run(ch, 500 + ch); await E(([k, idx]) => { const W = __RS.W; W.sp.set = { k, cell: idx }; W.sp.cur = -1; __RS.SP.onEnterCell(W, W.cells[idx]); }, [k, r.idx]); await steps(n); await shot(`09-setpiece-${k}`); }
// 7 bosses: phase 3, fake death, phase 4 arena
for (const ch of [3, 5]) {
  await E((ch) => { __RS.game.spRun = null; __RS.start('boss', { chapter: ch, seed: 11 }); __RS.manual(true); __RS.god(true); __RS.step(3); if (__RS.skipComic) __RS.skipComic(); __RS.W.countdown = 0; __RS.step(200); }, ch); await shot(`10-boss-ch${ch}-p1`);
  await E(() => { const b = __RS.W.enemies.find((e) => e.boss); b.hp = Math.round(b.maxHp * 0.3); for (let i = 0; i < 150; i++) __RS.step(1); }); await shot(`11-boss-ch${ch}-p3`);
  await E(() => { const b = __RS.W.enemies.find((e) => e.boss); if (b.fakeOut && !b.faked) b.fakeOut(__RS.W); for (let i = 0; i < 70; i++) __RS.step(1); }); await shot(`12-boss-ch${ch}-fakedeath`);
  await E(() => { for (let i = 0; i < 360; i++) __RS.step(1); }); await shot(`13-boss-ch${ch}-p4-arena`); }
// 8 secret chapter
await E(() => { __RS.game.spRun = null; __RS.start('run', { seed: 66, chapter: 6 }); __RS.manual(true); __RS.god(true); __RS.step(3); if (__RS.skipComic) __RS.skipComic(); __RS.W.countdown = 0; __RS.step(120); }); await shot('14-secret-chapter');
console.log('ERRORS', errors.length, errors.slice(0, 3).join(' | ')); await browser.close(); server.close();
