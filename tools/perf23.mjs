// v2.3 perf probe: frame times under CPU throttle for title + a busy chapter, per quality tier
import { serve, launch, sleep } from './lib.mjs';
const rate = +(process.argv[2] || 4), tiers = (process.argv[3] || 'high,med,low').split(','); const srv = await serve(); const out = {};
for (const q of tiers) {
  const { browser, page, errors } = await launch({ w: 915, h: 412, dpr: 2.625 });
  await page.goto(srv.url, { waitUntil: 'load' }); await sleep(2500);
  await page.evaluate((q) => { __RS.save.settings.quality = q; dispatchEvent(new Event('resize')); }, q); await sleep(300);
  const cdp = await page.target().createCDPSession(); await cdp.send('Emulation.setCPUThrottlingRate', { rate });
  const probe = async (ms) => page.evaluate((ms) => new Promise((res) => { const f = []; let l = performance.now(); const t0 = l; const step = (t) => { f.push(t - l); l = t; if (t - t0 < ms) requestAnimationFrame(step); else { f.sort((a, b) => a - b); res({ med: +f[f.length >> 1].toFixed(1), p95: +f[Math.floor(f.length * 0.95)].toFixed(1), fps: +(1000 * f.length / (t - t0)).toFixed(1) }); } }; requestAnimationFrame(step); }), ms);
  const title = await probe(4000);
  await page.evaluate(() => { __RS.start('run', { chapter: 4 }); }); await sleep(1500); await page.evaluate(() => { __RS.skipCountdown && __RS.skipCountdown(); __RS.god && __RS.god(true); });
  await cdp.send('Performance.enable'); const m0 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value]));
  await page.keyboard.down('ArrowRight'); const play = await probe(6000); await page.keyboard.up('ArrowRight');
  const m1 = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map((m) => [m.name, m.value])); const fr = play.fps * 6;
  play.jsMsPerFrame = +((m1.ScriptDuration - m0.ScriptDuration) * 1000 / fr / rate).toFixed(2); play.heapMB = +(m1.JSHeapUsedSize / 1048576).toFixed(1);
  const st = await page.evaluate(() => ({ dpr: __RS.game.dpr, res: __RS.game.resLevel || 0, low: !!__RS.game.lowPerf, q: __RS.save.settings.quality, fx: __RS.game.world.fx.cap }));
  out[q] = { title, play, st, errors: errors.length }; console.log(q, JSON.stringify(out[q])); await browser.close();
}
process.exit(0);
