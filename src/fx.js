// Particles, floating text, screen shake, flashes.
import { rand } from './util.js';
import { drawGlow } from './art.js';
import { save } from './save.js';
export class FX {
  constructor() { this.p = []; this.texts = []; this.trauma = 0; this.flash = 0; this.flashColor = '#fff'; this.rings = []; }
  shake(amount) { const m = save.settings.shake === 'off' ? 0 : save.settings.shake === 'reduced' ? 0.45 : 1; this.trauma = Math.min(1, this.trauma + amount * m); }
  burst(x, y, n, o = {}) {
    if (this.p.length > 650) n = Math.min(n, 3);
    for (let i = 0; i < n; i++) {
      const a = o.angle !== undefined ? o.angle + rand.range(-(o.spread || 3.14), o.spread || 3.14) : rand.range(0, Math.PI * 2);
      const sp = rand.range(o.min || 40, o.max || 220);
      this.p.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (o.up || 0), life: rand.range(o.life ? o.life * 0.6 : 0.3, o.life || 0.6), t: 0, size: rand.range(o.size ? o.size * 0.6 : 2, o.size || 4), color: Array.isArray(o.color) ? rand.pick(o.color) : o.color || '#fff', g: o.g ?? 500, drag: o.drag ?? 2, glow: o.glow || 0, kind: o.kind || 'dot', rot: rand.range(0, 6), vr: rand.range(-8, 8) });
    }
  }
  ring(x, y, r, color = '#fff', life = 0.35, width = 4) { this.rings.push({ x, y, r, color, life, t: 0, width }); }
  text(x, y, s, color = '#fff', size = 14) { this.texts.push({ x, y, s, color, size, t: 0, life: 0.8 }); }
  pop(x, y, scale = 1) { // cartoon enemy pop: ink blobs + sparks + stars, no gore
    this.burst(x, y, 14 * scale, { color: ['#7d5cff', '#a58bff', '#3b2a6b'], min: 60, max: 260 * scale, size: 7 * scale, life: 0.7, g: 300, kind: 'blob' });
    this.burst(x, y, 12 * scale, { color: ['#ffd36b', '#fff4c0', '#ffb13b'], min: 120, max: 380 * scale, size: 3.5, life: 0.5, g: 200, glow: 1, kind: 'spark' });
    this.burst(x, y, 4, { color: ['#fff6d8'], min: 40, max: 120, size: 7, life: 0.8, g: -40, kind: 'star' });
    this.ring(x, y, 34 * scale, '#e9dcff', 0.3, 5);
  }
  update(dt) {
    this.trauma = Math.max(0, this.trauma - dt * 1.8); this.flash = Math.max(0, this.flash - dt * 4);
    for (const q of this.p) { q.t += dt; q.vy += q.g * dt; q.vx *= 1 - q.drag * dt; q.vy *= 1 - q.drag * 0.5 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += q.vr * dt; }
    this.p = this.p.filter((q) => q.t < q.life);
    for (const r of this.rings) r.t += dt; this.rings = this.rings.filter((r) => r.t < r.life);
    for (const t of this.texts) t.t += dt; this.texts = this.texts.filter((t) => t.t < t.life);
  }
  shakeOffset(time) { const s = this.trauma * this.trauma * 9; return [Math.sin(time * 61.3) * s, Math.cos(time * 47.9) * s]; }
  draw(g) {
    for (const q of this.p) {
      const k = 1 - q.t / q.life; g.globalAlpha = Math.min(1, k * 1.5); g.fillStyle = q.color;
      if (q.kind === 'spark') { g.save(); g.translate(q.x, q.y); g.rotate(Math.atan2(q.vy, q.vx)); g.fillRect(-q.size * 1.8, -q.size * 0.35, q.size * 3.6, q.size * 0.7); g.restore(); }
      else if (q.kind === 'star') { g.save(); g.translate(q.x, q.y); g.rotate(q.rot); const s = q.size * k; g.beginPath(); for (let i = 0; i < 8; i++) { const r = i % 2 ? s * 0.4 : s; g.lineTo(Math.cos(i * Math.PI / 4) * r, Math.sin(i * Math.PI / 4) * r); } g.fill(); g.restore(); }
      else if (q.kind === 'leaf') { g.save(); g.translate(q.x, q.y); g.rotate(q.rot); g.beginPath(); g.ellipse(0, 0, q.size, q.size * 0.45, 0, 0, 7); g.fill(); g.restore(); }
      else { g.beginPath(); g.arc(q.x, q.y, q.size * (q.kind === 'blob' ? 0.5 + k * 0.5 : k), 0, 7); g.fill(); }
    }
    g.globalAlpha = 1;
    for (const q of this.p) if (q.glow) drawGlow(g, q.x, q.y, q.size * 4, q.color, 0.5 * (1 - q.t / q.life));
    for (const r of this.rings) { const k = r.t / r.life; g.globalAlpha = 1 - k; g.strokeStyle = r.color; g.lineWidth = r.width * (1 - k) + 0.5; g.beginPath(); g.arc(r.x, r.y, r.r * (0.3 + k * 0.9), 0, 7); g.stroke(); }
    g.globalAlpha = 1;
    g.textAlign = 'center'; g.lineJoin = 'round';
    for (const t of this.texts) { const k = t.t / t.life; g.globalAlpha = 1 - k * k; g.font = `900 ${t.size}px system-ui,sans-serif`; const y = t.y - 26 * Math.sqrt(k); g.lineWidth = 4; g.strokeStyle = '#15131f'; g.strokeText(t.s, t.x, y); g.fillStyle = t.color; g.fillText(t.s, t.x, y); }
    g.globalAlpha = 1;
  }
}
