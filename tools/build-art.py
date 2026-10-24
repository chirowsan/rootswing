# Process raw generated art (art/src/*.jpg) into game-ready WebP: keyed parallax layers, seamless tile textures and a
# packed sprite atlas (assets/gfx/atlas.webp + atlas.json). Run: python3 tools/build-art.py
import subprocess, json, os, numpy as np
from PIL import Image
S, T, O = 'art/src/', 'art/out/', 'assets/gfx/'
os.makedirs(T, exist_ok=True); os.makedirs(O, exist_ok=True)
def key(name, green=False, extra=()):
    out = T + name + '.png'
    subprocess.run(['python3', 'tools/key.py', S + name + '.jpg', out] + (['--green'] if green else []) + list(extra), check=True, capture_output=True)
    return Image.open(out)
meta = {'bg': {}, 'tex': {}, 'spr': {}}
# ---- parallax layers: [file, green, opaque]
for n, g, opaque in [('ov_sky', 0, 1), ('ov_far', 0, 0), ('ov_mid', 0, 0), ('ov_near', 0, 0), ('fg_vines', 0, 0),
                     ('hub_sky', 0, 1), ('hub_mid', 0, 0), ('hub_near', 0, 0), ('boss_sky', 0, 1), ('boss_mid', 1, 0), ('boss_near', 1, 0), ('title_key', 0, 1)]:
    im = Image.open(S + n + '.jpg').convert('RGB') if opaque else key(n, g)
    W, H = im.size; top = 0
    if not opaque:
        bb = im.getchannel('A').point(lambda v: 255 if v > 6 else 0).getbbox(); top, bot = (bb[1], bb[3]) if bb else (0, H)
        if n.startswith('fg'): top, bot = 0, bot
        im = im.crop((0, top, W, bot))
    sc = 1 if n == 'title_key' else 1
    im.save(O + n + '.webp', quality=80 if opaque else 84, method=6)
    meta['bg'][n] = {'w': W, 'h': H, 'top': top, 'ih': im.height}
# ---- seamless tile textures (offset + cross-fade the seams)
def seamless(im, size=512):
    im = im.convert('RGB').resize((size, size), Image.LANCZOS); a = np.asarray(im).astype(np.float32)
    sh = np.roll(np.roll(a, size // 2, 0), size // 2, 1)
    y = np.abs(np.linspace(-1, 1, size)); m = np.clip((np.maximum(y[:, None], y[None, :]) - 0.72) / 0.28, 0, 1)[..., None]
    # m=1 near edges of the original -> use shifted copy (whose centre is the seam-free original edge)
    out = a * (1 - m) + sh * m
    return Image.fromarray(out.astype(np.uint8))
for n in ['tex_stone', 'tex_metal', 'tex_root']:
    seamless(Image.open(S + n + '.jpg'), 384).save(O + n + '.webp', quality=82, method=6)
# ---- sprite sheets split by empty-column gaps
def split(im, names, gap=None, ds=4):
    # connected components on a downsampled alpha mask; keep the N largest, ordered left to right
    from collections import deque
    W, H = im.size; small = im.getchannel('A').resize((W // ds, H // ds), Image.BILINEAR)
    m = np.asarray(small) > 40; h, w = m.shape; lab = np.zeros((h, w), np.int32); comps = []
    for y0 in range(h):
        for x0 in range(w):
            if m[y0, x0] and not lab[y0, x0]:
                n = len(comps) + 1; q = deque([(y0, x0)]); lab[y0, x0] = n; cnt = 0
                while q:
                    y, x = q.popleft(); cnt += 1
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            yy, xx = y + dy, x + dx
                            if 0 <= yy < h and 0 <= xx < w and m[yy, xx] and not lab[yy, xx]: lab[yy, xx] = n; q.append((yy, xx))
                comps.append((cnt, n))
    comps.sort(reverse=True); keep = [n for _, n in comps[:len(names)]]
    assert len(keep) == len(names), (names, comps[:8])
    info = []
    for n in keep:
        ys, xs = np.nonzero(lab == n); info.append((xs.mean(), n))
    info.sort(); out = {}
    for nm, (_, n) in zip(names, info):
        cm = Image.fromarray(((lab == n) * 255).astype(np.uint8)).resize((W, H), Image.NEAREST)
        from PIL import ImageFilter
        cm = cm.filter(ImageFilter.MaxFilter(2 * ds + 1))
        a = Image.fromarray(np.minimum(np.asarray(im.getchannel('A')), np.asarray(cm)))
        c = im.copy(); c.putalpha(a); bb = a.point(lambda v: 255 if v > 20 else 0).getbbox(); out[nm] = c.crop(bb)
    return out
sprites = {}
def add(d, scale):
    for k, v in d.items(): sprites[k] = v.resize((max(1, round(v.width * scale)), max(1, round(v.height * scale))), Image.LANCZOS)
def single(im):
    return im.crop(im.getchannel('A').point(lambda v: 255 if v > 20 else 0).getbbox())
hp = split(key('hero_parts'), ['head', 'torso', 'arm', 'leg', 'leg2'])
t = hp['torso']; hp['torso'] = t.crop((0, int(t.height * 0.25), t.width, t.height)); t = hp['head']; hp['head'] = t.crop((0, 0, t.width, int(t.height * 0.95)))
add(hp, 0.42)
add({'hero_full': single(key('hero_concept'))}, 0.3)
add(split(key('weapons'), ['w_blade', 'w_hammer', 'w_bow', 'w_whip']), 0.4)
add(split(key('enemies_a', True), ['hopper', 'charger', 'moth', 'puffcap']), 0.5)
add(split(key('enemies_b', True), ['knight', 'bomber', 'dummy', 'tturret']), 0.5)
add({'warden': single(key('warden', True, ['--lo', '60', '--hi', '140']))}, 0.42)
add({'boss': single(key('boss_body', True))}, 0.5)
add(split(key('boss_fists', True), ['fist', 'pipe']), 0.4)
add(split(key('props_a'), ['lantern', 'crate', 'sign', 'chest', 'fountain']), 0.5)
add(split(key('props_b'), ['pedestal', 'door', 'station', 'ring', 'crystal']), 0.5)
add(split(key('hud_icons'), ['leaf', 'leafdry', 'glim', 'flask', 'dew', 'bomb']), 0.4)
add({'moss': single(key('moss_strip'))}, 0.5)
# shelf-pack
items = sorted(sprites.items(), key=lambda kv: -kv[1].height); AW = 2048; x = y = sh = 0; pos = {}
for k, im in items:
    if x + im.width + 2 > AW: x = 0; y += sh + 2; sh = 0
    pos[k] = (x, y, im.width, im.height); x += im.width + 2; sh = max(sh, im.height)
AH = y + sh; atlas = Image.new('RGBA', (AW, AH), (0, 0, 0, 0))
for k, im in sprites.items(): atlas.paste(im, pos[k][:2])
atlas.save(O + 'atlas.webp', quality=88, method=6, alpha_quality=90)
meta['spr'] = pos; meta['atlas'] = [AW, AH]
json.dump(meta, open(O + 'atlas.json', 'w'), separators=(',', ':'))
print('atlas', AW, AH, {k: v[2:] for k, v in pos.items()})
