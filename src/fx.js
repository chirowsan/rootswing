// Particles, floating text, screen shake, flashes.
import { rand } from './util.js';
import { drawGlow } from './art.js';
import { save } from './save.js';
export class FX {
  constructor() { this.p = []; this.texts = []; this.trauma = 0; this.flash = 0; this.flashColor = '#fff'; this.rings = []; }
  shake(amount) { const m = save.settings.shake === 'off' ? 0 : save.settings.shake === 'reduced' ? 0.45 : 1; const a = amount * m; this.trauma = Math.min(0.85, Math.max(this.trauma, a) + a * 0.3); } // v2.0: controlled shake (big hits don't stack into a blur)
  burst(x, y, n, o = {}) {
    if (this.p.length > (this.cap || 650)) n = Math.min(n, 3); else if (this.p.length > (this.cap || 650) * 0.7) n = Math.ceil(n * 0.5); // v2.0: soft cap for mid-range phones
    for (let i = 0; i < n; i++) {
      const a = o.angle !== undefined ? o.angle + rand.range(-(o.spread || 3.14), o.spread || 3.14) : rand.range(0, Math.PI * 2);
      const sp = rand.range(o.min || 40, o.max || 220);
      this.p.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0), life: rand.range(o.life ? o.life * 0.6 : 0.3, o.life || 0.6), t: 0, size: rand.range(o.size ? o.size * 0.6 : 2, o.size || 4), color: Array.isArray(o.color) ? rand.pick(o.color) : o.color || '#fff', g: o.g ?? 500, drag: o.drag ?? 2, glow: o.glow || 0, kind: o.kind || 'dot', rot: rand.range(0, 6), vr: rand.range(-8, 8) });
    }
  }
  // v1.4 death: break the enemy's last drawn frame into spinning shards (d = {img, f:[x,y,w,h], k, x, y (top-left world), flip})
  shatter(d, n = 3, power = 1) {
    if (!d || this.p.length > 600) return; const [fx, fy, fw, fh] = d.f, cw = fw / n, ch = fh / n, cx = d.x + fw * d.k / 2, cy = d.y + fh * d.k / 2;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const lx = d.flip ? n - 1 - i : i, wx = d.x + (lx + 0.5) * cw * d.k, wy = d.y + (j + 0.5) * ch * d.k, a = Math.atan2(wy - cy, wx - cx), sp = (90 + Math.random() * 150) * power;
      this.p.push({ kind: 'shard', img: d.img, sx: fx + i * cw, sy: fy + j * ch, sw: cw, sh: ch, w: cw * d.k, h: ch * d.k, flip: d.flip, x: wx, y: wy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 160 * power, g: 700, drag: 1.2, life: 0.55 + Math.random() * 0.3, t: 0, rot: 0, vr: (Math.random() - 0.5) * 16, size: 1, color: '#000', glow: 0 });
    }
  }
  ring(x, y, r, color = '#fff', life = 0.35, width = 4) { this.rings.push({ x, y, r, color, life, t: 0, width }); }
  text(x, y, s, color = '#fff', size = 14) { // v2.0: same word nearby refreshes instead of piling up; overlapping words stack upward
    if (!s) return; for (const t of this.texts) if (!t.dmg && t.s === s && Math.abs(t.x - x) < 60 && Math.abs(t.y - y) < 40 && t.t < 0.5) { t.t = 0.05; t.x = x; t.bump = 1; return; }
    const near = this.texts.filter((t) => Math.abs(t.x - x) < 70 && t.t < 0.6 && Math.abs(t.y - y) < 50);
    const nw = near.filter((t) => !t.dmg); if (nw.length >= 2) { const old = nw[0]; this.texts.splice(this.texts.indexOf(old), 1); } // max 2 callouts per spot
    let top = y; for (const t of near) top = Math.min(top, t.y - (t.dmg ? t.size + 6 : 0) - (t.dmg ? 0 : t.size + 5)); // stack above numbers + words (no overlap)
    size *= (globalThis.RS_A11Y && RS_A11Y.tk) || 1; this.texts.push({ x, y: Math.max(top, y - 64), s, color, size, t: 0, life: 0.8 });
    const words = this.texts.filter((t) => !t.dmg); if (words.length > 8) this.texts.splice(this.texts.indexOf(words[0]), 1); }
  liftWords(x, y, size) { let top = y - size - 14; const ws = this.texts.filter((w) => !w.dmg && Math.abs(w.x - x) < 80 && w.t < 0.6 && w.y > y - size - 30 - 60).sort((a, b) => b.y - a.y); for (const w of ws) { const h = (w.size || 14); if (w.y > top - h * 0.5) w.y = top - h * 0.5; top = w.y - h - 5; } } // v2.0: callout words never sit under a number or each other
  // v1.3 juice: styled damage number - pops in with overshoot, drifts sideways, heavy hits get a warm gradient + spark
  dmg(x, y, n, o = {}) { const heavy = !!o.heavy, gold = !!o.gold;
    if (o.key) { const t = this.texts.find((q) => q.dmg && q.key === o.key && q.t < 0.55); // v2.0: hits on the same foe merge into one growing number
      if (t) { t.n += n; t.hits++; t.s = String(t.n); t.x = x; t.y = y; t.t = 0.06; t.bump = 1; t.heavy = t.heavy || heavy || t.n >= 30; t.gold = t.gold || gold; t.crit = t.crit || o.crit; t.tag = o.tag || t.tag; t.size = (12.5 + Math.min(13, Math.sqrt(t.n) * 1.5)) * ((globalThis.RS_A11Y && RS_A11Y.tk) || 1); t.color = t.gold ? '#ffe27a' : t.heavy ? '#ffb347' : '#fff'; t.life = t.heavy ? 0.95 : 0.8; this.liftWords(x, y, t.size); return; } }
    this.liftWords(x, y, 12.5 + Math.min(13, Math.sqrt(n) * 1.5) + (heavy ? 2 : 0));
    if (this.texts.filter((q) => q.dmg).length > 10) this.texts.splice(this.texts.findIndex((q) => q.dmg), 1);
    this.texts.push({ key: o.key, n, hits: 1, crit: !!o.crit, tag: o.tag, bump: 0, x, y, s: String(n), color: gold ? '#ffe27a' : heavy ? '#ffb347' : '#fff', size: (12.5 + Math.min(13, Math.sqrt(n) * 1.5) + (heavy ? 2 : 0)) * ((globalThis.RS_A11Y && RS_A11Y.tk) || 1), t: 0, life: heavy ? 0.95 : 0.8, dmg: 1, heavy, gold, vx: (o.dir || (Math.random() < 0.5 ? -1 : 1)) * (14 + Math.random() * 12) }); }
  // soft dust puffs (landing / running): grow + fade, drawn as layered translucent circles
  dust(x, y, n, o = {}) {
    if (this.p.length > (this.cap || 650)) return;
    for (let i = 0; i < n; i++) { const dir = o.dir !== undefined ? o.dir : (i % 2 ? 1 : -1); const sp = (o.speed || 60) * (0.5 + Math.random() * 0.7);
      this.p.push({ x: x + dir * Math.random() * 4, y: y - 1 - Math.random() * 2, vx: dir * sp, vy: -(o.rise || 14) * (0.4 + Math.random()), life: (o.life || 0.45) * (0.7 + Math.random() * 0.5), t: 0, size: (o.size || 4) * (0.7 + Math.random() * 0.6), color: o.color || '#d8cdb4', g: -10, drag: 5, glow: 0, kind: 'puff', rot: 0, vr: 0 }); }
  }
  pop(x, y, scale = 1) { // cartoon enemy pop: ink blobs + sparks + stars, no gore
    this.burst(x, y, 14 * scale, { color: ['#7d5cff', '#a58bff', '#3b2a6b'], min: 60, max: 260 * scale, size: 7 * scale, life: 0.7, g: 300, kind: 'blob' });
    this.burst(x, y, 12 * scale, { color: ['#ffd36b', '#fff4c0', '#ffb13b'], min: 120, max: 380 * scale, size: 3.5, life: 0.5, g: 200, glow: 1, kind: 'spark' });
    this.burst(x, y, 4, { color: ['#fff6d8'], min: 40, max: 120, size: 7, life: 0.8, g: -40, kind: 'star' });
    this.ring(x, y, 34 * scale, '#e9dcff', 0.3, 5);
    // glimmer arcs: curved light streaks sweeping outward (v1.3)
    const na = 5 + 2 * scale, a0 = Math.random() * 6.28;
    for (let i = 0; i < na; i++) { const a = a0 + i * 6.283 / na; this.p.push({ x, y, vx: 0, vy: 0, life: 0.42 + Math.random() * 0.12, t: 0, size: 3, color: i % 2 ? '#ffe9a0' : '#fff6d8', g: 0, drag: 0, glow: 0, kind: 'arc', rot: a, vr: (i % 2 ? 1 : -1) * 3.2, r0: 6, r1: (30 + Math.random() * 14) * scale }); }
    this.burst(x, y, 6 * scale, { color: ['#fff2a8', '#ffd36b'], min: 30, max: 90, size: 2.5, life: 0.9, g: -30, glow: 1, kind: 'dot' });
  }
  update(dt) {
    this.trauma = Math.max(0, this.trauma - dt * 1.8); this.flash = Math.max(0, this.flash - dt * 4);
    for (const q of this.p) { q.t += dt; q.vy += q.g * dt; q.vx *= 1 - q.drag * dt; q.vy *= 1 - q.drag * 0.5 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; }
    this.p = this.p.filter((q) => q.t < q.life);
    for (const r of this.rings) r.t += dt; this.rings = this.rings.filter((r) => r.t < r.life);
    for (const t of this.texts) { t.t += dt; if (t.bump) t.bump = Math.max(0, t.bump - dt * 7); } this.texts = this.texts.filter((t) => t.t < t.life);
  }
  shakeOffset(time) { const s = this.trauma * this.trauma * 9; return [Math.sin(time * 61.3) * s, Math.cos(time * 47.9) * s]; }
  draw(g) {
    for (const q of this.p) {
      const k = 1 - q.t / q.life; g.globalAlpha = Math.min(1, k * 1.5); g.fillStyle = q.color;
      if (q.kind === 'shard' && !q.img) { g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.beginPath(); g.moveTo(-q.size, -q.size * 0.4); g.lineTo(q.size * 0.9, -q.size * 0.7); g.lineTo(q.size * 0.3, q.size * 0.8); g.closePath(); g.fill(); g.restore(); continue; } // v2.0 plain rock/armor chips
      if (q.kind === 'shard') { g.globalAlpha = Math.min(1, k * 2.2); g.save(); g.translate(q.x, q.y); g.rotate(q.rot); if (q.flip) g.scale(-1, 1); g.drawImage(q.img, q.sx, q.sy, q.sw, q.sh, -q.w / 2, -q.h / 2, q.w, q.h); g.restore(); continue; }
      if (q.kind === 'puff') { const e = q.t / q.life; g.globalAlpha = 0.42 * (1 - e) * (1 - e); const r = q.size * (0.6 + e * 1.6); g.beginPath(); g.arc(q.x, q.y, r, 0, 7); g.arc(q.x + r * 0.7, q.y + r * 0.2, r * 0.7, 0, 7); g.fill(); continue; }
      if (q.kind === 'arc') { const e = q.t / q.life, ee = 1 - (1 - e) * (1 - e), R = q.r0 + (q.r1 - q.r0) * ee, a = q.rot + q.vr * e * 0.35; g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = (1 - e) * 0.95; g.strokeStyle = q.color; g.lineCap = 'round'; g.lineWidth = q.size * (1 - e) + 0.6; g.beginPath(); g.arc(q.x, q.y, R, a, a + 0.75 * Math.sign(q.vr), q.vr < 0); g.stroke(); g.globalAlpha *= 0.35; g.lineWidth *= 3; g.stroke(); g.restore(); continue; }
      if (q.kind === 'spark') { g.save(); g.globalCompositeOperation = 'lighter'; g.translate(q.x, q.y); g.rotate(Math.atan2(q.vy, q.vx)); const L = q.size * (1.8 + Math.min(2, Math.hypot(q.vx, q.vy) / 150)); g.beginPath(); g.moveTo(-L, 0); g.lineTo(0, -q.size * 0.45); g.lineTo(L * 0.6, 0); g.lineTo(0, q.size * 0.45); g.fill(); g.fillStyle = '#fff8e0'; g.fillRect(-L * 0.5, -q.size * 0.12, L, q.size * 0.24); g.restore(); }
      else if (q.kind === 'star') { g.save(); g.translate(q.x, q.y); g.rotate(q.rot); const s = q.size * k; g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.4 : s; g.lineTo(Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r); } g.fill(); g.restore(); }
      else if (q.kind === 'leaf') { g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.beginPath(); g.ellipse(0, 0, q.size, q.size * 0.45, 0, 0, 7); g.fill(); g.restore(); }
      else { g.beginPath(); g.arc(q.x, q.y, q.size * (q.kind === 'blob' ? 0.5 + k * 0.5 : k), 0, 7); g.fill(); }
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'lighter'; for (const q of this.p) if (q.glow) drawGlow(g, q.x, q.y, q.size * 4, q.color, 0.5 * (1 - q.t / q.life));
    for (const r of this.rings) { const k = r.t / r.life; g.globalAlpha = 1 - k; g.strokeStyle = r.color; g.lineWidth = r.width * (1 - k) + 0.5; g.beginPath(); g.arc(r.x, r.y, r.r * (0.3 + k * 0.9), 0, 7); g.stroke(); }
    g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    g.textAlign = 'center'; g.lineJoin = 'round';
    for (const t of this.texts) { const k = t.t / t.life;
      if (t.dmg) { // styled damage number
        const pop = k < 0.12 ? 0.4 + (k / 0.12) * 1.0 : k < 0.24 ? 1.4 - ((k - 0.12) / 0.12) * 0.4 : 1, x = t.x + t.vx * Math.sqrt(k), y = t.y - 22 * Math.sqrt(k) + (k > 0.6 ? (k - 0.6) * 18 : 0);
        const pb = pop * (1 + (t.bump || 0) * 0.35); g.save(); g.translate(x, y); g.scale(pb, pb); if (t.heavy) g.rotate(-0.08); g.globalAlpha = k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1;
        g.font = `900 ${t.size}px system-ui,sans-serif`; g.lineWidth = t.heavy ? 5.5 : 4.5; g.strokeStyle = '#15131f'; g.strokeText(t.s, 0, 0);
        const gr = g.createLinearGradient(0, -t.size * 0.8, 0, t.size * 0.1); gr.addColorStop(0, '#fffdf2'); gr.addColorStop(1, t.color); g.fillStyle = t.heavy || t.gold ? gr : t.color; g.fillText(t.s, 0, 0);
        if (t.crit || t.tag) { g.font = `italic 900 ${8.5}px system-ui,sans-serif`; g.lineWidth = 3; const tg = t.tag || 'CRIT'; g.strokeText(tg, 0, -t.size * 0.82); g.fillStyle = '#ffe27a'; g.fillText(tg, 0, -t.size * 0.82); g.font = `900 ${t.size}px system-ui,sans-serif`; }
        if (t.hits > 1 && (t.bump || 0) > 0) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = t.bump * 0.6; g.fillStyle = '#fff'; g.fillText(t.s, 0, 0); g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1; }
        if (t.heavy && k < 0.3) { g.globalCompositeOperation = 'lighter'; g.globalAlpha = (0.3 - k) * 3; g.fillStyle = '#ffd36b'; g.fillText(t.s, 0, 0); g.globalCompositeOperation = 'source-over'; }
        g.restore(); continue; } g.globalAlpha = 1 - k * k; g.font = `900 ${t.size * (1 + (t.bump || 0) * 0.3)}px system-ui,sans-serif`; const y = t.y - 26 * Math.sqrt(k); g.lineWidth = 4; g.strokeStyle = '#15131f'; g.strokeText(t.s, t.x, y); g.fillStyle = t.color; g.fillText(t.s, t.x, y); }
    g.globalAlpha = 1;
  }
}
