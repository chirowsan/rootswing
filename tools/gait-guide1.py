# v1.4.1: single-pose chibi mannequin guides (one per gait phase) for per-frame GenerateImage calls.
import math
from PIL import Image, ImageDraw
WALK = [(25, 5), (15, 22), (0, 10), (-15, 5), (-25, 25), (-10, 60), (10, 62), (25, 25)]
RUN = [(32, 15), (10, 45), (-22, 20), (-42, 30), (-30, 95), (0, 125), (40, 95), (48, 40)]
S = 2.4
def leg(hx, hy, th, kn, L=34 * S):
  a = math.radians(th); kx, ky = hx + math.sin(a) * L, hy + math.cos(a) * L
  b = math.radians(th - kn); return (kx, ky), (kx + math.sin(b) * L, ky + math.cos(b) * L), b
def pose(K, i, lean, flight, out):
  im = Image.new('RGB', (1024, 1024), (214, 0, 96)); d = ImageDraw.Draw(im)
  n, f = K[i], K[(i + 4) % 8]; gy = 880; cx = 512
  low = max(leg(0, 0, *n)[1][1], leg(0, 0, *f)[1][1]); hy = gy - low - (30 if i in flight else 0); hx = cx
  la = math.radians(lean); T = 48 * S; sx, sy = hx + math.sin(la) * T, hy - math.cos(la) * T
  d.line([(150, gy + 4), (874, gy + 4)], fill=(150, 0, 70), width=5)
  def limb(th, kn, col):
    k, ft, b = leg(hx, hy, th, kn); d.line([(hx, hy), k, ft], fill=col, width=int(15 * S), joint='curve')
    d.ellipse([ft[0] - 12 * S, ft[1] - 9 * S, ft[0] + 16 * S, ft[1] + 5 * S], fill=col)
  def arm(th, col):
    a = math.radians(th); e = (sx + math.sin(a) * 22 * S, sy + 6 * S + math.cos(a) * 22 * S); b = math.radians(th + 50)
    h = (e[0] + math.sin(b) * 18 * S, e[1] + math.cos(b) * 18 * S); d.line([(sx, sy + 6 * S), e, h], fill=col, width=int(10 * S), joint='curve'); d.ellipse([h[0] - 8 * S, h[1] - 8 * S, h[0] + 8 * S, h[1] + 8 * S], fill=col)
  limb(*f, (80, 80, 95)); arm(n[0] * 0.9, (80, 80, 95))
  d.line([(hx, hy), (sx, sy)], fill=(165, 165, 178), width=int(36 * S))
  r = 46 * S; hcx, hcy = sx + math.sin(la) * 30 * S, sy - r * 0.8; d.ellipse([hcx - r, hcy - r, hcx + r, hcy + r], fill=(190, 190, 200))
  limb(*n, (235, 235, 245)); arm(f[0] * 0.9, (235, 235, 245))
  im.save(out)
for i in range(8):
  pose(WALK, i, 4, [], f'art/src/anim2/g_walk{i}.png'); pose(RUN, i, 14, [3, 7], f'art/src/anim2/g_run{i}.png')
