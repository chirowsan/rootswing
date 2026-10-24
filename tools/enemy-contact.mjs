// v1.4: contact sheet per enemy (every animation state x 4 sample times) -> shots/v14/enemies/<name>.png
import { serve, launch } from './lib.mjs';
import { enemyStates } from './enemy-rig.mjs';
import fs from 'fs';
const { server, url } = await serve(); const { browser, page } = await launch();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(url); await page.waitForFunction(() => window.__RS && __RS.gfx.ready && __RS.gfx.en, { timeout: 20000 });
const r = await enemyStates(page, true); fs.mkdirSync('shots/v14/enemies', { recursive: true });
for (const [n, v] of Object.entries(r)) { fs.writeFileSync(`shots/v14/enemies/${n}.png`, Buffer.from(v.url.split(',')[1], 'base64'));
  const st = Object.entries(v.hashes).map(([k, h]) => `${k}:${new Set(h).size}/${new Set(v.frames[k]).size}`).join(' '); console.log(n, st, v.errors.join('|')); }
console.log('page errors', errs); await browser.close(); server.close();
