# v1.4.1 hero locomotion frames: a cutout rig built from the painted parts sheet (art/src/anim2/rig_parts.jpg, made with
# GenerateImage in the hero's style). Feet follow planted ground-contact trajectories (2-bone IK), so every walk/run frame shares
# one pivot (hip x, ground y) and the stance foot moves backwards exactly one stride per cycle -> no foot slide when the
# game advances the phase by distance / stride. Writes art/src/anim2/rig/<name>.png (atlas px) + rig.json.
# Run: python3 tools/hero-rig.py [--preview]
import json, math, os, subprocess, sys, numpy as np
from PIL import Image, ImageDraw
R = os.path.dirname(os.path.abspath(__file__)) + '/../'; SRC = R + 'art/src/anim2/'; OUT = SRC + 'rig/'; os.makedirs(OUT, exist_ok=True)
SS = 4  # supersampling
subprocess.run(['python3', R + 'tools/key.py', SRC + 'rig_parts.jpg', '/tmp/rig_k.png', '--lo', '40', '--hi', '110'], check=True, capture_output=True)
K = Image.open('/tmp/rig_k.png').convert('RGBA')
def cut(box): return K.crop(box)
def scaled(im, sx, sy): return im.resize((max(1, round(im.width * sx * SS)), max(1, round(im.height * sy * SS))), Image.LANCZOS)
def dark(im, k):
  a = np.asarray(im).astype(np.float32).copy(); a[..., :3] *= k; return Image.fromarray(a.clip(0, 255).astype(np.uint8))
# ---- parts (source px boxes measured from the keyed sheet) ----
BODY = cut((125, 33, 473, 641)); SB = 0.27
b = np.asarray(BODY).astype(int); A = b[..., 3] > 100; rgb = b[..., :3]
green = (rgb[..., 1] > rgb[..., 0] + 20) & (rgb[..., 1] > rgb[..., 2]) & A
orange = (rgb[..., 0] > rgb[..., 1] + 40) & A
cape = np.zeros_like(A)
for y in range(350, A.shape[0]):
  gx = green[y].nonzero()[0]; lim = gx.min() if len(gx) else A.shape[1]
  cape[y, :lim] = A[y, :lim]
sprout = np.zeros_like(A); sprout[:76] = A[:76]
def layer(mask):
  a = b.copy(); a[..., 3] = np.where(mask, a[..., 3], 0); return Image.fromarray(a.astype(np.uint8))
L_BODY = scaled(layer(A & ~cape & ~sprout), SB, SB); L_CAPE = scaled(layer(cape), SB, SB); L_SPROUT = scaled(layer(sprout), SB, SB)
HIP = (232 * SB, 528 * SB)          # hip joint in body px (scaled)
SH_N = (246 * SB, 352 * SB); SH_F = (212 * SB, 350 * SB)   # near / far shoulder
CAPE_TOP = (140 * SB, 360 * SB); SPROUT_BASE = (212 * SB, 76 * SB)
TH = cut((783, 260, 873, 570)); TSX, TSY = 21 / 90, 30 / 310; THIGH = scaled(TH, TSX, TSY); TH_PV = (45 * TSX, 24 * TSY); L1 = 24
SH = cut((983 + 0, 305, 983 + 100, 305 + 125)); SSX, SSY = 18 / 100, 27 / 125; SHIN = scaled(SH, SSX, SSY); SH_PV = (50 * SSX, 8 * SSY); L2 = 21
BT = cut((983, 305 + 112, 983 + 170, 305 + 276)); BSX, BSY = 0.205, 0.15; BOOT = scaled(BT, BSX, BSY); BT_PV = (50 * BSX, 6 * BSY)
ANK_H = (164 - 6) * BSY; TOE = (165 - 50) * BSX; HEEL = -50 * BSX   # ankle height above sole, toe / heel x from ankle
AR = cut((590, 221, 693, 582)); ASX, ASY = 0.17, 0.115
UARM = scaled(AR.crop((0, 0, 103, 120)), ASX, ASY); UA_PV = (45 * ASX, 14 * ASY); LU = (110 - 14) * ASY
FARM = scaled(AR.crop((0, 100, 103, 361)), ASX, ASY); FA_PV = (42 * ASX, 10 * ASY)
DK = 0.7
FAR = {k: dark(v, DK) for k, v in dict(THIGH=THIGH, SHIN=SHIN, BOOT=BOOT, UARM=UARM, FARM=FARM).items()}
NEAR = dict(THIGH=THIGH, SHIN=SHIN, BOOT=BOOT, UARM=UARM, FARM=FARM)
W, H = 190, 250; GY = 238; HX = 82  # canvas (atlas px), ground y, hip x
def place(cv, im, pv, tgt, ang):
  """paste im so that its pivot pv (part px, already /SS units) lands on tgt (atlas px), rotated ang degrees (screen CCW)."""
  px, py = pv[0] * SS, pv[1] * SS; r = int(math.hypot(max(px, im.width - px), max(py, im.height - py))) + 2
  pad = Image.new('RGBA', (2 * r, 2 * r)); pad.paste(im, (int(r - px), int(r - py)))
  if ang: pad = pad.rotate(ang, resample=Image.BICUBIC, center=(r, r))
  cv.alpha_composite(pad, (int(round(tgt[0] * SS - r)), int(round(tgt[1] * SS - r))))
def rot(p, c, ang):  # rotate point p about c by ang degrees screen-CCW (y down)
  a = math.radians(-ang); dx, dy = p[0] - c[0], p[1] - c[1]; return (c[0] + dx * math.cos(a) - dy * math.sin(a), c[1] + dx * math.sin(a) + dy * math.cos(a))
def dirang(dx, dy): return math.degrees(math.atan2(dx, dy))  # angle that turns a down-pointing part toward (dx,dy)
def ik(h, a):  # knee bends forward (+x)
  dx, dy = a[0] - h[0], a[1] - h[1]; d = math.hypot(dx, dy); d = min(d, L1 + L2 - 0.01); base = math.atan2(dy, dx)
  c = (L1 * L1 + d * d - L2 * L2) / (2 * L1 * d); t = math.acos(max(-1, min(1, c)))
  k = (h[0] + L1 * math.cos(base - t), h[1] + L1 * math.sin(base - t))
  if k[0] < h[0] + min(dx, 0) - 1 and False: pass
  return k, (k[0] + (a[0] - k[0]) * L2 / max(1e-6, math.hypot(a[0] - k[0], a[1] - k[1])) if False else a[0], a[1])
def reach(h, a):  # clamp ankle target into reach
  dx, dy = a[0] - h[0], a[1] - h[1]; d = math.hypot(dx, dy); m = (L1 + L2) * 0.995
  return a if d <= m else (h[0] + dx * m / d, h[1] + dy * m / d)
def leg(cv, P, hip, foot):
  """foot = (ankle_x, ankle_y, boot_angle)"""
  a = reach(hip, foot[:2]); k, _ = ik(hip, a)
  place(cv, P['THIGH'], TH_PV, hip, dirang(k[0] - hip[0], k[1] - hip[1]))
  place(cv, P['SHIN'], SH_PV, k, dirang(a[0] - k[0], a[1] - k[1]))
  place(cv, P['BOOT'], BT_PV, a, foot[2])
  return a
def arm(cv, P, sh, ang, elbow):
  e = (sh[0] + math.sin(math.radians(ang)) * LU, sh[1] + math.cos(math.radians(ang)) * LU)
  place(cv, P['UARM'], UA_PV, sh, ang); place(cv, P['FARM'], FA_PV, e, ang + elbow)
def render(p):
  """p: hip_h (ankle-to-hip height above ankle line), lean, feet (near, far) as (x_rel, lift, boot_ang), arms (near, far) as (ang, elbow), cape, sprout"""
  cv = Image.new('RGBA', (W * SS, H * SS)); hy = GY - ANK_H - p['hip_h']; hip = (HX, hy)
  ox, oy = HX - HIP[0], hy - HIP[1]  # body offset so that HIP lands on hip
  def bp(q): return rot((q[0] + ox, q[1] + oy), hip, -p['lean'])
  feet = []
  for side, P in (('far', FAR), ('near', NEAR)):
    fx, lift, ba = p['feet'][1 if side == 'far' else 0]; jh = (hip[0] + (-3 if side == 'far' else 3), hip[1])
    tgt = (HX + fx, GY - ANK_H - lift)
    if side == 'far':
      arm(cv, P, bp(SH_F), *p['arms'][1])
      place(cv, L_CAPE, CAPE_TOP, bp(CAPE_TOP), -p['lean'] + p.get('cape', 0))
    feet.append(leg(cv, P, jh, (tgt[0], tgt[1], ba)))
  place(cv, L_BODY, HIP, hip, -p['lean'])
  place(cv, L_SPROUT, SPROUT_BASE, bp(SPROUT_BASE), -p['lean'] + p.get('sprout', 0))
  arm(cv, NEAR, bp(SH_N), *p['arms'][0])
  im = cv.resize((W, H), Image.LANCZOS)
  return im, feet
# ---- gait ----
def ease(v): return 0.5 - 0.5 * math.cos(math.pi * v)
def foot_at(ph, a, beta, lift, toe_off=25, strike=-10):
  ph %= 1
  if ph < beta:  # stance: ankle slides back linearly in hip frame (planted in world)
    u = ph / beta; x = a - 2 * a * u; ang = strike * max(0, 1 - u / 0.18) + toe_off * max(0, (u - 0.72) / 0.28); y = 0
    if ang > 0:  # heel lift: rotate about the toe so the toe stays on the ground
      t = math.radians(ang); y = TOE * math.sin(t) * 0.9
    return x, y, -ang if ang > 0 else -ang, True
  v = (ph - beta) / (1 - beta); x = -a + 2 * a * ease(v); y = lift * math.sin(math.pi * v ** 0.8) + (TOE * math.sin(math.radians(toe_off)) * 0.9) * max(0, 1 - v * 4)
  ang = toe_off * (1 - v) + strike * v
  return x, y, -ang, False
GAITS = {
  'walk': dict(n=16, a=19, beta=0.56, lift=8, hip=41, lean=4, arm=24, elbow=14, bob=1.6, toe=22, strike=-12),
  'run': dict(n=20, a=25, beta=0.30, lift=20, hip=39.5, lean=11, arm=52, elbow=78, bob=3.0, toe=30, strike=-8),
}
meta = {}
def save(name, p, extra=None):
  im, feet = render(p); bb = im.getchannel('A').point(lambda v: 255 if v > 24 else 0).getbbox(); im = im.crop(bb)
  im.save(OUT + name + '.png'); m = {'pv': [round(HX - bb[0], 2), round(GY - bb[1], 2)], 'w': im.width, 'h': im.height}
  if extra: m.update(extra)
  meta[name] = m
for g, G in GAITS.items():
  D = 2 * G['a'] / G['beta']  # stride per cycle (atlas px): stance length / stance fraction
  meta['_' + g] = {'cycle_px': round(D, 2), 'frames': G['n'], 'beta': G['beta']}
  for i in range(G['n']):
    ph = i / G['n']; fn = foot_at(ph, G['a'], G['beta'], G['lift'], G['toe'], G['strike']); ff = foot_at(ph + 0.5, G['a'], G['beta'], G['lift'], G['toe'], G['strike'])
    st = [s for s in (fn, ff) if s[3]]
    # hip height: nominal, minus a dip after each contact; planted feet clamp it into reach
    hh = G['hip'] - G['bob'] * (0.5 + 0.5 * math.cos(4 * math.pi * (ph - G['beta'] * 0.35)))
    if g == 'run' and not st: hh += G['bob'] * 0.8 * math.sin(math.pi * ((ph % 0.5) - G['beta']) / (0.5 - G['beta']))
    for s in st: hh = min(hh, math.sqrt(max(1, ((L1 + L2) * 0.985) ** 2 - (s[0] + (3 if s is fn else -3)) ** 2)) - s[1])
    sw = math.cos(2 * math.pi * (ph - G['beta'] / 2))  # near leg forward -> near arm back
    vy = -math.sin(4 * math.pi * (ph - G['beta'] * 0.35))
    p = dict(hip_h=hh, lean=G['lean'], feet=[(fn[0], fn[1], fn[2]), (ff[0], ff[1], ff[2])],
             arms=[(-G['arm'] * sw + (8 if g == 'run' else 2), G['elbow']), (G['arm'] * sw + (8 if g == 'run' else 2), G['elbow'])],
             cape=(-16 if g == 'run' else -5) + 4 * math.sin(2 * math.pi * ph * 2), sprout=(8 if g == 'run' else 3) + 6 * vy)
    save(f'{g}{i}', p, {'contact': [round(fn[0] + 0, 2) if fn[3] else None, round(ff[0], 2) if ff[3] else None]})
# idle / start / stop / turn
save('idle0', dict(hip_h=42, lean=0, feet=[(6, 0, 0), (-6, 0, 0)], arms=[(6, 10), (-4, 10)], cape=0, sprout=0))
save('idle1', dict(hip_h=41, lean=-1, feet=[(6, 0, 0), (-6, 0, 0)], arms=[(9, 16), (-1, 16)], cape=2, sprout=-4))
save('start0', dict(hip_h=38, lean=10, feet=[(10, 7, 10), (-10, 0, 0)], arms=[(-20, 30), (25, 30)], cape=-6, sprout=8))
save('start1', dict(hip_h=39, lean=14, feet=[(22, 4, -6), (-22, 2, -20)], arms=[(-35, 60), (35, 60)], cape=-12, sprout=10))
save('stop0', dict(hip_h=36, lean=-12, feet=[(26, 0, -14), (-6, 3, 0)], arms=[(30, 25), (18, 25)], cape=10, sprout=-12))
save('stop1', dict(hip_h=39, lean=-4, feet=[(12, 0, -4), (-6, 0, 0)], arms=[(16, 18), (6, 18)], cape=6, sprout=-6))
save('turn0', dict(hip_h=37, lean=-6, feet=[(4, 0, 0), (-4, 2, 6)], arms=[(10, 50), (-6, 50)], cape=8, sprout=-10))
json.dump(meta, open(OUT + 'rig.json', 'w'), indent=0)
print('rig frames', len([k for k in meta if not k.startswith('_')]), {k: v for k, v in meta.items() if k.startswith('_')})
if '--preview' in sys.argv:
  names = [k for k in meta if not k.startswith('_')]; cw, ch = 200, 260; cols = 12; rows = (len(names) + cols - 1) // cols
  pv = Image.new('RGB', (cw * cols, ch * rows), (40, 44, 52)); d = ImageDraw.Draw(pv)
  for i, n in enumerate(names):
    im = Image.open(OUT + n + '.png'); m = meta[n]; cx, cy = (i % cols) * cw + 90, (i // cols) * ch + 245
    pv.paste(im, (int(cx - m['pv'][0]), int(cy - m['pv'][1])), im); d.line([(cx - 90, cy), (cx + 100, cy)], fill=(120, 200, 120)); d.line([(cx, cy - 6), (cx, cy + 6)], fill=(255, 80, 80))
    d.text(((i % cols) * cw + 4, (i // cols) * ch + 4), n, fill=(255, 255, 0))
  pv.save('/tmp/rig_preview.png')
