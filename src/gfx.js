// Painted art loader (v1.1). Everything degrades to the procedural v1.0 drawing when assets are missing.
export const G = { ready: false, ver: 0, img: {}, spr: {}, atlas: null, meta: null, tint: new Map(), hero: null };
const loadImg = (src) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });
export async function loadGfx(base = 'gfx/') {
  try {
    const meta = await (await fetch(base + 'atlas.json')).json(); G.meta = meta;
    const names = [...Object.keys(meta.bg), 'tex_stone', 'tex_metal', 'tex_root', 'tex_rock'];
    const imgs = await Promise.all([loadImg(base + 'atlas.webp'), ...names.map((n) => loadImg(base + n + '.webp'))]);
    if (!imgs[0]) return false;
    try { const [hm, hi] = await Promise.all([fetch(base + 'hero.json').then((r) => r.json()), loadImg(base + 'hero.webp')]); if (hi && hm) G.hero = { img: hi, f: hm.f, cache: new Map() }; } catch (e) { G.hero = null; }
    G.atlas = imgs[0]; names.forEach((n, i) => { if (imgs[i + 1]) G.img[n] = imgs[i + 1]; }); G.spr = meta.spr; G.ready = true; G.ver++;
    return true;
  } catch (e) { return false; }
}
export const has = (n) => G.ready && !!G.spr[n];
export const sprAspect = (n) => { const s = G.spr[n]; return s ? s[2] / s[3] : 1; };
// draw sprite n so its height is h world units with anchor (ax, ay) in 0..1 at (x, y)
export function spr(g, n, x, y, h, ax = 0.5, ay = 1, flip = false, src = null) {
  const s = G.spr[n]; if (!s) return false; const w = s[2] * h / s[3];
  const img = src || G.atlas, sx = src ? 0 : s[0], sy = src ? 0 : s[1];
  if (flip) { g.save(); g.translate(x, y); g.scale(-1, 1); g.drawImage(img, sx, sy, s[2], s[3], -w * ax, -h * ay, w, h); g.restore(); }
  else g.drawImage(img, sx, sy, s[2], s[3], x - w * ax, y - h * ay, w, h);
  return true;
}
// a flat-colour silhouette of sprite n (cached), for hurt flashes and outlines
export function tinted(n, color) {
  const k = n + color; let c = G.tint.get(k); if (c) return c; const s = G.spr[n]; if (!s) return null;
  c = document.createElement('canvas'); c.width = s[2]; c.height = s[3]; const x = c.getContext('2d');
  x.drawImage(G.atlas, s[0], s[1], s[2], s[3], 0, 0, s[2], s[3]); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, s[2], s[3]);
  G.tint.set(k, c); return c;
}
// darkened copy of a sprite (cached) — replaces per-frame ctx.filter brightness
export function shaded(n, k) {
  const key = n + '@' + k; let c = G.tint.get(key); if (c) return c; const s = G.spr[n]; if (!s) return null;
  c = document.createElement('canvas'); c.width = s[2]; c.height = s[3]; const x = c.getContext('2d');
  x.drawImage(G.atlas, s[0], s[1], s[2], s[3], 0, 0, s[2], s[3]); x.globalCompositeOperation = 'source-atop'; x.fillStyle = `rgba(10,8,20,${1 - k})`; x.fillRect(0, 0, s[2], s[3]);
  G.tint.set(key, c); return c;
}
// world-anchored texture pattern (scale = world units per texture pixel)
export function pattern(g, n, scale) {
  const img = G.img[n]; if (!img) return null; const p = g.createPattern(img, 'repeat');
  if (p && p.setTransform) p.setTransform(new DOMMatrix([scale, 0, 0, scale, 0, 0])); return p;
}
// v1.3 painted hero frame: [x, y, w, h, faceX, faceY] in hero.webp; white silhouette cached for hurt flashes
export function heroFlash(n) {
  const H = G.hero; let c = H.cache.get(n); if (c) return c; const f = H.f[n]; c = document.createElement('canvas'); c.width = f[2]; c.height = f[3];
  const x = c.getContext('2d'); x.drawImage(H.img, f[0], f[1], f[2], f[3], 0, 0, f[2], f[3]); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, f[2], f[3]); H.cache.set(n, c); return c;
}
