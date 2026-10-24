import { serve, launch, sleep } from './lib.mjs';
const { server, url } = await serve(); const { browser, page, errors } = await launch({ dpr: 1 });
await page.goto(url); await sleep(800); await page.evaluate(() => { __RS.save.settings.quality = 'low'; });
await page.waitForFunction(() => __RS.gfx.ready, { timeout: 15000 });
await page.evaluate(() => __RS.start('run')); await sleep(2500);
await page.screenshot({ path: 'shots/wip2/11-low-quality.png' }); console.log('errors', errors.length, errors.slice(0,2));
await browser.close(); server.close();
