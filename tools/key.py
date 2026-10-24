# Chroma-key a flat magenta (or --green) background to alpha. The key colour is estimated from the image border,
# alpha comes from colour distance to it, edges are despilled. usage: key.py in out [--green] [--trim] [--maxw N] [--lo 45 --hi 120]
import sys, numpy as np
from PIL import Image, ImageFilter
a = sys.argv; src, dst = a[1], a[2]; trim = '--trim' in a; green = '--green' in a
opt = lambda k, d: float(a[a.index(k) + 1]) if k in a else d
maxw = int(opt('--maxw', 0)); lo, hi = opt('--lo', 45), opt('--hi', 120)
im = np.asarray(Image.open(src).convert('RGB')).astype(np.float32)
R, G, B = im[..., 0], im[..., 1], im[..., 2]
cand = (G - np.maximum(R, B) > 70) if green else ((R + B) / 2 - G > 80)
border = np.zeros(cand.shape, bool); border[:6] = border[-6:] = True; border[:, :6] = border[:, -6:] = True
sel = cand & border
if sel.sum() < 50: sel = cand
bg = np.median(im[sel], axis=0)
d = np.sqrt(((im - bg) ** 2).sum(-1))
# also treat anything strongly key-hued as background (handles gradients in the key)
hue = (G - np.maximum(R, B)) if green else (np.minimum(R, B) - G - np.abs(R - B) * 0.25)
d = np.minimum(d, np.clip(200 - hue * 1.3, 0, 400))
alpha = np.clip((d - lo) / (hi - lo), 0, 1)
al = Image.fromarray((alpha * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.6))
alpha = np.asarray(al).astype(np.float32) / 255
if green:
    lim = np.maximum(R, B) + 6; G2 = np.where(G > lim, lim, G); out = np.stack([R, G2, B], -1)
else:
    sp = np.clip(np.minimum(R, B) - G - 6, 0, None); out = np.stack([R - sp, G, B - sp], -1)
out = np.clip(out, 0, 255)
img = Image.fromarray(np.dstack([out, alpha * 255]).astype(np.uint8), 'RGBA')
if trim:
    bb = img.getchannel('A').point(lambda v: 255 if v > 8 else 0).getbbox()
    if bb: img = img.crop(bb)
if maxw and img.width > maxw: img = img.resize((maxw, round(img.height * maxw / img.width)), Image.LANCZOS)
img.save(dst); print(dst, img.size, 'bg', bg.astype(int))
