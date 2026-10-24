import { serve, launch, sleep, drive } from './lib.mjs';
const { server, url } = await serve(); const { browser, page, errors } = await launch({ dpr: 1 });
await page.goto(url); await sleep(500);
const r = await page.evaluate(() => { __RS.start('run', { seed: 12345 }); __RS.god(true); __RS.manual(true); __RS.step(200); const W = __RS.W, P = W.player;
  const ds = W.props.filter((o) => o.kind === 'door').map((d) => ({ x: d.x, y: d.y, w: d.w, h: d.h, open: d.open })); const d = W.props.find((o) => o.kind === 'door');
  P.x = d.x + d.w / 2 - P.w / 2; P.y = d.y + d.h - P.h - 2; P.vx = P.vy = 0; W.updateRoom(false); W.snapCamera(); const out = [];
  for (let i = 0; i < 30; i++) { if (i === 20) __RS.press('attack'); if (i === 21) __RS.release('attack'); const s = __RS.step(1); out.push([i, Math.round(P.x), Math.round(P.y), P.onGround ? 1 : 0, W.interactable(P)?.kind, W.mode, __RS.W.mode].join(',')); }
  return { ds, out, cd: W.countdown }; });
console.log(JSON.stringify(r, null, 0)); console.log(errors); await browser.close(); server.close();
