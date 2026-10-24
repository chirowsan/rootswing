import { serve, launch, sleep } from './lib.mjs';
const { server, url } = await serve(); const { browser, page, errors } = await launch({ dpr: 1 });
await page.goto(url); await sleep(2500);
console.log(await page.evaluate(() => { const c = document.getElementById('c'); const g = c.getContext('2d'); const d = g.getImageData(800, 200, 1, 1).data; return { px: [...d], st: __RS.state(), ui: document.getElementById('ui').className, cw: c.width }; }));
await page.screenshot({ path: '../shots/dbg-title.png' }); console.log(errors);
await browser.close(); server.close();
