// Fixed screenshot set for art comparison: node tools/shots.mjs <outdir>
import { serve, launch, sleep, drive } from './lib.mjs';
import fs from 'fs';
const OUT = (process.argv[2] || 'shots/after').replace(/\/$/, '') + '/'; fs.mkdirSync(OUT, { recursive: true });
const ONLY = process.argv[3] ? process.argv[3].split(',') : null; const want = (n) => !ONLY || ONLY.includes(n);
const { server, url } = await serve();
const errs = [];
async function open(opts = {}) { const L = await launch(opts); L.page.on('pageerror', (e) => errs.push(e.message)); await L.page.goto(url); await L.page.waitForFunction(() => window.__RS && (!__RS.gfx || __RS.gfx.ready), { timeout: 15000 }).catch(() => {}); await sleep(600); await L.page.evaluate(() => { localStorage.clear(); }); return L; }
const shot = async (page, n) => { await sleep(250); await page.screenshot({ path: OUT + n + '.png' }); console.log('shot', n); };
const settle = (page, n = 90) => page.evaluate((n) => { __RS.manual(true); __RS.skipCountdown(); __RS.step(n); }, n);
const FIGHT = (W, P, f, m) => { const live = W.enemies.filter((e) => !e.dead && e.type !== 'dummy' && Math.abs(e.cx - P.cx) < 400 && Math.abs(e.cy - P.cy) < 200); if (!live.length || f > 600) return null;
  let tg = live[0], bd = 1e9; for (const e of live) { const d = Math.hypot(e.cx - P.cx, e.cy - P.cy); if (d < bd) { bd = d; tg = e; } }
  if (P.atk && P.atk.phase === 'active' && bd < 70 && f > 40) return null; const dx = tg.cx - P.cx; return { mx: Math.abs(dx) > 26 ? Math.sign(dx) : 0, b: Math.abs(dx) < 60 && f % 9 < 4 ? ['attack'] : [] }; };
// death / results screen (v1.2)
if (want('death')) { const { browser, page } = await open();
  await page.evaluate(() => { __RS.save.progress.tutorialDone = true; __RS.save.progress.glimmers = 95; __RS.start('run', { seed: 12345 }); }); await settle(page, 30);
  await page.evaluate(() => { const W = __RS.W, P = W.player; W.runGlim = 48; P.stats.kills = 7; P.iframes = 0; P.hp = 1; P.hurt(W, 99, P.cx + 10, {}); __RS.step(200); __RS.manual(false); }); await sleep(1800); await shot(page, '12-death'); await browser.close(); }
// title
if (want('title')) { const { browser, page } = await open(); await page.reload(); await page.waitForFunction(() => !__RS.gfx || __RS.gfx.ready, { timeout: 15000 }).catch(() => {}); await sleep(1200); await shot(page, '01-title'); await browser.close(); }
// tutorial
if (want('tutorial')) { const { browser, page } = await open(); await page.evaluate(() => __RS.start('tutorial')); await settle(page, 60); await page.evaluate(() => { const W = __RS.W, P = W.player; P.x += 200; W.snapCamera(); __RS.step(30); }); await shot(page, '02-tutorial'); await browser.close(); }
// hub
if (want('hub')) { const { browser, page } = await open(); await page.evaluate(() => { __RS.save.progress.tutorialDone = true; __RS.start('hub'); }); await settle(page, 60); await shot(page, '03-hub'); await browser.close(); }
// run: normal room, combat, miniboss
if (want('run')) { const { browser, page } = await open();
  await page.evaluate(() => { __RS.save.progress.tutorialDone = true; __RS.start('run', { seed: 12345 }); __RS.god(true); }); await settle(page, 30);
  const cells = await page.evaluate(() => __RS.W.cells.map((c) => ({ i: c.index, kind: c.kind, x: c.x, y: c.y, branch: !!c.branch, n: __RS.W.enemies.filter((e) => e.cell === c.index).length })));
  const tele = (i) => page.evaluate((i) => { const W = __RS.W, P = W.player, c = W.cells[i], T = __RS.TILE; const ox = c.x * 34, oy = c.y * 20; P.x = (ox + 3) * T + 3; P.y = (oy + 18) * T - P.h - 1; P.vx = P.vy = 0; W.updateRoom(false); W.snapCamera(); }, i);
  const normal = cells.filter((c) => c.kind === 'normal' && !c.branch && c.n >= 2);
  await tele(normal[0].i); await page.evaluate(() => __RS.step(20)); await shot(page, '04-room');
  await tele(normal[1] ? normal[1].i : normal[0].i); await page.evaluate(() => __RS.step(10)); await drive(page, FIGHT.toString(), 600); await shot(page, '05-combat');
  const mb = cells.find((c) => c.kind === 'miniboss'); await tele(mb.i); await page.evaluate(() => __RS.step(5)); await drive(page, ((W, P, f) => { const b = W.enemies.find((e) => e.type === 'warden' && !e.dead); if (!b || f > 400) return null; if (f > 150 && Math.abs(b.cx - P.cx) < 140) return null; return { mx: Math.sign(b.cx - P.cx) }; }).toString(), 400); await shot(page, '06-miniboss');
  await browser.close(); }
// boss + victory
if (want('boss')) { const { browser, page } = await open(); await page.evaluate(() => { __RS.save.progress.tutorialDone = true; __RS.start('boss', { seed: 5 }); __RS.god(true); }); await settle(page, 240);
  await page.evaluate(() => { const W = __RS.W, B = W.boss; if (B) { B.hp = B.maxHp * 0.5; } __RS.step(150); }); await page.evaluate(() => { const W = __RS.W, B = W.boss; if (B && B.st === 'idle') B.attack(W, 'slam', W.player, W.room.y + W.room.h - 48); __RS.step(30); }); await shot(page, '07-boss');
  await page.evaluate(() => { const B = __RS.W.boss; B.hp = 0; B.st = 'dying'; B.t = 0; __RS.step(140); __RS.manual(false); }); await sleep(800); await shot(page, '08-bloom'); await sleep(2600); await shot(page, '09-victory'); await browser.close(); }
if (want('cave')) { const { browser, page } = await open();
  await page.evaluate(() => { __RS.save.progress.tutorialDone = true; __RS.start('run', { seed: 12345, stage: 1 }); __RS.god(true); }); await settle(page, 30);
  const cells = await page.evaluate(() => __RS.W.cells.map((c) => ({ i: c.index, kind: c.kind, x: c.x, y: c.y, branch: !!c.branch, n: __RS.W.enemies.filter((e) => e.cell === c.index).length })));
  const tele = (i) => page.evaluate((i) => { const W = __RS.W, P = W.player, c = W.cells[i], T = __RS.TILE; const ox = c.x * 34, oy = c.y * 20; P.x = (ox + 3) * T + 3; P.y = (oy + 18) * T - P.h - 1; P.vx = P.vy = 0; W.updateRoom(false); W.snapCamera(); }, i);
  const normal = cells.filter((c) => c.kind === 'normal' && !c.branch && c.n >= 2);
  await tele(normal[0].i); await page.evaluate(() => __RS.step(20)); await shot(page, '11-cave-room');
  await tele(normal[1] ? normal[1].i : normal[0].i); await page.evaluate(() => __RS.step(10)); await drive(page, FIGHT.toString(), 600); await shot(page, '12-cave-combat');
  const mb = cells.find((c) => c.kind === 'miniboss'); await tele(mb.i); await page.evaluate(() => __RS.step(5)); await drive(page, ((W, P, f) => { const b = W.enemies.find((e) => e.type === 'tidegolem' && !e.dead); if (!b || f > 400) return null; if (f > 150 && Math.abs(b.cx - P.cx) < 140) return null; return { mx: Math.sign(b.cx - P.cx) }; }).toString(), 400); await shot(page, '13-cave-miniboss');
  await page.evaluate(() => { __RS.manual(false); __RS.game.pause(); }); await sleep(600); await shot(page, '16-pausemap');
  await browser.close(); }
if (want('cave')) { const { browser, page } = await open(); await page.evaluate(() => { __RS.save.progress.tutorialDone = true; __RS.start('boss', { seed: 5, stage: 1 }); __RS.god(true); }); await settle(page, 240);
  await page.evaluate(() => { const W = __RS.W, B = W.boss; if (B) { B.hp = B.maxHp * 0.5; } __RS.step(150); }); await page.evaluate(() => { const W = __RS.W, B = W.boss; if (B && B.st === 'idle') B.attack(W, 'tide', W.player, W.room.y + W.room.h - 48); __RS.step(30); }); await shot(page, '14-final-boss');
  await page.evaluate(() => { const B = __RS.W.boss; B.hp = 0; B.st = 'dying'; B.t = 0; __RS.step(140); __RS.manual(false); }); await sleep(800); await shot(page, '14b-final-dying'); await sleep(2600); await shot(page, '15-final-victory'); await browser.close(); }
// phone touch layout
if (want('touch')) { const { browser, page } = await open({ mobile: true, dpr: 2.6 }); await page.evaluate(() => { __RS.save.progress.tutorialDone = true; __RS.start('run', { seed: 12345 }); }); await settle(page, 60);
  await page.touchscreen.tap(300, 300); await page.evaluate(() => __RS.step(30)); await shot(page, '10-touch-915x412'); await browser.close(); }
console.log('page errors', errs.length, errs.slice(0, 3)); server.close();
