import { createRequire } from 'module'; import http from 'http'; import fs from 'fs'; import path from 'path';
const require = createRequire('/tmp/pp/'); const puppeteer = require('/tmp/pp/node_modules/puppeteer-core');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
export function serve(dir = new URL('../dist/', import.meta.url).pathname, port = 0) {
  return new Promise((res) => { const s = http.createServer((q, r) => { let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html'; const f = path.join(dir, p); if (!fs.existsSync(f)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }); s.listen(port, () => res({ server: s, url: `http://localhost:${s.address().port}/` })); });
}
export async function launch(opts = {}) {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: 'new', args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--window-size=' + (opts.w || 915) + ',' + (opts.h || 412)] });
  const page = await browser.newPage(); const logs = [], errors = [];
  page.on('console', (m) => { const t = m.type(), txt = m.text(); logs.push(`[${t}] ${txt}`); if (t === 'error') errors.push(txt); });
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + '\n' + (e.stack || '')));
  page.on('requestfailed', (r) => errors.push('REQFAIL ' + r.url()));
  await page.setViewport({ width: opts.w || 915, height: opts.h || 412, deviceScaleFactor: opts.dpr || 1, isMobile: !!opts.mobile, hasTouch: !!opts.mobile });
  return { browser, page, logs, errors };
}
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// hold inputs for N ms of real time
export async function hold(page, btns, ms, axes) { await page.evaluate((b, a) => { if (a) __RS.axes(a[0], a[1]); for (const x of b) __RS.press(x); }, btns, axes || null); await sleep(ms); await page.evaluate((b, a) => { if (a) __RS.axes(null); for (const x of b) __RS.release(x); }, btns, axes || null); }
export async function tap(page, btn, ms = 60) { return hold(page, [btn], ms); }
export const st = (page) => page.evaluate(() => __RS.state());
// Deterministic driver: runs a policy inside the page, one fixed 1/60 step at a time.
// policy(W, P, f, mem) -> { mx, my, b: [buttons held] } or null to stop.
export async function drive(page, policy, maxFrames = 600, shotEvery = 0) {
  return page.evaluate((src, maxF) => {
    const pol = eval('(' + src + ')'); __RS.manual(true); const held = new Set(); const mem = {}; let f = 0, out = null;
    for (; f < maxF; f++) {
      const W = __RS.W; if (!W) break; const a = pol(W, W.player, f, mem); if (!a) break;
      __RS.axes(a.mx || 0, a.my || 0); const want = new Set(a.b || []);
      for (const b of held) if (!want.has(b)) { __RS.release(b); held.delete(b); }
      for (const b of want) if (!held.has(b)) { __RS.press(b); held.add(b); }
      out = __RS.step(1);
    }
    for (const b of held) __RS.release(b); __RS.axes(null); return { frames: f, state: __RS.state(), mem };
  }, policy.toString(), maxFrames);
}
