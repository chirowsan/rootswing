# Version comparison sheets: python3 tools/compare.py [old new]   (default v12 v13)
import sys
from PIL import Image, ImageDraw, ImageFont
OLD, NEW = (sys.argv[1:3] if len(sys.argv) > 2 else ['v12', 'v13']); A, B = f'shots/{OLD}/', f'shots/{NEW}/'
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
    d.text((10, 8), f'{OLD[0]}{OLD[1]}.{OLD[2:]}  (left)', fill=(200, 200, 220), font=F); d.text((W + 20, 8), f'{NEW[0]}{NEW[1]}.{NEW[2:]}  (right)', fill=(255, 226, 122), font=F)
    y = 34
    for n, a, b in rows:
        d.text((10, y + 4), n, fill=(230, 230, 240), font=F); y += 28; S.paste(a, (10, y)); S.paste(b, (W + 20, y)); y += a.height + 2
    S.save(f'shots/compare-{NEW}-{k}.png'); print('wrote', f'shots/compare-{NEW}-{k}.png', S.size)

# new-content sheet (no old counterpart): biome 2 + pause map, 2 columns
import os
N2 = ['11-cave-room', '12-cave-combat', '13-cave-miniboss', '14-final-boss', '15-final-victory', '16-pausemap']
if all(os.path.exists(B + n + '.png') for n in N2):
    ims = [(n, Image.open(B + n + '.png').convert('RGB')) for n in N2]; ims = [(n, im.resize((W, round(im.height * W / im.width)), Image.LANCZOS)) for n, im in ims]
    h = ims[0][1].height; S = Image.new('RGB', (W * 2 + 30, 34 + 3 * (h + 30)), (20, 18, 30)); d = ImageDraw.Draw(S)
    d.text((10, 8), f'{NEW}: new in this version (Drowned Glowroots biome, final boss, pause map)', fill=(255, 226, 122), font=F)
    for i, (n, im) in enumerate(ims):
        x, y = 10 + (i % 2) * (W + 10), 34 + (i // 2) * (h + 30); d.text((x, y + 4), n, fill=(230, 230, 240), font=F); S.paste(im, (x, y + 28))
    S.save(f'shots/compare-{NEW}-new.png'); print('wrote', f'shots/compare-{NEW}-new.png', S.size)
