// v1.1 painted rendering: parallax, foreground occluders, textured tiles, atmosphere (fog, shafts, particles, grade).
import { G, pattern } from './gfx.js';
import { TILE, clamp } from './util.js';
import { PAL, drawGlow, CHUNK_T, isSolidCh } from './art.js';
const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
// parallax sets per biome: [image, parallax factor, zoom, extra y (fraction of screen)]
const SETS = {
  overpass: { sky: 'ov_sky', layers: [['ov_far', 0.06, 1.0, 0.02], ['ov_mid', 0.16, 1.0, 0.06], ['ov_near', 0.34, 0.95, 0.12]], fg: 'fg_vines', deep: '44,54,86', dim: 'rgba(14,18,38,0.36)', haze: 'rgba(255,190,130,0.10)', fog: '255,200,150', mote: '#f2ffb8', moteG: -12 },
  hub: { sky: 'hub_sky', layers: [['hub_mid', 0.14, 1.0, 0.05], ['hub_near', 0.32, 0.95, 0.12]], fg: 'fg_vines', deep: '40,60,72', dim: 'rgba(12,22,34,0.32)', haze: 'rgba(255,226,170,0.08)', fog: '255,230,180', mote: '#fff2c0', moteG: -6 },
  boss: { sky: 'boss_sky', layers: [['boss_mid', 0.14, 1.0, 0.04], ['boss_near', 0.3, 0.95, 0.10]], fg: null, deep: '52,30,52', dim: 'rgba(16,10,24,0.28)', haze: 'rgba(255,120,70,0.10)', fog: '255,140,90', mote: '#ffb13b', moteG: -40 },
};
export const setFor = (B) => SETS[B.key] || SETS.overpass;
export const paintedOK = () => G.ready && !!G.img.ov_sky;
function tileLayer(g, img, f, camx, rs, cw, y, h, flipAlt = true) {
  const w = img.width * h / img.height; let ox = -((camx * f * rs) % (2 * w)); if (ox > 0) ox -= 2 * w;
  for (let x = ox, i = 0; x < cw; x += w, i++) {
    if (i % 2 && flipAlt) { g.save(); g.translate(x + w, y); g.scale(-1, 1); g.drawImage(img, 0, 0, w + 1, h); g.restore(); }
    else g.drawImage(img, x, y, w + 1, h);
  }
}
export function drawPaintedBg(W, g, cw, ch, rs, camx, camy, lo) {
  const S = setFor(W.biome), M = G.meta.bg; const vy = camy - (W.map.h * TILE - (W.viewH || 340));
  g.setTransform(1, 0, 0, 1, 0, 0);
  // sky: cover the screen, gentle parallax
  const sky = G.img[S.sky], sh = ch * 1.08; tileLayer(g, sky, 0.02, camx, rs, cw, -ch * 0.04 - clamp(vy * 0.01 * rs, -ch * 0.04, ch * 0.04), sh);
  if (!lo) drawShafts(W, g, cw, ch, rs, camx, S, 0.6);
  for (const [n, f, zoom, dy] of S.layers) {
    const img = G.img[n]; if (!img) continue; const m = M[n]; const s = ch / m.h * zoom, h = img.height * s;
    const y = ch - (m.h - m.top) * s + (m.ih - img.height) * s + ch * dy - clamp(vy * f * rs * 0.25, -ch * 0.25, ch * 0.25);
    tileLayer(g, img, f, camx, rs, cw, y, h);
    // v1.2 atmospheric depth: a cool fog veil after every layer so distance reads as haze, not detail
    const dk = S.deep || '40,48,78', fa = f < 0.1 ? 0.22 : f < 0.2 ? 0.18 : 0;
    if (!fa) continue; if (lo) { g.fillStyle = `rgba(${dk},${fa})`; g.fillRect(0, 0, cw, ch); }
    else { const fg = g.createLinearGradient(0, 0, 0, ch); fg.addColorStop(0, `rgba(${dk},${fa * 0.6})`); fg.addColorStop(0.7, `rgba(${dk},${fa * 1.3})`); fg.addColorStop(1, `rgba(${dk},${fa})`); g.fillStyle = fg; g.fillRect(0, 0, cw, ch); }
  }
  if (!lo) { g.fillStyle = S.haze; g.fillRect(0, ch * 0.45, cw, ch * 0.55); drawFog(W, g, cw, ch, rs, camx, S, 0.55); }
  g.fillStyle = S.dim; g.fillRect(0, 0, cw, ch);
}
function drawShafts(W, g, cw, ch, rs, camx, S, a) {
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const x = (((i * 0.29 + 0.1) * cw - camx * rs * 0.04) % (cw * 1.3) + cw * 1.3) % (cw * 1.3) - cw * 0.15, w = cw * (0.05 + (i % 2) * 0.05);
    const k = 0.5 + 0.5 * Math.sin(W.t * 0.4 + i * 1.7); const gr = g.createLinearGradient(0, 0, 0, ch); gr.addColorStop(0, `rgba(${S.fog},${0.13 * a * k})`); gr.addColorStop(1, `rgba(${S.fog},0)`);
    g.fillStyle = gr; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w + cw * 0.22, ch); g.lineTo(x + cw * 0.22, ch); g.fill();
  }
  g.globalCompositeOperation = 'source-over';
}
function drawFog(W, g, cw, ch, rs, camx, S, a) {
  const gr = g.createLinearGradient(0, ch * 0.55, 0, ch); gr.addColorStop(0, `rgba(${S.fog},0)`); gr.addColorStop(1, `rgba(${S.fog},${0.16 * a})`);
  g.fillStyle = gr; g.fillRect(0, ch * 0.55, cw, ch * 0.45);
}
// foreground: top-hanging vines at parallax > 1 (never over the play band); drawn after the world
export function drawForeground(W, g, cw, ch, rs, camx, camy) {
  const S = setFor(W.biome); if (!S.fg) return; const img = G.img[S.fg]; if (!img) return;
  const h = ch * 0.2; g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 0.92; tileLayer(g, img, 1.25, camx, rs, cw, -h * 0.25 - clamp((camy % 600) * 0.05 * rs, 0, h * 0.25), h); g.globalAlpha = 1;
}
// ambient motes in world space (pollen / dust / embers) — cheap, deterministic, no allocation
export function drawMotes(W, g, vx0, vx1, vy0, vy1) {
  const S = setFor(W.biome), t = W.t; g.globalCompositeOperation = 'lighter'; g.fillStyle = S.mote;
  const span = 900, n = 46;
  for (let i = 0; i < n; i++) {
    const r1 = hash2(i, 1), r2 = hash2(i, 2), r3 = hash2(i, 3);
    const baseX = vx0 + ((r1 * span - (vx0 * 0.3) % span + span * 2) % span) * ((vx1 - vx0) / span);
    const x = baseX + Math.sin(t * (0.5 + r2) + i) * 14, yy = ((r2 * 400 + t * S.moteG * (0.6 + r3)) % 400 + 400) % 400, y = vy0 + yy * (vy1 - vy0) / 400;
    g.globalAlpha = 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 2 + i * 3)); const s = 0.8 + r3 * 1.4; g.fillRect(x, y, s, s);
  }
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
}
// subtle split-tone grade + vignette (screen space)
export function drawGrade(W, g, cw, ch) {
  const B = W.biome; if (!W._grade || W._gradeW !== cw || W._gradeH !== ch) {
    const v = g.createRadialGradient(cw / 2, ch * 0.45, ch * 0.35, cw / 2, ch / 2, cw * 0.72); v.addColorStop(0, 'rgba(8,6,18,0)'); v.addColorStop(1, 'rgba(8,6,18,0.5)');
    const top = g.createLinearGradient(0, 0, 0, ch); top.addColorStop(0, B.key === 'boss' ? 'rgba(255,90,40,0.06)' : 'rgba(255,190,120,0.06)'); top.addColorStop(1, 'rgba(20,80,90,0.07)');
    W._grade = [top, v]; W._gradeW = cw; W._gradeH = ch;
  }
  g.fillStyle = W._grade[0]; g.fillRect(0, 0, cw, ch); g.fillStyle = W._grade[1]; g.fillRect(0, 0, cw, ch);
}
// ---------- textured tile chunks ----------
export function renderPaintedChunk(map, cx, cy, rs, biome) {
  const Wd = CHUNK_T * TILE, c = document.createElement('canvas');
  c.width = Math.ceil(Wd * rs); c.height = Math.ceil(Wd * rs); const g = c.getContext('2d');
  g.scale(rs, rs); g.translate(-cx * Wd, -cy * Wd);
  const x0 = cx * CHUNK_T, y0 = cy * CHUNK_T, at = (x, y) => map.get(x, y), S = (x, y) => isSolidCh(at(x, y));
  const boss = biome.key === 'boss';
  const pStone = pattern(g, boss ? 'tex_metal' : 'tex_stone', boss ? 0.36 : 0.5), pRoot = pattern(g, 'tex_root', 0.4);
  const path = (X, Y, tl, tr, br, bl) => { g.beginPath(); g.moveTo(X + tl, Y); g.lineTo(X + TILE - tr, Y); g.quadraticCurveTo(X + TILE, Y, X + TILE, Y + tr); g.lineTo(X + TILE, Y + TILE - br); g.quadraticCurveTo(X + TILE, Y + TILE, X + TILE - br, Y + TILE); g.lineTo(X + bl, Y + TILE); g.quadraticCurveTo(X, Y + TILE, X, Y + TILE - bl); g.lineTo(X, Y + tl); g.quadraticCurveTo(X, Y, X + tl, Y); g.closePath(); };
  const each = (fn) => { for (let ty = y0 - 1; ty < y0 + CHUNK_T + 1; ty++) for (let tx = x0 - 1; tx < x0 + CHUNK_T + 1; tx++) { const ch = at(tx, ty); if (isSolidCh(ch)) fn(tx, ty, ch); } };
  const corners = (tx, ty) => { const up = !S(tx, ty - 1), dn = !S(tx, ty + 1), lf = !S(tx - 1, ty), rt = !S(tx + 1, ty), r = 6; return [up, dn, lf, rt, up && lf ? r : 0, up && rt ? r : 0, dn && rt ? r : 0, dn && lf ? r : 0]; };
  // ink rim
  each((tx, ty) => { const [up, dn, lf, rt, a, b, cc, d] = corners(tx, ty); if (!(up || dn || lf || rt)) return; g.fillStyle = g.strokeStyle = PAL.ink; path(tx * TILE, ty * TILE, a, b, cc, d); g.lineWidth = 4; g.stroke(); });
  // textured fill
  each((tx, ty, ch) => { const [, , , , a, b, cc, d] = corners(tx, ty); g.fillStyle = ch === 'B' ? pRoot : pStone; path(tx * TILE, ty * TILE, a, b, cc, d); g.fill(); });
  // depth shading + edge light
  each((tx, ty, ch) => {
    const X = tx * TILE, Y = ty * TILE, [up, dn, lf, rt] = corners(tx, ty), dU = up ? 0 : !S(tx, ty - 2) ? 1 : !S(tx, ty - 3) ? 2 : 3;
    const side = Math.min(lf || rt ? 0 : (!S(tx - 2, ty) || !S(tx + 2, ty)) ? 1 : 2, 2);
    const k = Math.min(0.62, dU * 0.14 + side * 0.08 + (boss ? 0.1 : 0.04)); g.fillStyle = `rgba(12,10,26,${k})`; g.fillRect(X, Y, TILE, TILE);
    if (ch === 'B') { g.strokeStyle = 'rgba(255,230,170,0.7)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(X + 4, Y + 3); g.lineTo(X + 11, Y + 11); g.lineTo(X + 7, Y + 18); g.moveTo(X + 11, Y + 11); g.lineTo(X + 20, Y + 9); g.moveTo(X + 13, Y + 14); g.lineTo(X + 17, Y + 21); g.stroke(); }
    if (up) { const gr = g.createLinearGradient(0, Y, 0, Y + 8); gr.addColorStop(0, boss ? 'rgba(255,150,90,0.35)' : 'rgba(255,214,160,0.28)'); gr.addColorStop(1, 'rgba(255,214,160,0)'); g.fillStyle = gr; g.fillRect(X, Y, TILE, 8); }
    if (rt) { g.fillStyle = boss ? 'rgba(255,140,80,0.16)' : 'rgba(255,200,140,0.14)'; g.fillRect(X + TILE - 3, Y, 3, TILE); }
    if (lf) { g.fillStyle = 'rgba(60,200,200,0.08)'; g.fillRect(X, Y, 3, TILE); }
    if (dn) { g.fillStyle = 'rgba(5,4,12,0.4)'; g.fillRect(X, Y + TILE - 4, TILE, 4); }
    const h = hash2(tx, ty);
    if (!up && h > 0.93 && !boss) { drawGlow(g, X + 12, Y + 12, 7, '#5ff0d8', 0.55); g.fillStyle = '#bffff2'; g.fillRect(X + 11, Y + 11, 2, 2); } // bioluminescent speck
    if (dn && h > 0.5) { g.strokeStyle = '#1d3a2a'; g.lineWidth = 2.4; g.lineCap = 'round'; const rx = X + 4 + h * 14; g.beginPath(); g.moveTo(rx, Y + TILE - 1); g.bezierCurveTo(rx + 4, Y + TILE + 5, rx - 3, Y + TILE + 9, rx + 1, Y + TILE + 8 + h * 12); g.stroke(); g.strokeStyle = '#3f7a4a'; g.lineWidth = 1; g.stroke(); if (h > 0.8) { g.fillStyle = '#5fbf5a'; g.beginPath(); g.ellipse(rx + 1, Y + TILE + 8 + h * 12, 2.6, 1.4, 0.6, 0, 7); g.fill(); } }
  });
  // moss caps from the painted strip, in runs of top tiles
  const m = G.spr.moss;
  for (let ty = y0 - 1; ty < y0 + CHUNK_T + 1; ty++) {
    let tx = x0 - 2;
    while (tx < x0 + CHUNK_T + 2) {
      const top = (x) => isSolidCh(at(x, ty)) && !S(x, ty - 1) && at(x, ty - 1) !== '^';
      if (!top(tx)) { tx++; continue; }
      let e = tx; while (top(e + 1)) e++;
      const X0 = tx * TILE, X1 = (e + 1) * TILE, Y = ty * TILE, mh = boss ? 11 : 15, mw = m ? m[2] * mh / m[3] : 0;
      if (m) {
        g.save(); g.beginPath(); g.rect(X0 - (S(tx - 1, ty) ? 0 : 1), Y - mh, X1 - X0 + 2, mh * 2); g.clip();
        if (boss) g.filter = 'saturate(0.55) brightness(0.8)';
        const start = Math.floor(X0 / mw) * mw - hash2(ty, 9) * 0;
        for (let x = start; x < X1; x += mw) g.drawImage(G.atlas, m[0], m[1], m[2], m[3], x, Y - mh * 0.32, mw + 0.5, mh);
        g.restore(); g.filter = 'none';
      }
      tx = e + 1;
    }
  }
  // one-way planks (rusty metal + wood)
  for (let ty = y0; ty < y0 + CHUNK_T; ty++) for (let tx = x0; tx < x0 + CHUNK_T; tx++) {
    if (at(tx, ty) !== '=') continue; const X = tx * TILE, Y = ty * TILE;
    g.fillStyle = PAL.ink; g.fillRect(X - 1, Y - 1, TILE + 2, 10);
    const wg = g.createLinearGradient(0, Y, 0, Y + 7); wg.addColorStop(0, '#d9a066'); wg.addColorStop(0.3, '#a8713f'); wg.addColorStop(1, '#5c3a24'); g.fillStyle = wg; g.fillRect(X, Y, TILE, 7);
    g.fillStyle = 'rgba(40,20,10,0.35)'; g.fillRect(X + 7 + hash2(tx, ty) * 6, Y + 2, 6, 1); g.fillStyle = '#3a2a24'; g.fillRect(X + TILE - 1.5, Y, 1.5, 7);
    g.fillStyle = '#8a8a96'; g.beginPath(); g.arc(X + 3, Y + 3.5, 1, 0, 7); g.arc(X + TILE - 4, Y + 3.5, 1, 0, 7); g.fill();
    if (at(tx - 1, ty) !== '=') { g.strokeStyle = '#4a3a3a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(X + 3, Y); g.lineTo(X + 3, Y - 30); g.stroke(); }
    if (at(tx + 1, ty) !== '=') { g.strokeStyle = '#4a3a3a'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(X + TILE - 3, Y); g.lineTo(X + TILE - 3, Y - 30); g.stroke(); }
  }
  return c;
}
