# v2.1 story art: comic panels -> assets/gfx/p_*.webp (960x540), sprites chroma-keyed -> s_*.webp
import subprocess, os
from PIL import Image, ImageEnhance
S, O = 'art/story/', 'assets/gfx/'
def panel(src, name, crop=None, w=960, h=540, q=72):
    im = Image.open(src).convert('RGB')
    if crop: im = im.crop(crop)
    # cover-fit to w x h
    r = max(w / im.width, h / im.height); im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
    l, t = (im.width - w) // 2, (im.height - h) // 2; im = im.crop((l, t, l + w, t + h))
    im.save(O + name + '.webp', quality=q, method=6)
for n in ['intro1', 'intro2', 'intro3', 'intro4', 'intro5', 'intro6', 'free1', 'free2', 'free3', 'free4', 'ember', 'plant', 'bloom', 'festival']:
    panel(S + n + '.jpg', 'p_' + n)
# warden portraits cropped from the villain line-up (consistent faces), 4:3-ish crops shown as square cards
for i, box in enumerate([tuple(round(v * 1.25) for v in b) for b in [(55, 270, 305, 556), (293, 272, 543, 558), (513, 272, 763, 558), (737, 272, 987, 558)]]):
    panel(S + 'intro3.jpg', f'p_ward{i + 1}', crop=box, w=420, h=480, q=74)
panel(S + 'intro3.jpg', 'p_ward5', crop=(325, 0, 975, 412), w=520, h=330, q=74)
def key(src, name, green=False, maxw=512, extra=()):
    tmp = '/tmp/' + name + '.png'
    subprocess.run(['python3', 'tools/key.py', src, tmp, '--trim', '--maxw', str(maxw)] + (['--green'] if green else []) + list(extra), check=True)
    Image.open(tmp).save(O + name + '.webp', quality=80, method=6)
key(S + 's_moss.jpg', 's_moss', maxw=360)
key(S + 's_root0.jpg', 's_root0', maxw=520)
key(S + 's_root1.jpg', 's_root1', maxw=520, extra=['--lo', '30', '--hi', '80'])
key(S + 's_blight.jpg', 's_blight', green=True, maxw=520)
for n in ['boss_body', 'boss2_body', 'warden']:
    key('art/src/' + n + '.jpg', 's_' + n.replace('_body', ''), green=True, maxw=420)
