# v1.3 hero animation frames: key the painted pose sheets (art/src/anim/*.jpg, 4 poses each on magenta),
# split them into frames, measure a pivot (body centre x, feet y), pack assets/gfx/hero.webp + hero.json.
# Run: python3 tools/build-anim.py [--preview]
import subprocess, json, os, sys, numpy as np
from PIL import Image
R = os.path.dirname(os.path.abspath(__file__)) + '/../'; S = R + 'art/src/anim/'; O = R + 'assets/gfx/'
SHEETS = {
  'run_a': ['run0', 'run1', 'run2', 'run3'], 'run_b': ['run4', 'run5', 'run6', 'run7'],
  'idle_dash': ['idle0', 'idle1', 'wall', 'dash'], 'hook_hurt': ['throw', 'swing', 'hurt', 'dead'],
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
# pack in rows
names = list(out); AW = 2048; x = y = rh = 0; pos = {}
for n in sorted(names, key=lambda n: -ims[n].height):
  w, h = ims[n].size
  if x + w > AW: x = 0; y += rh + 2; rh = 0
  pos[n] = [x, y]; x += w + 2; rh = max(rh, h)
AH = y + rh; at = Image.new('RGBA', (AW, AH))
for n, p in pos.items(): at.paste(ims[n], tuple(p))
at.save(O + 'hero.webp', quality=86, method=6, alpha_quality=88)
meta = {n: [pos[n][0], pos[n][1], out[n]['w'], out[n]['h'], out[n]['fx'], out[n]['fy']] for n in names}
json.dump({'scale': SC, 'f': meta}, open(O + 'hero.json', 'w'), separators=(',', ':'))
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
