# v1.3 hero animation frames: key the painted pose sheets (art/src/anim/*.jpg, 4 poses each on magenta),
# split them into frames, measure a pivot (body centre x, feet y), pack assets/gfx/hero.webp + hero.json.
# Run: python3 tools/build-anim.py [--preview]
import subprocess, json, os, sys, numpy as np
from PIL import Image
R = os.path.dirname(os.path.abspath(__file__)) + '/../'; S = R + 'art/src/anim/'; O = R + 'assets/gfx/'
SHEETS = {
  'idle_dash': ['_oldidle', None, 'wall', 'dash'],  # v1.4.1: idle/walk/run/start/stop/turn come from the rig (tools/hero-rig.py)
  'hook_hurt': ['throw', 'swing', 'hurt', 'dead'],  # v1.9: restored (a stray comment had dropped these since v1.4.1)
  'attack_a': ['slash1', 'slash2', 'thrust', 'hwind'], 'attack_b': ['slam', 'parry', 'airatk', 'land'],
  'air': ['jump', 'apex', 'fall', None],
}
SC = 0.62  # sheet px -> atlas px
def frames(sheet):
  tmp = '/tmp/anim_' + sheet + '.png'
  subprocess.run(['python3', R + 'tools/key.py', S + sheet + '.jpg', tmp, '--lo', '40', '--hi', '110'], check=True, capture_output=True)
  im = Image.open(tmp); a = np.asarray(im)[..., 3] > 100
  # drop specks: keep columns with enough opaque pixels
  col = a.sum(0) > 2; segs = []; x = 0; W = len(col)
  while x < W:
    if col[x]:
      s = x
      while x < W and col[x]: x += 1
      segs.append([s, x])
    x += 1
  segs = [s for s in segs if a[:, s[0]:s[1]].sum() > 300]
  while len(segs) > 4:  # merge the closest neighbours (cape tips split off)
    gaps = [segs[i + 1][0] - segs[i][1] for i in range(len(segs) - 1)]; i = int(np.argmin(gaps)); segs[i] = [segs[i][0], segs[i + 1][1]]; del segs[i + 1]
  return im, segs
def face_x(rgba):  # centroid of the dark face blob in the top half -> where the head points
  A = rgba[..., 3] > 200; L = rgba[..., :3].astype(int).sum(-1) < 110; h = A.shape[0]
  m = A & L; m[int(h * 0.55):] = False
  ys, xs = np.nonzero(m); return (xs.mean(), ys.mean()) if len(xs) > 20 else (A.shape[1] / 2, h * 0.3)
out = {}; ims = {}
for sheet, names in SHEETS.items():
  im, segs = frames(sheet); assert len(segs) == 4, (sheet, segs)
  for (x0, x1), n in zip(segs, names):
    if not n: continue
    fr = im.crop((x0, 0, x1, im.height)); bb = fr.getchannel('A').point(lambda v: 255 if v > 30 else 0).getbbox(); fr = fr.crop(bb)
    fr = fr.resize((max(1, round(fr.width * SC)), max(1, round(fr.height * SC))), Image.LANCZOS)
    fx, fy = face_x(np.asarray(fr)); ims[n] = fr
    out[n] = {'w': fr.width, 'h': fr.height, 'fx': round(fx, 1), 'fy': round(fy, 1)}
# v1.4.1 rig frames: scaled to the painted frames' height, colour-matched to the old idle frame, explicit pivot (hip x, sole y)
RIG = R + 'art/src/anim2/rig/'; rmeta = json.load(open(RIG + 'rig.json')); RS = 1.06; pivots = {}; hands = {}
old = np.asarray(ims.pop('_oldidle')).astype(np.float32); out.pop('_oldidle')
def stats(a): m = a[..., 3] > 200; return a[m][:, :3].mean(0), a[m][:, :3].std(0)
r0 = np.asarray(Image.open(RIG + 'idle0.png').convert('RGBA')).astype(np.float32); (om, osd), (rm, rsd) = stats(old), stats(r0)
CT = 0.65  # blend of the colour transfer
for n, m in rmeta.items():
  if n.startswith('_'): continue
  fr = Image.open(RIG + n + '.png').convert('RGBA'); fr = fr.resize((round(fr.width * RS), round(fr.height * RS)), Image.LANCZOS)
  a = np.asarray(fr).astype(np.float32).copy(); c = (a[..., :3] - rm) / np.maximum(rsd, 1) * osd + om; a[..., :3] = a[..., :3] * (1 - CT) + c * CT
  fr = Image.fromarray(a.clip(0, 255).astype(np.uint8)); fx, fy = face_x(np.asarray(fr)); ims[n] = fr
  if 'hand' in m: hands[n] = [round(m['hand'][0] * RS, 1), round(m['hand'][1] * RS, 1), m['hand'][2], m.get('lean', 0)]
  out[n] = {'w': fr.width, 'h': fr.height, 'fx': round(fx, 1), 'fy': round(fy, 1)}; pivots[n] = [round(m['pv'][0] * RS, 1), round(m['pv'][1] * RS, 1)] + [(None if c is None else round(c * RS, 1)) for c in m.get('contact', [None, None])]
# keep the rig's pivot continuous with the painted frames (they pivot at face_x - 22): one constant shift for every rig frame
OFF = round(out['idle0']['fx'] - 22 - pivots['idle0'][0], 1)
for n in pivots:
  pv = pivots[n]; pv[0] = round(pv[0] + OFF, 1)  # contact x (cols 8, 9: near / far planted-foot x relative to the hip, null = airborne)
print('rig pivot offset', OFF)
# pack in rows
names = list(out); AW = 2048; x = y = rh = 0; pos = {}
for n in sorted(names, key=lambda n: -ims[n].height):
  w, h = ims[n].size
  if x + w > AW: x = 0; y += rh + 2; rh = 0
  pos[n] = [x, y]; x += w + 2; rh = max(rh, h)
AH = y + rh; at = Image.new('RGBA', (AW, AH))
for n, p in pos.items(): at.paste(ims[n], tuple(p))
at.save(O + 'hero.webp', quality=86, method=6, alpha_quality=88)
meta = {n: [pos[n][0], pos[n][1], out[n]['w'], out[n]['h'], out[n]['fx'], out[n]['fy']] + pivots.get(n, []) for n in names}
gait = {k[1:]: dict(v, cycle_px=round(v['cycle_px'] * RS, 2)) for k, v in rmeta.items() if k.startswith('_')}
json.dump({'scale': SC, 'gait': gait, 'f': meta, 'hand': hands}, open(O + 'hero.json', 'w'), separators=(',', ':'))
print('hero atlas', AW, AH, os.path.getsize(O + 'hero.webp'))
for n in names: print(n, meta[n][2:])
if '--preview' in sys.argv:  # labelled grid with face markers for annotation
  from PIL import ImageDraw
  cw, chh = 230, 260; cols = 7; rows = (len(names) + cols - 1) // cols; pv = Image.new('RGB', (cw * cols, chh * rows), (40, 44, 52)); d = ImageDraw.Draw(pv)
  for i, n in enumerate(names):
    cx, cy = (i % cols) * cw, (i // cols) * chh; fr = ims[n]; ox, oy = cx + (cw - fr.width) // 2, cy + chh - 10 - fr.height
    for gx in range(0, fr.width, 20): d.line([(ox + gx, oy), (ox + gx, oy + fr.height)], fill=(60, 66, 80))
    for gy in range(0, fr.height, 20): d.line([(ox, oy + gy), (ox + fr.width, oy + gy)], fill=(60, 66, 80))
    pv.paste(fr, (ox, oy), fr); d.text((cx + 4, cy + 4), n, fill=(255, 255, 0))
  pv.save('/tmp/anim_preview.png')
