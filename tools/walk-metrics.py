# v1.4.1 walk/run metrics from tools/walk-probe.mjs output: foot slide during contact and pivot (body) jitter.
# python3 tools/walk-metrics.py shots/v141/walk-<tag>.json [atlas-dir]
import json, sys, numpy as np
from PIL import Image
J = json.load(open(sys.argv[1])); D = sys.argv[2] if len(sys.argv) > 2 else 'assets/gfx/'
meta = json.load(open(D + 'hero.json'))['f']; at = np.asarray(Image.open(D + 'hero.webp').convert('RGBA'))[..., 3] > 110
feat = {}
def frame_feat(n, pvy):
  x, y, w, h = meta[n][:4]; a = at[y:y + h, x:x + w]; ys, xs = np.nonzero(a)
  top = ys.min(); band = (ys > top + (h - top) * 0.12) & (ys < top + (h - top) * 0.45)  # hood + shoulders
  # contact pixels: within 5 frame px of the ground line (pvy); split into foot clusters by x gaps
  c = xs[ys >= pvy - 5]; cl = []
  if len(c) > 6:
    c = np.sort(c); s = c[0]; prev = c[0]
    for v in list(c[1:]) + [1e9]:
      if v - prev > 6: cl.append((s + prev) / 2); s = v
      prev = v
  return {'cx': xs[band].mean(), 'cy': ys[band].mean(), 'top': top, 'contact': cl, 'h': h - top}
def world(r, fx, fy): return (r['X'] + (fx - r['pvx']) * r['K'] * r['sx'], r['Y'] + (fy - r['pvy']) * r['K'] * r['sy'])
out = {}
for name, fr in J['S'].items():
  rows = []
  for r in fr:
    k = (r['n'], round(r['pvy'], 2))
    if k not in feat: feat[k] = frame_feat(r['n'], r['pvy'])
    F = feat[k]; bx, by = world(r, F['cx'], F['cy']); feet = [world(r, c, r['pvy'])[0] for c in F['contact']]
    rows.append({'n': r['n'], 'bx': bx - r['X'], 'by': by - r['Y'], 'feet': feet, 'vx': r['vx'], 'g': r['ground'], 'hpx': F['h'] * r['K']})
  # foot slide: a contact foot in frame i+1 matched to the nearest contact foot in frame i (same planted foot if < 6 u apart)
  slides = []; seg = []; drifts = []
  for a, b in zip(rows, rows[1:]):
    if not (a['g'] and b['g'] and abs(b['vx']) > 25): continue
    for fb in b['feet']:
      if not a['feet']: continue
      d = min(a['feet'], key=lambda fa: abs(fa - fb)); dd = fb - d
      if abs(dd) < 6: slides.append(abs(dd))
  steady = [r for r in rows[30:] if r['g'] and abs(r['vx']) > 25]
  bxs = np.array([r['bx'] for r in steady]) if steady else np.zeros(1); bys = np.array([r['by'] for r in steady]) if steady else np.zeros(1)
  hs = np.array([r['hpx'] for r in steady]) if steady else np.zeros(1)
  jx = np.abs(np.diff(bxs)) if len(bxs) > 1 else np.zeros(1); jy = np.abs(np.diff(bys)) if len(bys) > 1 else np.zeros(1)
  frames = [r['n'] for r in rows]; changes = sum(1 for a, b in zip(frames, frames[1:]) if a != b)
  out[name] = {'slide_mean': round(float(np.mean(slides)), 2) if slides else None, 'slide_p95': round(float(np.percentile(slides, 95)), 2) if slides else None, 'contact_pairs': len(slides),
    'body_x_std': round(float(bxs.std()), 2), 'body_x_jump_max': round(float(jx.max()), 2), 'body_y_jump_max': round(float(jy.max()), 2), 'height_range': round(float(hs.max() - hs.min()), 2),
    'frame_changes': changes, 'distinct': len(set(frames)), 'seq': ' '.join(frames[40:64])}
for k, v in out.items(): print(k, json.dumps(v))
json.dump(out, open(sys.argv[1].replace('.json', '-metrics.json'), 'w'), indent=1)
