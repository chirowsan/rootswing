import { serve, launch, sleep } from './lib.mjs';
const { server, url } = await serve(); const { browser, page, errors } = await launch({ dpr: +(process.argv[2] || 1) });
await page.goto(url); await sleep(800);
await page.evaluate(() => __RS.start(process_mode = 'run')).catch(async () => page.evaluate(() => __RS.start('run')));
await sleep(1500);
const r = await page.evaluate(() => { const W = __RS.W, c = document.getElementById('c'), g = c.getContext('2d'); const T = {}; const tm = (k, f) => { g.getImageData(0,0,1,1); const t = performance.now(); f(); g.getImageData(0,0,1,1); T[k] = (T[k] || 0) + performance.now() - t; };
  const rs = c.height / 340; const orig = {}; 
  for (let i = 0; i < 30; i++) { tm('update', () => W.update(1 / 60)); tm('draw', () => W.draw(g, c.width, c.height, rs)); }
  // break down draw
  const parts = ['drawHazards', 'drawProps', 'drawAnchors', 'drawMarkers', 'drawShots']; for (const p of parts) { const f = W[p].bind(W); W[p] = (...a) => tm(p, () => f(...a)); }
  const pd = W.player.draw.bind(W.player); W.player.draw = (...a) => tm('player', () => pd(...a));
  for (const e of W.enemies) { const f = e.draw.bind(e); e.draw = (...a) => tm('enemies', () => f(...a)); }
  const fd = W.fx.draw.bind(W.fx); W.fx.draw = (...a) => tm('fx', () => fd(...a));
  for (const k of Object.keys(T)) T[k] = 0;
  for (let i = 0; i < 30; i++) tm("draw", () => { W.draw(g, c.width, c.height, rs); g.getImageData(0, 0, 1, 1); });
  g.getImageData(0, 0, 1, 1);
  for (const k in T) T[k] = +(T[k] / 30).toFixed(2); return { T, w: c.width, h: c.height, parts: W.fx.parts ? W.fx.parts.length : -1 }; });
console.log(JSON.stringify(r)); console.log(errors.slice(0, 3));
await browser.close(); server.close();
