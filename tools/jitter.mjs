// v1.4 frame-pacing harness: run right at full speed, drive the real rAF tick() with synthetic vsync at 60/90/120 Hz (+/- noise)
// and measure how evenly the hero moves on screen. node tools/jitter.mjs <tag> -> shots/v14/jitter-<tag>.json
import { serve, launch, sleep } from './lib.mjs'; import fs from 'fs';
const tag = process.argv[2] || 'now';
const { server, url } = await serve(); const L = await launch(); await L.page.goto(url); await sleep(1200);
const res = await L.page.evaluate(() => {
  const S = __RS; S.save.progress.tutorialDone = true; const out = {};
  const sd = (a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; return { mean: m, sd: Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / a.length) }; };
  for (const hz of [60, 90, 120]) for (const noise of [0, 2]) {
    S.start('hub', {}); S.manual(true); const W = S.W; W.countdown = 0; W.fade = 0; W.props = []; W.anchors = []; W.enemies = []; S.god(true);
    const P = W.player; P.x = 3 * S.TILE; P.y = 18 * S.TILE - P.h; P.vx = 0; P.face = 1; W.snapCamera(); S.axes(1, 0); S.step(20);
    const tr = S.trace(hz, Math.round(hz * 0.9), noise, 7); S.axes(0, 0);
    const v = [], scr = [], cam = [];
    for (let i = 1; i < tr.length; i++) { const dt = tr[i].dt / 1000; v.push((tr[i].px - tr[i - 1].px) / dt); scr.push((tr[i].px - tr[i].camx) - (tr[i - 1].px - tr[i - 1].camx)); cam.push((tr[i].camx - tr[i - 1].camx) / dt); }
    const a = sd(v), b = sd(scr), c = sd(cam);
    // hero speed CV: 0 = perfectly even motion every displayed frame
    out[hz + 'Hz' + (noise ? '_noise' + noise + 'ms' : '')] = { heroSpeedCV: +(a.sd / Math.max(1, Math.abs(a.mean))).toFixed(3), heroSpeed: Math.round(a.mean), screenStepSdPx: +b.sd.toFixed(2), camSpeedCV: +(c.sd / Math.max(1, Math.abs(c.mean))).toFixed(3), zeroMoveFrames: v.filter((x) => Math.abs(x) < 1).length, frames: tr.length, costP50: +tr.map((t) => t.cost).sort((x, y) => x - y)[tr.length >> 1].toFixed(2) };
  }
  return out;
});
fs.mkdirSync('shots/v14', { recursive: true }); fs.writeFileSync(`shots/v14/jitter-${tag}.json`, JSON.stringify(res, null, 1));
console.log(JSON.stringify(res, null, 1)); console.log('errors', JSON.stringify(L.errors)); await L.browser.close(); server.close();
