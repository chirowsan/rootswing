# v1.4.1: mannequin gait guides (8 phases, 4x2 grid on magenta) used as pose references for the painted walk/run sheets.
import math, sys
from PIL import Image, ImageDraw
WALK = [(25, 5), (15, 22), (0, 10), (-15, 5), (-25, 25), (-10, 60), (10, 62), (25, 25)]
RUN = [(32, 15), (10, 45), (-22, 20), (-42, 30), (-30, 95), (0, 125), (40, 95), (48, 40)]
def leg(hx, hy, th, kn, L1, L2):
  a = math.radians(th); kx, ky = hx + math.sin(a) * L1, hy + math.cos(a) * L1
  b = math.radians(th - kn); fx, fy = kx + math.sin(b) * L2, ky + math.cos(b) * L2
  return (kx, ky), (fx, fy), b
def sheet(K, lean, flight, out):
  im = Image.new('RGB', (1280, 720), (214, 0, 96)); d = ImageDraw.Draw(im); L1, L2 = 46, 46
  for i in range(8):
    cx, gy = 160 + (i % 4) * 320, 330 + (i // 4) * 360
    n, f = K[i], K[(i + 4) % 8]
    # hip height so the lowest foot touches the ground
    low = max(leg(0, 0, *n, L1, L2)[1][1], leg(0, 0, *f, L1, L2)[1][1]); hy = gy - low - (14 if i in flight else 0); hx = cx
    la = math.radians(lean); sx, sy = hx + math.sin(la) * 70, hy - math.cos(la) * 70
    d.line([(cx - 120, gy + 2), (cx + 120, gy + 2)], fill=(150, 0, 70), width=3)
    def limb(th, kn, col):
      k, ft, b = leg(hx, hy, th, kn, L1, L2); d.line([(hx, hy), k, ft], fill=col, width=16, joint='curve')
      d.line([ft, (ft[0] + math.cos(b) * 22, ft[1] - math.sin(b) * 2)], fill=col, width=14)  # boot
    def arm(th, col):
      a = math.radians(th); ex, ey = sx + math.sin(a) * 34, sy + 8 + math.cos(a) * 34; b = math.radians(th + 45); d.line([(sx, sy + 8), (ex, ey), (ex + math.sin(b) * 30, ey + math.cos(b) * 30)], fill=col, width=12)
    limb(*f, (90, 90, 100)); arm(n[0] * 0.9, (90, 90, 100))
    d.line([(hx, hy), (sx, sy)], fill=(170, 170, 180), width=34)
    d.ellipse([sx - 34 + math.sin(la) * 20, sy - 78, sx + 34 + math.sin(la) * 20, sy - 10], fill=(185, 185, 195))
    limb(*n, (225, 225, 235)); arm(f[0] * 0.9, (225, 225, 235))
    d.text((cx - 110, gy - 300 + 10), str(i + 1), fill=(255, 255, 255))
  im.save(out)
sheet(WALK, 4, [], 'art/src/anim2/guide_walk.png'); sheet(RUN, 14, [3, 7], 'art/src/anim2/guide_run.png')
