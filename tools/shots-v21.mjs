// v2.1 screenshots -> shots/v21/  (node tools/shots-v21.mjs)
import { serve, launch, sleep } from './lib.mjs';
import fs from 'fs';
fs.mkdirSync('shots/v21', { recursive: true });
const { server, url } = await serve();
const errs = [];
async function open(o = {}) { const r = await launch(o); await r.page.goto(url); await sleep(800); errs.push(r.errors); return r; }
const shot = (page, n) => page.screenshot({ path: `shots/v21/${n}.png` });
const E = (p, f, ...a) => p.evaluate(f, ...a);
{ const { browser, page } = await open();
  await E(page, () => { localStorage.clear(); }); await page.reload(); await sleep(800);
  await E(page, () => document.querySelector('[data-act="play"]').click()); await sleep(900); await shot(page, '01-intro-panel1');
  await E(page, () => document.querySelector('[data-act="cmNext"]').click()); await sleep(700);
  await E(page, () => document.querySelector('[data-act="cmNext"]').click()); await sleep(900); await shot(page, '02-intro-panel3');
  await E(page, () => document.querySelector('[data-act="cmSkip"]').click());
  // hub before
  await E(page, () => { __RS.save.progress.tutorialDone = true; __RS.writeSave(); __RS.start('hub'); }); await sleep(2500); await shot(page, '03-hub-before');
  await E(page, () => { const W = __RS.W; W.game.useDoor(W); }); await sleep(900); await shot(page, '04-chapter-map-start');
  // warden beat
  await E(page, () => { document.querySelector('.mp-play').click(); __RS.skipComic(); const W = __RS.W; const e = W.enemies[0]; W.onMinibossDefeated(e); W.countdown = 0; W.story.beatT = 0.05; }); await sleep(1500); await shot(page, '05-warden-beat');
  await E(page, () => __RS.skipComic());
  // hub after (3 chapters done)
  await E(page, () => { const c = __RS.story.camp(); c.unlocked = 4; for (const n of [1, 2, 3]) { c.done[n] = true; c.freed[n] = true; c.seeds[n] = 3; } __RS.writeSave(); __RS.start('hub'); }); await sleep(2500); await shot(page, '06-hub-after-3-chapters');
  await E(page, () => { const W = __RS.W; W.game.useDoor(W); }); await sleep(900); await shot(page, '07-chapter-map-progress');
  // ending
  await E(page, () => { __RS.skipComic && 0; document.querySelector('[data-act="back"]') && document.querySelector('[data-act="back"]').click(); const c = __RS.story.camp(); c.unlocked = 5; c.done[4] = true; c.freed[4] = true; __RS.writeSave(); __RS.start('boss', { chapter: 5, seed: 11 }); }); await sleep(1500); await shot(page, '08-final-boss');
  await E(page, () => { const W = __RS.W; W.game.onVictory(W); }); await sleep(900);
  for (let i = 0; i < 3; i++) { await E(page, () => document.querySelector('[data-act="cmNext"]') && document.querySelector('[data-act="cmNext"]').click()); await sleep(600); }
  await sleep(500); await shot(page, '09-ending-comic');
  await E(page, () => __RS.skipComic()); await sleep(900); await shot(page, '10-ending-victory');
  await E(page, () => { __RS.start('hub'); }); await sleep(2500); await shot(page, '11-hub-bloomed-ending');
  await browser.close(); }
{ const { browser, page } = await open({ mobile: true, dpr: 2.6 });
  await E(page, () => { __RS.save.progress.tutorialDone = true; __RS.start('run', { seed: 12345, chapter: 1 }); }); await sleep(2200);
  await page.touchscreen.tap(300, 300); await sleep(400); await shot(page, '12-modern-touch-layout');
  await E(page, () => __RS.layoutEditor && __RS.layoutEditor()); await sleep(700); await shot(page, '13-layout-editor');
  await browser.close(); }
console.log('errors', JSON.stringify(errs.flat().slice(0, 4))); server.close();
