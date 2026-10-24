// v1.1 painted rendering: parallax, foreground occluders, textured tiles, atmosphere (fog, shafts, particles, grade).
import { G, pattern } from './gfx.js';
import { TILE, clamp } from './util.js';
import { PAL, drawGlow, CHUNK_T, isSolidCh } from './art.js';
const hash2 = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
// parallax sets per biome: [image, parallax factor, zoom, extra y (fraction of screen)]
const SETS = {
  overpass: { sky: 'ov_sky', layers: [['ov_far', 0.06, 1.0, 0.02], ['ov_mid', 0.16, 1.0, 0.06], ['ov_near', 0.34, 0.95, 0.12]], fg: 'fg_vines', deep: '44,54,86', dim: 'rgba(14,18,38,0.36)', haze: 'rgba(255,190,130,0.10)', fog: '255,200,150', mote: '#f2ffb8', moteG: -12 },
  caverns: { sky: 'cv_sky', layers: [['cv_mid', 0.14, 1.0, 0.05], ['cv_near', 0.32, 0.95, 0.12]], fg: null, deep: '20,44,60', dim: 'rgba(6,16,26,0.34)', haze: 'rgba(90,230,220,0.07)', fog: '110,220,220', mote: '#9ff6ff', moteG: 8 },
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
  // v1.3 calmer boss arena: heavy dark veil over the busy factory art, then one warm focal pool behind the boss
  if (W.biome.key === 'boss') {
    g.fillStyle = 'rgba(14,8,22,0.42)'; g.fillRect(0, 0, cw, ch);
    const B = W.boss && !W.boss.dead ? W.boss : null, fx = B ? (B.cx - camx) * rs : cw * 0.65, fy = B ? (B.cy - camy) * rs : ch * 0.6, pulse = 0.85 + 0.15 * Math.sin(W.t * 1.6);
    const fr = g.createRadialGradient(fx, fy, 0, fx, fy, ch * 0.95); fr.addColorStop(0, `rgba(255,120,60,${0.26 * pulse})`); fr.addColorStop(0.45, 'rgba(160,50,40,0.1)'); fr.addColorStop(1, 'rgba(0,0,0,0)');
    g.globalCompositeOperation = 'lighter'; g.fillStyle = fr; g.fillRect(0, 0, cw, ch); g.globalCompositeOperation = 'source-over';
  }
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
const _toned = new Map();
function toned(m, filt) {
  const k = m.join(',') + (filt || ''); let c = _toned.get(k); if (c && c._v === G.ver) return c;
  c = document.createElement('canvas'); c.width = m[2]; c.height = m[3]; c._v = G.ver; const g = c.getContext('2d'); if (filt) g.filter = filt;
  g.drawImage(G.atlas, m[0], m[1], m[2], m[3], 0, 0, m[2], m[3]); _toned.set(k, c); return c;
}
// per-biome tile skin: fill texture, lip strip, hanging strip height, props [sprite, height, glow]
const SKIN = {
  overpass: { fill: 'tex_rock', fs: 0.3, lip: 'lip', lipH: 19, lipUp: 0.3, rim: 'rgba(255,236,170,0.55)', lipF: 'saturate(0.8) brightness(0.86)', hang: 42, propP: 0.16, propF: 'brightness(0.9)',
    props: [['d_mush', 15], ['d_fern', 18], ['d_rubble', 13], ['d_grass', 16], ['d_grass', 14], ['d_stump', 17], ['d_pillar', 26], ['d_lamp', 30, '#ffc070']] },
  caverns: { fill: 'tex_cave', fs: 0.3, tint: 'rgba(8,62,74,0.42)', lip: 'lip', lipH: 19, lipUp: 0.3, rim: 'rgba(140,255,240,0.5)', lipF: 'hue-rotate(95deg) saturate(1.35) brightness(1.0)', hang: 46, hangF: 'hue-rotate(60deg) brightness(0.8)', propP: 0.17, propF: 'hue-rotate(35deg) brightness(0.9)',
    props: [['d_mush', 16], ['d_crys', 18], ['d_fern', 16], ['d_rubble', 13], ['d_mush', 20], ['d_lamp', 28, '#7ff0ff'], ['d_crys', 22]] },
  hub: { fill: 'tex_rock', fs: 0.3, lip: 'lip', lipH: 19, lipUp: 0.3, rim: 'rgba(255,236,170,0.55)', lipF: 'saturate(0.85) brightness(0.92)', hang: 36, propP: 0.1, props: [['d_fern', 18], ['d_grass', 16], ['d_mush', 14]] },
  boss: { fill: 'tex_metal', fs: 0.36, lip: 'moss', lipH: 10, lipUp: 0.32, rim: 'rgba(255,150,90,0.4)', lipF: 'saturate(0.45) brightness(0.7)', hang: 0, propP: 0, props: [] },
};
export function renderPaintedChunk(map, cx, cy, rs, biome) {
  const Wd = CHUNK_T * TILE, c = document.createElement('canvas');
  c.width = Math.ceil(Wd * rs); c.height = Math.ceil(Wd * rs); const g = c.getContext('2d');
  g.scale(rs, rs); g.translate(-cx * Wd, -cy * Wd);
  const x0 = cx * CHUNK_T, y0 = cy * CHUNK_T, at = (x, y) => map.get(x, y), S = (x, y) => isSolidCh(at(x, y));
  const boss = biome.key === 'boss';
  const SK = SKIN[biome.key] || SKIN.overpass, pStone = pattern(g, G.img[SK.fill] ? SK.fill : 'tex_stone', SK.fs), pRoot = pattern(g, 'tex_root', 0.4);
  const path = (X, Y, tl, tr, br, bl) => { g.beginPath(); g.moveTo(X + tl, Y); g.lineTo(X + TILE - tr, Y); g.quadraticCurveTo(X + TILE, Y, X + TILE, Y + tr); g.lineTo(X + TILE, Y + TILE - br); g.quadraticCurveTo(X + TILE, Y + TILE, X + TILE - br, Y + TILE); g.lineTo(X + bl, Y + TILE); g.quadraticCurveTo(X, Y + TILE, X, Y + TILE - bl); g.lineTo(X, Y + tl); g.quadraticCurveTo(X, Y, X + tl, Y); g.closePath(); };
  const each = (fn) => { for (let ty = y0 - 1; ty < y0 + CHUNK_T + 1; ty++) for (let tx = x0 - 1; tx < x0 + CHUNK_T + 1; tx++) { const ch = at(tx, ty); if (isSolidCh(ch)) fn(tx, ty, ch); } };
  const corners = (tx, ty) => { const up = !S(tx, ty - 1), dn = !S(tx, ty + 1), lf = !S(tx - 1, ty), rt = !S(tx + 1, ty), r = 6; return [up, dn, lf, rt, up && lf ? r : 0, up && rt ? r : 0, dn && rt ? r : 0, dn && lf ? r : 0]; };
  // ink rim
  each((tx, ty) => { const [up, dn, lf, rt, a, b, cc, d] = corners(tx, ty); if (!(up || dn || lf || rt)) return; g.fillStyle = g.strokeStyle = PAL.ink; path(tx * TILE, ty * TILE, a, b, cc, d); g.lineWidth = 4; g.stroke(); });
  // textured fill
  each((tx, ty, ch) => { const [, , , , a, b, cc, d] = corners(tx, ty); g.fillStyle = ch === 'B' ? pRoot : pStone; path(tx * TILE, ty * TILE, a, b, cc, d); g.fill(); if (SK.tint && ch !== 'B') { g.fillStyle = SK.tint; g.fill(); } });
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
  const DBG = globalThis.__tileDbg || {};
  // v1.3: crumbly ledge silhouettes under exposed bottoms (jagged rock teeth, ink-outlined)
  if (!DBG.noCrumb) each((tx, ty) => {
    if (S(tx, ty + 1) || at(tx, ty + 1) === '=') return; const X = tx * TILE, Y = (ty + 1) * TILE, h = hash2(tx, ty + 7);
    const lf = S(tx - 1, ty) && !S(tx - 1, ty + 1), rt = S(tx + 1, ty) && !S(tx + 1, ty + 1);
    const pts = [[lf ? 0 : 5, 0]]; const n = 3 + (h * 2 | 0);
    for (let i = 0; i <= n; i++) { const u = (lf ? 0 : 5) + (TILE - (lf ? 0 : 5) - (rt ? 0 : 5)) * i / n; pts.push([u, 2 + hash2(tx * 3 + i, ty) * (i % 2 ? 7 : 3)]); }
    pts.push([rt ? TILE : TILE - 5, 0]);
    g.beginPath(); pts.forEach(([u, v], i) => i ? g.lineTo(X + u, Y - 1 + v) : g.moveTo(X + u, Y - 1 + v)); g.closePath();
    g.strokeStyle = PAL.ink; g.lineWidth = 3; g.lineJoin = 'round'; g.stroke(); g.fillStyle = pStone || '#3a3d50'; g.fill(); g.fillStyle = 'rgba(8,6,18,0.55)'; g.fill();
  });
  const TS = SKIN[biome.key] || SKIN.overpass, spr = G.spr, at2 = (x, y) => at(x, y) || ' ', air = (c) => c === '.' || c === ' ';
  const runs = (rowFn, cb) => { for (let ty = y0 - 3; ty < y0 + CHUNK_T + 2; ty++) { let tx = x0 - 3; while (tx < x0 + CHUNK_T + 3) { if (!rowFn(tx, ty)) { tx++; continue; } let e = tx; while (rowFn(e + 1, ty)) e++; cb(tx, e, ty); tx = e + 1; } } };
  // (canvas filter + clip clears pixels on some rasterisers, so filtered sprites are pre-baked once instead)
  const strip = (m, X0, X1, Y, h, off, alpha, filt) => {
    const src = toned(m, filt), w = m[2] * h / m[3]; g.save(); g.beginPath(); g.rect(X0, Y - h, X1 - X0, h * 3); g.clip(); g.globalAlpha = alpha;
    for (let x = X0 - off * w; x < X1; x += w) g.drawImage(src, 0, 0, m[2], m[3], x, Y, w + 0.6, h);
    g.restore();
  };
  // hanging roots under ceilings (runs of exposed undersides with open air below)
  if (spr.hang && TS.hang && !DBG.noHang) runs((x, y) => isSolidCh(at(x, y)) && air(at2(x, y + 1)) && air(at2(x, y + 2)), (tx, e, ty) => {
    if (e - tx < 1) return; const X0 = tx * TILE + 6, X1 = (e + 1) * TILE - 6, h = TS.hang * (0.85 + hash2(tx, ty) * 0.3);
    strip(spr.hang, X0, X1, (ty + 1) * TILE - h * 0.2, h, hash2(ty, tx), 0.92, TS.hangF);
  });
  // painted mossy lip on top surfaces: overhangs the front, curls past exposed ends, per-run offset for variation
  const m = spr[TS.lip] || spr.moss;
  if (m && !DBG.noLip) runs((x, y) => isSolidCh(at(x, y)) && !S(x, y - 1) && at(x, y - 1) !== '^', (tx, e, ty) => {
    const lx = !S(tx - 1, ty), rx = !S(e + 1, ty), X0 = tx * TILE - (lx ? 3 : 0), X1 = (e + 1) * TILE + (rx ? 3 : 0), Y = ty * TILE, mh = TS.lipH;
    g.save(); g.beginPath(); const r = 7; g.moveTo(X0, Y - mh); g.lineTo(X1, Y - mh);
    if (rx) { g.lineTo(X1, Y + mh * 0.25); g.quadraticCurveTo(X1, Y + mh * 0.7, X1 - r, Y + mh * 0.75); } else g.lineTo(X1, Y + mh);
    if (lx) { g.lineTo(X0 + r, Y + mh * 0.75); g.quadraticCurveTo(X0, Y + mh * 0.7, X0, Y + mh * 0.25); } else g.lineTo(X0, Y + mh);
    g.closePath(); g.clip(); strip(m, X0, X1, Y - mh * TS.lipUp, mh, hash2(tx, ty * 3), 1, TS.lipF); g.restore();
    // warm top-lip highlight
    const gr = g.createLinearGradient(0, Y - mh * TS.lipUp, 0, Y - mh * TS.lipUp + 4); gr.addColorStop(0, TS.rim); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(X0 + 2, Y - mh * TS.lipUp, X1 - X0 - 4, 4);
  });
  // root/vine drapes down exposed side walls just under a top lip (overhang feel at ledge ends)
  if (TS.hang) each((tx, ty) => {
    if (S(tx, ty - 1)) return; const Y = ty * TILE;
    for (const [d, X] of [[-1, tx * TILE], [1, (tx + 1) * TILE]]) {
      if (S(tx + d, ty)) continue; const h = hash2(tx * 5 + d, ty); if (h < 0.35) continue; const L = 14 + h * 26;
      g.lineCap = 'round'; g.strokeStyle = '#173022'; g.lineWidth = 3; g.beginPath(); g.moveTo(X - d * 2, Y + 2); g.bezierCurveTo(X + d * 4, Y + L * 0.3, X - d * 1, Y + L * 0.7, X + d * 2, Y + L); g.stroke();
      g.strokeStyle = '#4f8f3e'; g.lineWidth = 1.4; g.stroke();
      for (let i = 1; i < 4; i++) { const u = i / 4, lx = X + d * (1 + Math.sin(i * 2 + h * 9) * 2), ly = Y + L * u; g.fillStyle = i % 2 ? '#6fbf4a' : '#3f8a3a'; g.beginPath(); g.ellipse(lx + d * 2.5, ly, 2.8, 1.4, d * 0.6, 0, 7); g.fill(); }
    }
  });
  // decor props on open tops (deterministic per tile; skip near spawns/doors so gameplay stays readable)
  if (TS.props.length && !DBG.noProps) for (let ty = y0 - 1; ty < y0 + CHUNK_T + 2; ty++) for (let tx = x0 - 1; tx < x0 + CHUNK_T + 1; tx++) {
    if (!isSolidCh(at(tx, ty)) || !air(at2(tx, ty - 1)) || !air(at2(tx, ty - 2))) continue;
    if (!S(tx - 1, ty) || !S(tx + 1, ty) || !air(at2(tx - 1, ty - 1)) || !air(at2(tx + 1, ty - 1))) continue;
    const h = hash2(tx * 1.7, ty * 2.3); if (h > TS.propP) continue; const k = TS.props[(hash2(tx, ty * 5) * TS.props.length) | 0], q = spr[k[0]]; if (!q) continue;
    const ph = k[1] * 1.25 * (0.8 + hash2(ty, tx) * 0.4), pw = q[2] * ph / q[3], X = tx * TILE + 12 + (hash2(tx, 3) - 0.5) * 8, Y = ty * TILE + 3, fl = hash2(tx, 11) > 0.5;
    if (k[2]) drawGlow(g, X, Y - ph * 0.6, ph * 0.9, k[2], 0.4);
    g.save(); g.translate(X, Y); if (fl) g.scale(-1, 1); g.drawImage(toned(q, TS.propF), 0, 0, q[2], q[3], -pw / 2, -ph, pw, ph); g.restore();
  }
  // one-way planks: warm wood with bright top edge, vine lashings and rope hangers so they never read as solid stone
  for (let ty = y0 - 1; ty < y0 + CHUNK_T + 1; ty++) for (let tx = x0 - 1; tx < x0 + CHUNK_T + 1; tx++) {
    if (at(tx, ty) !== '=') continue; const X = tx * TILE, Y = ty * TILE, h = hash2(tx, ty), L = at(tx - 1, ty) !== '=', R = at(tx + 1, ty) !== '=';
    g.fillStyle = 'rgba(5,4,12,0.35)'; g.fillRect(X, Y + 9, TILE, 4);
    g.fillStyle = PAL.ink; g.beginPath(); g.roundRect(X - (L ? 2 : 0), Y - 1.5, TILE + (L ? 2 : 0) + (R ? 2 : 0), 11, L || R ? 3 : 0); g.fill();
    const wg = g.createLinearGradient(0, Y, 0, Y + 8); wg.addColorStop(0, '#f0b878'); wg.addColorStop(0.25, '#b9793f'); wg.addColorStop(1, '#5c3520'); g.fillStyle = wg; g.fillRect(X + (L ? 0 : 0.5), Y, TILE - 1, 8);
    g.fillStyle = '#ffe2a8'; g.fillRect(X, Y, TILE, 1.4);
    g.fillStyle = 'rgba(60,28,10,0.5)'; g.fillRect(X + 4 + h * 8, Y + 3, 7, 1); g.fillRect(X + 2 + h * 3, Y + 5.5, 5, 1);
    g.fillStyle = '#2a1a14'; g.fillRect(X + TILE - 1, Y, 1, 8);
    if (h > 0.55) { g.strokeStyle = '#2f6a3a'; g.lineWidth = 2; g.beginPath(); g.moveTo(X + 8, Y - 1); g.bezierCurveTo(X + 10, Y + 4, X + 13, Y + 3, X + 14, Y + 9); g.stroke(); g.fillStyle = '#6fcf5a'; g.beginPath(); g.ellipse(X + 15, Y + 11, 3, 1.6, 0.5, 0, 7); g.fill(); }
    for (const [e, px] of [[L, X + 4], [R, X + TILE - 4]]) if (e) { g.strokeStyle = '#2a1f1a'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(px, Y); g.lineTo(px, Y - 34); g.stroke(); g.strokeStyle = '#b08a5a'; g.lineWidth = 1.1; g.stroke(); g.fillStyle = '#d9b07a'; g.fillRect(px - 2, Y + 2, 4, 3); }
  }
  return c;
}
