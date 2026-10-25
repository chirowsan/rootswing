# montage frame strips: python3 tools/strip24.py shots/v24/<tag> <prefix> [cols]
import sys, glob, os
from PIL import Image, ImageDraw
d, pre = sys.argv[1], sys.argv[2]; cols = int(sys.argv[3]) if len(sys.argv) > 3 else 8
fs = sorted(glob.glob(os.path.join(d, pre + '-[0-9][0-9].png')))
if not fs: sys.exit('no frames')
ims = [Image.open(f).convert('RGB') for f in fs]; w, h = ims[0].size; rows = (len(ims) + cols - 1) // cols
M = Image.new('RGB', (w * cols, h * rows), (12, 10, 20)); dr = ImageDraw.Draw(M)
for i, im in enumerate(ims): x, y = (i % cols) * w, (i // cols) * h; M.paste(im, (x, y)); dr.text((x + 4, y + 4), str(i), fill=(255, 255, 160))
M.save(os.path.join(d, f'strip-{pre}.png')); print(os.path.join(d, f'strip-{pre}.png'), M.size)
