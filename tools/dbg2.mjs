import { serve, launch, sleep, drive } from './lib.mjs';
const { server, url } = await serve(); const { browser, page, errors } = await launch({ dpr: 1 });
await page.goto(url); await sleep(500);
await page.evaluate(() => { localStorage.clear(); __RS.start('tutorial'); __RS.manual(true); __RS.W.countdown = 0; const P = __RS.W.player; P.x = 1330; P.y = 398; __RS.step(30); });
const r = await page.evaluate(() => { const W = __RS.W, P = W.player, d = W.enemies.find((e) => e.type === 'dummy'); const out = { d: { x: d.x, y: d.y, w: d.w, h: d.h, st: d.st, active: d.active } , boxes: [] };
  const ab = W.attackBox.bind(W); W.attackBox = (box, def, p, hs) => { out.boxes.push(box); return ab(box, def, p, hs); };
  __RS.press('attack'); __RS.step(2); __RS.release('attack'); __RS.step(20); W.on((n) => { out.ev = (out.ev || []).concat(n); }); __RS.press('attack'); __RS.step(2); __RS.release('attack'); __RS.step(20); out.p = { x: P.x, y: P.y, w: P.w, h: P.h, face: P.face }; out.tut = __RS.tut(); return out; });
console.log(JSON.stringify(r), errors); await browser.close(); server.close();
