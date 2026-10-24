// v1.3 animation contact sheet: every hero state, painted frames (and the v1.2 rig for comparison with --rig)
// node tools/anim-contact.mjs out.png [--rig]
import { serve, launch } from './lib.mjs';
import fs from 'fs';
const { server, url } = await serve(); const { browser, page } = await launch();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(url); await page.waitForFunction(() => window.__RS && __RS.gfx.ready, { timeout: 15000 });
const data = await page.evaluate((rig) => { __RS.save.progress.tutorialDone = true; __RS.start('hub'); __RS.manual(true); __RS.skipCountdown(); __RS.step(30);
  const W = __RS.W, P = W.player, rs = 3, Gx = __RS.gfx; W.rs = rs; const keep = Gx.hero; if (rig) Gx.hero = null;
  const A = (kind, step, phase, t, weapon) => () => { P.weapon = weapon || 'blade'; P.atk = { kind, step, phase, t, def: { active: 0.1 }, hit: new Set() }; };
  const poses = [];
  for (let i = 0; i < 8; i++) poses.push(['run' + i, () => { P.vx = 200; P.runPh = (i + 0.5) / 8 * Math.PI * 2; }]);
  poses.push(['idle', () => {}], ['breathe', () => { P.t = 2.2; }], ['jump', () => { P.onGround = false; P.vy = -300; }], ['apex', () => { P.onGround = false; P.vy = 0; }], ['fall', () => { P.onGround = false; P.vy = 300; }], ['land', () => { P.sy = 0.75; P.sx = 1.2; }],
    ['wall', () => { P.onGround = false; P.vy = 100; P.wallDir = 1; __RS.axes && __RS.axes(1, 0); }], ['dash', () => { P.dashT = 0.1; }], ['hook throw', () => { P.hook = { s: 'fly', hx: P.cx + 80, hy: P.cy - 70 }; }], ['swing', () => { P.hook = { s: 'swing', hx: P.cx + 50, hy: P.cy - 90 }; }],
    ['blade 1 wind', A('combo', 0, 'wind', 0)], ['blade 1 hit', A('combo', 0, 'active', 0.05)], ['blade 2 wind', A('combo', 1, 'wind', 0)], ['blade 2 hit', A('combo', 1, 'active', 0.05)], ['blade 3 wind', A('combo', 2, 'wind', 0)], ['blade 3 hit', A('combo', 2, 'active', 0.05)],
    ['hammer 1', A('combo', 0, 'active', 0.05, 'hammer')], ['hammer 2', A('combo', 1, 'active', 0.05, 'hammer')], ['whip 1', A('combo', 0, 'active', 0.05, 'whip')], ['whip 3', A('combo', 2, 'active', 0.08, 'whip')], ['bow', A('combo', 0, 'active', 0.01, 'bow')],
    ['heavy wind', A('heavy', 0, 'wind', 0)], ['heavy hit', A('heavy', 0, 'active', 0.08)], ['air atk', () => { A('air', 0, 'active', 0.05)(); P.onGround = false; }], ['plunge', () => { A('plunge', 0, 'active', 0.05)(); P.onGround = false; }],
    ['parry', () => { P.parryLock = 0.2; P.parryT = 0.1; }], ['hurt', () => { P.hurtT = 0.2; P.flash = 0.05; }], ['dead', () => { P.dead = true; P.deadT = 0.6; }], ['facing left', () => { P.face = -1; P.vx = -200; P.runPh = 1; }]);
  const cols = 10, cw = 64, chh = 84, rows = Math.ceil(poses.length / cols);
  const c = document.createElement('canvas'); c.width = cols * cw * rs; c.height = rows * chh * rs; const g = c.getContext('2d'); g.fillStyle = '#3c4656'; g.fillRect(0, 0, c.width, c.height);
  const out = [];
  poses.forEach(([n, fn], i) => { const cx = (i % cols) * cw, cy = Math.floor(i / cols) * chh;
    Object.assign(P, { atk: null, dashT: 0, hurtT: 0, flash: 0, dead: false, deadT: 0, vx: 0, vy: 0, onGround: true, iframes: 0, chargeT: 0, parryLock: 0, parryT: 0, face: 1, sx: 1, sy: 1, t: 0.5, wallDir: 0, mantleT: 0, weapon: 'blade' }); P.hook = { s: 'none' }; fn();
    g.setTransform(rs, 0, 0, rs, 0, 0); g.fillStyle = '#2a3140'; g.fillRect(cx + 2, cy + 66, cw - 4, 2); g.fillStyle = '#e8e8c0'; g.font = '7px sans-serif'; g.fillText(n, cx + 3, cy + 9);
    g.setTransform(rs, 0, 0, rs, (cx + cw / 2 - P.cx) * rs, (cy + 66 - P.y - P.h) * rs); try { P.draw(g, W); } catch (e) { out.push(n + ': ' + e.message); } });
  Gx.hero = keep; return { url: c.toDataURL(), out }; }, process.argv.includes('--rig'));
fs.writeFileSync(process.argv[2] || '/tmp/anim.png', Buffer.from(data.url.split(',')[1], 'base64'));
console.log('errs', errs, data.out); await browser.close(); server.close();
