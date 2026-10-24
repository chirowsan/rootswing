// Hero pose sheet: node tools/poses.mjs out.png
import { serve, launch } from './lib.mjs';
import fs from 'fs';
const { server, url } = await serve(); const { browser, page } = await launch();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(url); await page.waitForFunction(() => window.__RS && __RS.gfx.ready, { timeout: 15000 });
const data = await page.evaluate(() => { __RS.save.progress.tutorialDone = true; __RS.start('hub'); __RS.manual(true); __RS.skipCountdown(); __RS.step(30);
  const W = __RS.W, P = W.player, rs = 3; W.rs = rs;
  const poses = [['idle', () => {}], ['run', () => { P.vx = 200; P.runPh = 1.2; }], ['run2', () => { P.vx = 200; P.runPh = 2.8; }], ['jump', () => { P.onGround = false; P.vy = -300; }], ['fall', () => { P.onGround = false; P.vy = 300; }], ['dash', () => { P.dashT = 0.1; }],
    ['wind', () => { P.atk = { kind: 'combo', step: 0, phase: 'wind', t: 0, def: { active: 0.1 } }; }], ['swing', () => { P.atk = { kind: 'combo', step: 0, phase: 'active', t: 0.05, def: { active: 0.1, reach: 30 }, hit: new Set() }; }], ['hurt', () => { P.hurtT = 0.2; P.flash = 0.1; }], ['hook', () => { P.hook = { s: 'swing', hx: P.cx + 60, hy: P.cy - 90 }; }], ['dead', () => { P.dead = true; P.deadT = 0.5; }]];
  const c = document.createElement('canvas'); c.width = poses.length * 70 * rs; c.height = 150 * rs; const g = c.getContext('2d'); g.fillStyle = '#556070'; g.fillRect(0, 0, c.width, c.height);
  const out = [];
  poses.forEach(([n, fn], i) => { Object.assign(P, { atk: null, dashT: 0, hurtT: 0, flash: 0, dead: false, deadT: 0, vx: 0, vy: 0, onGround: true, iframes: 0, chargeT: 0, parryLock: 0, face: 1 }); P.hook = { s: 'none' }; fn();
    g.setTransform(rs, 0, 0, rs, (i * 70 + 35 - P.cx) * rs, (120 - P.y - P.h) * rs); try { P.draw(g, W); } catch (e) { out.push(n + ': ' + e.message); } });
  return { url: c.toDataURL(), out }; });
fs.writeFileSync(process.argv[2] || '/tmp/poses.png', Buffer.from(data.url.split(',')[1], 'base64'));
console.log('errs', errs, data.out); await browser.close(); server.close();
