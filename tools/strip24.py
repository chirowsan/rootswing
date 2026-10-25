# contact sheet: python3 tools/strip24.py <dir> <prefix> [cols] [crop w h]  -> <dir>/<prefix>-strip.png
import sys, glob, os
from PIL import Image, ImageDraw
d, pre = sys.argv[1], sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 6
fs = sorted(glob.glob(os.path.join(d, pre + '-[0-9]*.png')))
ims = [Image.open(f).convert('RGB') for f in fs]
if len(sys.argv) > 5:
    cw, ch = int(sys.argv[4]), int(sys.argv[5]); ims = [i.crop(((i.width - cw) // 2, (i.height - ch) // 2, (i.width + cw) // 2, (i.height + ch) // 2)) for i in ims]
w, h = ims[0].size; sc = min(1, 320 / w); tw, th = int(w * sc), int(h * sc)
rows = (len(ims) + cols - 1) // cols; S = Image.new('RGB', (cols * tw, rows * th), (10, 10, 14)); D = ImageDraw.Draw(S)
for i, im in enumerate(ims):
    x, y = (i % cols) * tw, (i // cols) * th; S.paste(im.resize((tw, th)), (x, y)); D.text((x + 4, y + 3), os.path.basename(fs[i])[:-4], fill=(255, 255, 0))
S.save(os.path.join(d, pre + '-strip.png')); print(S.size, len(ims))
