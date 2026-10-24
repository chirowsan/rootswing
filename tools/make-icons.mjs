// Procedurally draws the Rootswing app icon (sprout hero + vine hook) with a headless canvas.
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
import { launch } from './lib.mjs';
const { browser, page } = await launch({ dpr: 1 });
const out = await page.evaluate(() => {
  function draw(S, pad) {
    const c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); const k = S / 512;
    const bg = g.createLinearGradient(0, 0, 0, S); bg.addColorStop(0, '#3b3a78'); bg.addColorStop(0.6, '#c46b7a'); bg.addColorStop(1, '#ffc46b'); g.fillStyle = bg; g.fillRect(0, 0, S, S);
    g.save(); g.translate(S / 2, S / 2); g.scale(k * pad, k * pad); g.translate(-256, -256);
    const sun = g.createRadialGradient(256, 330, 0, 256, 330, 240); sun.addColorStop(0, 'rgba(255,240,180,0.8)'); sun.addColorStop(1, 'rgba(255,240,180,0)'); g.fillStyle = sun; g.fillRect(0, 0, 512, 512);
    g.fillStyle = '#2a2550'; g.fillRect(0, 380, 512, 132); g.fillRect(60, 250, 40, 140); g.fillRect(410, 230, 44, 160); g.fillRect(40, 220, 440, 34);
    // vine rope to anchor ring
    g.strokeStyle = '#7ad36a'; g.lineWidth = 12; g.lineCap = 'round'; g.beginPath(); g.moveTo(370, 110); g.quadraticCurveTo(330, 200, 262, 250); g.stroke();
    g.strokeStyle = '#ffd25a'; g.lineWidth = 16; g.beginPath(); g.arc(380, 96, 30, 0, Math.PI * 2); g.stroke();
    // hero body (green hood)
    g.fillStyle = '#15131f'; g.beginPath(); g.ellipse(250, 330, 70, 90, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4fbf5a'; g.beginPath(); g.ellipse(250, 330, 60, 80, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#15131f'; g.beginPath(); g.arc(250, 255, 62, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#6fe07a'; g.beginPath(); g.arc(250, 255, 54, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffe7c7'; g.beginPath(); g.ellipse(262, 262, 36, 30, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#15131f'; g.beginPath(); g.arc(250, 258, 7, 0, 7); g.arc(280, 258, 7, 0, 7); g.fill();
    // sprout leaf
    g.strokeStyle = '#15131f'; g.lineWidth = 8; g.beginPath(); g.moveTo(244, 200); g.quadraticCurveTo(240, 170, 250, 150); g.stroke();
    g.fillStyle = '#9cf06a'; g.beginPath(); g.moveTo(250, 160); g.quadraticCurveTo(300, 130, 316, 160); g.quadraticCurveTo(280, 180, 250, 160); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(246, 168); g.quadraticCurveTo(200, 150, 190, 176); g.quadraticCurveTo(222, 190, 246, 168); g.fill(); g.stroke();
    g.restore(); return c.toDataURL('image/png');
  }
  return { a: draw(192, 1), b: draw(512, 1), f: draw(432, 0.72) };
});
const w = (n, d) => fs.writeFileSync(path.join(root, 'assets', n), Buffer.from(d.split(',')[1], 'base64'));
w('icon-192.png', out.a); w('icon-512.png', out.b); w('icon-foreground-432.png', out.f);
await browser.close(); console.log('icons written');
