import { serve, launch, sleep, st, hold } from './lib.mjs';
const { server, url } = await serve(); const { browser, page, errors } = await launch({ dpr: 2 });
await page.goto(url); await sleep(1500); await page.screenshot({ path: '../shots/01-title.png' });
for (const mode of ['tutorial', 'hub', 'run', 'boss']) {
  await page.evaluate((m) => __RS.start(m), mode); await sleep(2200); console.log(mode, JSON.stringify(await st(page)));
  await hold(page, [], 600, [1, 0]); await page.screenshot({ path: `../shots/smoke-${mode}.png` });
}
console.log('ERRORS', errors.length, errors.slice(0, 5).join('\n'));
await browser.close(); server.close();
