// v1.4.1 hero walk/run probe: drives the hero on flat ground with the touch-stick mapping at several throws,
// records every 60 Hz render pose (frame name, pivot, world pos) -> shots/v141/walk-<tag>.json, and draws strips.
// node tools/walk-probe.mjs <tag>
import { serve, launch } from './lib.mjs'; import fs from 'fs';
const tag = process.argv[2] || 'now';
const { server, url } = await serve(); const { browser, page } = await launch();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(url); await page.waitForFunction(() => window.__RS && __RS.gfx.ready && __RS.gfx.hero, { timeout: 20000 });
const res = await page.evaluate(() => {
  __RS.save.progress.tutorialDone = true; __RS.start('hub'); __RS.manual(true); __RS.skipCountdown && __RS.skipCountdown(); __RS.step(60);
  const W = __RS.W, P = W.player;
  // find the longest flat floor run in the hub
  const T = __RS.TILE; let best = null;
  const M = W.map, sol = (x, y) => M.solid(x, y) || M.hazard(x, y);
  for (let ty = 3; ty < M.h - 1; ty++) { let run = 0; for (let tx = 1; tx < M.w - 1; tx++) { const ok = M.solid(tx, ty + 1) && !sol(tx, ty) && !sol(tx, ty - 1) && !sol(tx, ty - 2) && !M.hazard(tx, ty + 1); run = ok ? run + 1 : 0; if (!best || run > best.n) best = { n: run, tx: tx - run + 1, ty }; } }
  const place = () => { P.x = (best.tx + 2) * T; P.y = (best.ty + 1) * T - P.h - 0.5; P.vx = P.vy = 0; P.face = 1; P.runPh = 0; __RS.axes(0, 0); __RS.step(40); };
  // stick throw -> axes value, using the real v1.4 mapping lives in input.js; here we feed the axis directly (sx)
  const rec = (frames, axFn) => { const out = []; for (let f = 0; f < frames; f++) { const a = axFn(f); __RS.axes(a, 0); __RS.step(2);
      const p = P.heroPose(W); out.push({ f, ax: a, n: p.n, X: p.X, Y: p.Y, pvx: p.pvx, pvy: p.pvy, K: p.K, sx: p.sx, sy: p.sy, face: p.face, vx: P.vx, x: P.x, ground: P.onGround }); } return out; };
  const S = {};
  place(); S.walk = rec(120, () => 0.38);       // ~70 u/s: the analog walk zone
  place(); S.run = rec(120, () => 1);           // full throw: 182 u/s
  place(); S.ramp = rec(120, (f) => Math.min(1, f / 90)); // thumb sliding out over 1.5 s
  place(); S.startstop = rec(90, (f) => f < 45 ? 1 : 0);
  place(); S.turn = rec(80, (f) => f < 40 ? 1 : -1);
  return { S, floor: best, dt: 1 / 60 };
});
fs.writeFileSync(`shots/v141/walk-${tag}.json`, JSON.stringify(res));
// strips: 24 consecutive render frames per scenario, each cell centred on the body, ground ticks fixed in world space
const strips = await page.evaluate((S) => {
  const W = __RS.W, P = W.player, G = __RS.gfx.hero, urls = {};
  for (const [name, fr] of Object.entries(S)) {
    const seq = fr.slice(name === 'startstop' ? 30 : name === 'turn' ? 30 : name === 'ramp' ? 20 : 40).slice(0, 24); const cw = 44, chh = 62, rs = 3;
    const c = document.createElement('canvas'); c.width = cw * seq.length * rs; c.height = chh * rs; const g = c.getContext('2d');
    g.fillStyle = '#3a4456'; g.fillRect(0, 0, c.width, c.height);
    seq.forEach((r, i) => { const ox = i * cw, gy = chh - 8;
      g.setTransform(rs, 0, 0, rs, 0, 0); g.fillStyle = '#222a36'; g.fillRect(ox, gy, cw, 8);
      g.fillStyle = '#c8b070'; for (let wx = Math.floor((r.X - cw / 2) / 8) * 8; wx < r.X + cw / 2; wx += 8) { const sx = ox + cw / 2 + (wx - r.X); if (sx > ox && sx < ox + cw) g.fillRect(sx, gy, 0.6, wx % 32 === 0 ? 4 : 2); }
      g.fillStyle = '#e8e8c0'; g.font = '5px sans-serif'; g.fillText(r.n + ' ' + Math.round(Math.abs(r.vx)), ox + 1, 6);
      g.save(); g.beginPath(); g.rect(ox, 0, cw, chh); g.clip(); g.translate(ox + cw / 2, gy); g.scale(r.sx * r.K, r.sy * r.K); g.translate(-r.pvx, -r.pvy);
      const F = G.f[r.n] || G.f.idle0; g.drawImage(G.img, F[0], F[1], F[2], F[3], 0, 0, F[2], F[3]); g.restore();
      g.setTransform(rs, 0, 0, rs, 0, 0); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(ox + cw - 0.5, 0, 0.5, chh); });
    urls[name] = c.toDataURL('image/png'); }
  return urls; }, res.S);
for (const [n, u] of Object.entries(strips)) fs.writeFileSync(`shots/v141/strip-${tag}-${n}.png`, Buffer.from(u.split(',')[1], 'base64'));
console.log('floor', JSON.stringify(res.floor), 'errors', errs); await browser.close(); server.close();
