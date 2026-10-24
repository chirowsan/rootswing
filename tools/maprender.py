# Render a dumped run (tools/mapdump.mjs) as a readable top-down level-design sheet.
# usage: python3 tools/maprender.py map.json out.png [nrooms] [title]
import json, sys
from PIL import Image, ImageDraw, ImageFont
d = json.load(open(sys.argv[1])); out = sys.argv[2]; N = int(sys.argv[3]) if len(sys.argv) > 3 else 8; title = sys.argv[4] if len(sys.argv) > 4 else ''
W, H, T = d['w'], d['h'], d['t']; S = 6; CW, CH = 34, 20
main = sorted([c for c in d['cells'] if not c['branch']], key=lambda c: c['depth'])[:N]
xs = [c['x'] for c in main]; ys = [c['y'] for c in main]
x0, x1, y0, y1 = min(xs), max(xs) + 1, min(ys), max(ys) + 1
img = Image.new('RGB', ((x1 - x0) * CW * S, (y1 - y0) * CH * S + 22), (22, 20, 34)); g = ImageDraw.Draw(img)
COL = {'#': (88, 82, 110), 'B': (120, 100, 90), 'G': (200, 60, 80), '=': (200, 160, 90), 'u': (220, 120, 60), '^': (230, 40, 70), 'v': (230, 40, 70), '~': (160, 30, 110)}
onmain = {(c['x'], c['y']) for c in main}
for ty in range(y0 * CH, y1 * CH):
  for tx in range(x0 * CW, x1 * CW):
    c = T[ty * W + tx]; cell = (tx // CW, ty // CH)
    if cell not in onmain: col = (14, 12, 22) if c == '#' else (30, 26, 44)
    else: col = COL.get(c, (40, 38, 60))
    X, Y = (tx - x0 * CW) * S, (ty - y0 * CH) * S + 22
    if c == '=' or c == 'u': g.rectangle([X, Y, X + S - 1, Y + 2], fill=col)
    else: g.rectangle([X, Y, X + S - 1, Y + S - 1], fill=col)
def P(x, y): return ((x - x0 * CW) * S + S // 2, (y - y0 * CH) * S + 22 + S // 2)
for s in d['spawns']:
  if (s['x'] // CW, s['y'] // CH) not in onmain: continue
  X, Y = P(s['x'], s['y']); c = s['c']
  if c in 'oz': g.ellipse([X - 4, Y - 4, X + 4, Y + 4], outline=(95, 242, 232) if c == 'z' else (255, 210, 90), width=2)
  elif c in 'efthkbjwysM': g.rectangle([X - 3, Y - 3, X + 3, Y + 3], fill=(255, 120, 60))
  elif c == 'Q': g.polygon([(X, Y - 6), (X + 5, Y), (X, Y + 6), (X - 5, Y)], fill=(140, 255, 120))
  elif c == 'g': g.ellipse([X - 2, Y - 2, X + 2, Y + 2], fill=(255, 226, 122))
  elif c in 'cFWDS': g.rectangle([X - 4, Y - 4, X + 4, Y + 4], outline=(255, 255, 255))
TC = {'spike': (255, 60, 90), 'saw': (255, 160, 60), 'crusher': (190, 120, 255), 'crumble': (220, 120, 60), 'vent': (180, 220, 255), 'shooter': (255, 90, 200)}
for t in d.get('traps', []):
  if (t['x'] // CW, t['y'] // CH) not in onmain: continue
  X, Y = P(t['x'], t['y']); col = TC.get(t['k'], (255, 0, 255))
  if t['k'] == 'saw': X2, _ = P(t['x2'], t['y']); g.line([X, Y, X2, Y], fill=col, width=1); g.ellipse([X - 4, Y - 4, X + 4, Y + 4], outline=col, width=2)
  else: g.rectangle([X - 3, Y - 3, X + 3, Y + 3], outline=col, width=2)
for c in main:
  X, Y = (c['x'] - x0) * CW * S, (c['y'] - y0) * CH * S + 22
  g.rectangle([X, Y, X + CW * S - 1, Y + CH * S - 1], outline=(70, 66, 96)); g.text((X + 4, Y + 2), f"{c['depth']}:{c['id']}", fill=(220, 220, 240))
g.text((6, 5), title, fill=(255, 230, 160))
img.save(out); print('saved', out, img.size)
