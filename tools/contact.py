# contact sheet: python3 tools/contact.py out.png img1 img2 ... (2 columns, scaled to 640 wide)
import sys
from PIL import Image, ImageDraw
out, files = sys.argv[1], sys.argv[2:]
W = 640; ims = []
for f in files:
    im = Image.open(f).convert('RGB'); im = im.resize((W, round(im.height * W / im.width))); ims.append((f.split('/')[-1], im))
H = max(i.height for _, i in ims); cols = 2; rows = (len(ims) + 1) // 2
sheet = Image.new('RGB', (cols * W + 10, rows * (H + 18)), (20, 20, 20)); d = ImageDraw.Draw(sheet)
for k, (n, im) in enumerate(ims):
    x, y = (k % cols) * (W + 10), (k // cols) * (H + 18); sheet.paste(im, (x, y + 16)); d.text((x + 4, y + 2), n, fill=(255, 255, 0))
sheet.save(out)
