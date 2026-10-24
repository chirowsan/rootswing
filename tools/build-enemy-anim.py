# v1.4 enemy animation frames: key the painted pose sheets (art/src/enemy_anim/*.jpg, 4 poses each on magenta),
# split them into poses, normalise scale per enemy, bake the ink border + danger rim for regular foes, and pack
# assets/gfx/enemies.webp + enemies.json  {f: {name: [x, y, w, h, pivotX, hRel]}}  (pivot y = frame bottom).
# Each enemy also gets its atlas sprite as frame '<type>_base' so every draw is one drawImage.
# Run: python3 tools/build-enemy-anim.py [--preview]
import subprocess, json, os, sys, numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
R = os.path.dirname(os.path.abspath(__file__)) + '/../'; S = R + 'art/src/enemy_anim/'; O = R + 'assets/gfx/'
# sheet -> (type, [pose names or None], crop box or None)
SHEETS = {
  'hopper': ('hopper', ['crouch', 'leap', 'land', 'hurt'], None),
  'charger': ('charger', ['walk0', 'walk1', 'tele', 'charge'], None),
  'moth': ('moth', ['up', 'down', 'tele', 'swoop'], None),
  'puffcap': ('puffcap', ['walk0', 'walk1', 'tele', 'puff'], None),
  'knight': ('knight', ['walk0', 'walk1', 'tele', 'swing'], None),
  'bomber': ('bomber', ['walk0', 'walk1', 'tele', 'lob'], None),
  'lurefish': ('lurefish', ['swim0', 'swim1', 'tele', 'bite'], None),
  'jelly': ('jelly', ['shut', 'open', 'tele'], (0, 0, 740, 576), [0, 215, 505, 740]),
  'shellback': ('shellback', ['walk0', 'walk1', 'tele', 'spin'], None),
  'dummy': ('dummy', ['stand', 'bendL', 'bendR', 'squash'], None),
  'tturret': ('tturret', ['idle0', 'idle1', 'tele', 'fire'], None),
  'warden_walk': ('warden', ['walk0', 'walk1', 'walk2', 'walk3'], None),
  'warden_b': ('warden', ['crouch', 'air', 'slam', 'roar'], None),
  'warden_c': ('warden', ['bashTele', 'bash', 'hurt', 'stagger'], None),
  'tidegolem_walk': ('tidegolem', ['walk0', 'walk1', 'walk2', 'walk3'], None),
  'tidegolem_b': ('tidegolem', ['crouch', 'air', 'slam', 'roar'], None),
  'tidegolem_c': ('tidegolem', ['bashTele', 'bash', 'hurt', 'stagger'], (0, 0, 1024, 432), [0, 250, 535, 795, 1024]),
  'boss_a': ('boss', ['walk0', 'walk1', 'slamTele', 'slam'], None),
  'boss_b': ('boss', ['volleyTele', 'beamTele', 'charge', 'roar'], None),
  'boss2_a': ('boss2', ['walk0', 'walk1', 'slamTele', 'slam'], None),
  'boss2_b': ('boss2', ['volleyTele', 'beamTele', 'charge', 'roar'], None),
}
# reference pose for scale (its height == the in-game sprite height) and output pixel height of that pose
REF = {'hopper': 'crouch', 'dummy': 'stand', 'moth': 'up', 'jelly': 'shut', 'tturret': 'idle0', 'lurefish': 'swim0'}
OUTH = {'warden': 170, 'tidegolem': 170, 'boss': 250, 'boss2': 260}
GAMEH = {'hopper': 31, 'charger': 31, 'moth': 34.5, 'puffcap': 36.8, 'knight': 54, 'bomber': 35.6, 'dummy': 46, 'tturret': 34.5, 'lurefish': 32.2, 'jelly': 36.8, 'shellback': 34.5}
GAMEH.update({'warden': 66, 'tidegolem': 74, 'boss': 150, 'boss2': 168})
BORDER = set(GAMEH)  # every foe gets the baked ink border + rim (regular 1.8/0.85 world px, big 2.2/1.1)
BIG = {'warden', 'tidegolem', 'boss', 'boss2'}
TINT = {'ink': (12, 10, 20), 'rim': (255, 90, 40)}
def key(sheet, crop):
  src = S + sheet + '.jpg'
  if crop:  # crop/cuts are given in 1024-wide sheet units
    im0 = Image.open(src); k = im0.width / 1024; im0.crop(tuple(round(v * k) for v in crop)).save('/tmp/ea_crop.png'); src = '/tmp/ea_crop.png'
  tmp = '/tmp/ea_' + sheet + '.png'
  subprocess.run(['python3', R + 'tools/key.py', src, tmp, '--lo', '40', '--hi', '110'], check=True, capture_output=True)
  return Image.open(tmp).convert('RGBA')
def split(im, n, cuts=None):
  a = np.asarray(im)[..., 3] > 90
  lab, k = ndimage.label(ndimage.binary_dilation(a, iterations=3))
  sizes = ndimage.sum(a, lab, range(1, k + 1)); big = sizes.max()
  comps = [i + 1 for i, s in enumerate(sizes) if s > big * 0.004]
  cx = {c: ndimage.center_of_mass(a, lab, c)[1] for c in comps}
  # 1-D k-means of component centroids into n poses, seeded by evenly spaced columns, weighted by mass
  seeds = np.array([(i + 0.5) * im.width / n for i in range(n)])
  for _ in range(20):
    asg = {c: int(np.argmin(np.abs(seeds - cx[c]))) for c in comps}
    for j in range(n):
      cs = [c for c in comps if asg[c] == j]
      if cs: seeds[j] = sum(cx[c] * sizes[c - 1] for c in cs) / sum(sizes[c - 1] for c in cs)
  out = []
  arr = np.asarray(im)
  masks = [np.isin(lab, [c for c in comps if asg[c] == j]) & (arr[..., 3] > 0) for j in range(n)]
  if cuts:
    keep = np.isin(lab, comps) & (arr[..., 3] > 0); masks = []
    for j in range(n):
      m = np.zeros_like(keep); m[:, cuts[j]:cuts[j + 1]] = keep[:, cuts[j]:cuts[j + 1]]; masks.append(m)
  elif any(not m.any() for m in masks):  # touching figures: cut at column-mass valleys near even spacing
    prof = ndimage.uniform_filter1d(a.sum(0).astype(float), 9); xs0 = np.nonzero(prof > 0)[0]; L, Rr = xs0.min(), xs0.max()
    cuts = [L]
    for i in range(1, n):
      g = L + (Rr - L) * i / n; w = (Rr - L) / n * 0.3; lo_, hi_ = int(g - w), int(g + w)
      cuts.append(lo_ + int(np.argmin(prof[lo_:hi_])))
    cuts.append(Rr + 1); keep = np.isin(lab, comps) & (arr[..., 3] > 0)
    masks = []
    for j in range(n):
      m = np.zeros_like(keep); m[:, cuts[j]:cuts[j + 1]] = keep[:, cuts[j]:cuts[j + 1]]; masks.append(m)
  for j in range(n):
    m = masks[j]
    ys, xs = np.nonzero(m); x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    fr = arr[y0:y1, x0:x1].copy(); fr[..., 3] = np.where(m[y0:y1, x0:x1], fr[..., 3], 0)
    out.append(Image.fromarray(fr, 'RGBA'))
  return out
def pivot_x(fr):
  a = np.asarray(fr)[..., 3].astype(float); h = a.shape[0]; low = a[int(h * 0.35):]  # body/feet mass, ignores raised arms
  xs = np.arange(a.shape[1]); m = low.sum(0); return float((xs * m).sum() / max(1, m.sum()))
def border(fr, rin, rrim):
  pad = int(rin + 2); W, H = fr.width + pad * 2, fr.height + pad * 2
  base = Image.new('RGBA', (W, H)); base.paste(fr, (pad, pad))
  a = base.getchannel('A')
  def dil(r): return a.filter(ImageFilter.MaxFilter(int(r) * 2 + 1)) if r >= 1 else a
  out = Image.new('RGBA', (W, H))
  for col, r in ((TINT['ink'], rin), (TINT['rim'], rrim)):
    lay = Image.new('RGBA', (W, H), col + (0,)); lay.putalpha(dil(r).filter(ImageFilter.GaussianBlur(0.7))); out.alpha_composite(lay)
  out.alpha_composite(base); return out, pad
frames = {}; per = {}
for sheet, cfg in SHEETS.items():
  typ, names, crop = cfg[:3]; cuts = cfg[3] if len(cfg) > 3 else None
  im = key(sheet, crop)
  if cuts: k = Image.open(S + sheet + '.jpg').width / 1024; cuts = [min(im.width, round(c * k)) for c in cuts]
  parts = split(im, len(names), cuts)
  for fr, n in zip(parts, names):
    if n: per.setdefault(typ, {})[n] = fr
# atlas sprites as '<type>_base'
meta = json.load(open(R + 'dist/gfx/atlas.json')) if os.path.exists(R + 'dist/gfx/atlas.json') else json.load(open(O + 'atlas.json'))
A = Image.open(O + 'atlas.webp').convert('RGBA')
ims = {}; out = {}
for typ, fs in per.items():
  ref = fs.get(REF.get(typ, 'walk0')); refH = ref.height
  x, y, w, h = meta['spr'][typ]; fs['base'] = A.crop((x, y, x + w, y + h)); baseH = fs['base'].height
  oh = OUTH.get(typ, 110)
  for n, fr in fs.items():
    rel = fr.height / (baseH if n == 'base' else refH)
    th = max(8, round(oh * rel)); sc = th / fr.height
    f2 = fr.resize((max(1, round(fr.width * sc)), th), Image.LANCZOS); px = pivot_x(f2); pad = 0
    if typ in BORDER:
      k = oh / GAMEH[typ]; f2, pad = border(f2, (2.2 if typ in BIG else 1.8) * k, (1.1 if typ in BIG else 0.85) * k)
    nm = typ + '_' + n; ims[nm] = f2
    out[nm] = {'px': round(px + pad, 1), 'rel': round(rel, 4), 'pad': pad}
AW = 2048; x = y = rh = 0; pos = {}
for n in sorted(ims, key=lambda n: -ims[n].height):
  w, h = ims[n].size
  if x + w > AW: x = 0; y += rh + 2; rh = 0
  pos[n] = [x, y]; x += w + 2; rh = max(rh, h)
AH = y + rh; at = Image.new('RGBA', (AW, AH))
for n, p in pos.items(): at.paste(ims[n], tuple(p))
at.save(O + 'enemies.webp', quality=84, method=6, alpha_quality=85)
# f: [x, y, w, h, pivotX, hRel, pad]  — draw height = H * hRel scaled so the un-padded body is hRel*H tall
M = {n: [pos[n][0], pos[n][1], ims[n].width, ims[n].height, out[n]['px'], out[n]['rel'], out[n]['pad']] for n in ims}
json.dump({'f': M}, open(O + 'enemies.json', 'w'), separators=(',', ':'))
print('enemy atlas', AW, AH, os.path.getsize(O + 'enemies.webp'), len(M), 'frames')
if '--preview' in sys.argv:
  from PIL import ImageDraw
  types = list(per); cw = 210; rows = []
  for typ in types:
    ns = [n for n in M if n.startswith(typ + '_')]; ch = max(ims[n].height for n in ns) + 24
    row = Image.new('RGB', (cw * 13, ch), (40, 44, 52)); d = ImageDraw.Draw(row)
    for i, n in enumerate(ns):
      fr = ims[n]; s = min(1, (cw - 6) / fr.width); fr2 = fr.resize((max(1, int(fr.width * s)), max(1, int(fr.height * s))))
      row.paste(fr2, (i * cw + 3, ch - fr2.height - 2), fr2); d.text((i * cw + 4, 2), n, fill=(255, 255, 0))
    rows.append(row)
  pv = Image.new('RGB', (cw * 13, sum(r.height for r in rows)), (0, 0, 0)); yy = 0
  for r in rows: pv.paste(r, (0, yy)); yy += r.height
  pv.save('/tmp/ea_preview.png'); print('preview', pv.size)
