# v1.1 vs v1.2 comparison sheets: python3 tools/compare.py
from PIL import Image, ImageDraw, ImageFont
A, B = 'shots/v11/', 'shots/v12/'
SETS = [['02-tutorial', '04-room', '05-combat', '06-miniboss'], ['07-boss', '08-bloom', '09-victory', '12-death'], ['01-title', '03-hub', '10-touch-915x412', '11-low-quality']]
W = 640
try: F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 18)
except Exception: F = ImageFont.load_default()
for k, names in enumerate(SETS, 1):
    rows = []
    for n in names:
        a, b = Image.open(A + n + '.png').convert('RGB'), Image.open(B + n + '.png').convert('RGB')
        a = a.resize((W, round(a.height * W / a.width)), Image.LANCZOS); b = b.resize((W, round(b.height * W / b.width)), Image.LANCZOS); rows.append((n, a, b))
    H = sum(r[1].height + 30 for r in rows) + 34
    S = Image.new('RGB', (W * 2 + 30, H), (20, 18, 30)); d = ImageDraw.Draw(S)
    d.text((10, 8), 'v1.1  (left)', fill=(200, 200, 220), font=F); d.text((W + 20, 8), 'v1.2  (right)', fill=(255, 226, 122), font=F)
    y = 34
    for n, a, b in rows:
        d.text((10, y + 4), n, fill=(230, 230, 240), font=F); y += 28; S.paste(a, (10, y)); S.paste(b, (W + 20, y)); y += a.height + 2
    S.save(f'shots/compare-v12-{k}.png'); print('wrote', f'shots/compare-v12-{k}.png', S.size)
