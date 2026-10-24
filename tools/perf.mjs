// v1.4 phone-perf harness: real tick() (update + render) cost in a run room, phone viewport, CPU throttled 1x/4x/6x via CDP.
// node tools/perf.mjs <tag> [quality] [dpr] -> shots/v14/perf-<tag>.json (p50/p95 frame ms, per-layer draw ms)
import { serve, launch, sleep } from './lib.mjs'; import fs from 'fs';
const tag = process.argv[2] || 'now', quality = process.argv[3] || 'auto', dpr = +(process.argv[4] || 2.625);
const { server, url } = await serve(); const L = await launch({ dpr, mobile: true }); await L.page.goto(url); await sleep(1500);
const cdp = await L.page.target().createCDPSession(); const out = { viewport: '915x412', dpr, quality };
for (const rate of [1, 4, 6]) {
  await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  out['x' + rate] = await L.page.evaluate((q) => {
    const S = __RS; S.save.progress.tutorialDone = true; S.save.settings.quality = q; dispatchEvent(new Event('resize'));
    S.start('run', { seed: 4242 }); S.god(true); S.manual(true); S.step(40); const W = S.W; W.countdown = 0; S.axes(1, 0);
    S.trace(60, 30); W.prof = {}; const tr = S.trace(60, 150); const prof = W.prof; W.prof = null; S.axes(0, 0);
    const c = tr.map((t) => t.cost).sort((a, b) => a - b), pc = (p) => +c[Math.min(c.length - 1, Math.floor(c.length * p))].toFixed(2);
    const layers = {}; for (const k in prof) if (k !== 'n') layers[k] = +(prof[k] / prof.n).toFixed(2);
    return { p50: pc(0.5), p95: pc(0.95), max: pc(0.999), canvas: document.getElementById('c').width + 'x' + document.getElementById('c').height, layers };
  }, quality);
}
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
fs.mkdirSync('shots/v14', { recursive: true }); fs.writeFileSync(`shots/v14/perf-${tag}.json`, JSON.stringify(out, null, 1));
console.log(JSON.stringify(out)); console.log('errors', JSON.stringify(L.errors)); await L.browser.close(); server.close();
