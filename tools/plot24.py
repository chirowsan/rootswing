# velocity / acceleration plots from feel24 traces: python3 tools/plot24.py <tag> [baseline=before] -> shots/v24/<tag>/plots.png
import sys, json, math, os
import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
tag = sys.argv[1]; base = sys.argv[2] if len(sys.argv) > 2 else 'before'; R = 'shots/v24/'
def load(t):
    p = R + t + '/feel.json'; return json.load(open(p)) if os.path.exists(p) else None
A, B = load(tag), load(base)
def sp(tr): return [math.hypot(r['vx'], r['vy']) for r in tr]
def acc(v): return [0] + [(v[i] - v[i - 1]) * 60 for i in range(1, len(v))]
fig, ax = plt.subplots(3, 3, figsize=(16, 11)); fig.suptitle(f'Rootswing v2.4 feel traces — {tag} (solid) vs {base} (dashed)')
def line(a, key, f, title, yl, sub=None):
    for d, st, lab in ((B, '--', base), (A, '-', tag)):
        if not d or key not in d['tr']: continue
        tr = d['tr'][key]; tr = [r for r in tr if (sub is None or sub(r))]; y = f(tr); a.plot(range(len(y)), y, st, label=lab, lw=1.6 if st == '-' else 1.1)
    a.set_title(title); a.set_xlabel('frame (60 Hz)'); a.set_ylabel(yl); a.legend(); a.grid(alpha=.3)
sw = lambda r: r['hook'] == 'swing'
line(ax[0][0], 'swing', sp, 'Swing: speed, no input (energy kept)', 'px/s', sw)
line(ax[0][1], 'swing', lambda t: acc(sp(t)), 'Swing: tangential accel (smooth = good)', 'px/s²', sw)
line(ax[0][2], 'pump', sp, 'Pump: speed while pumping with the stick', 'px/s', sw)
for d, st, lab in ((B, '--', base), (A, '-', tag)):
    if d and 'release' in d['tr']: tr = d['tr']['release']; ax[1][0].plot([r['x'] - tr[0]['x'] for r in tr], [-(r['y'] - tr[0]['y']) for r in tr], st, label=lab)
ax[1][0].set_title('Release: path (x, height)'); ax[1][0].set_aspect('equal', 'datalim'); ax[1][0].legend(); ax[1][0].grid(alpha=.3)
line(ax[1][1], 'release', sp, 'Release: speed through swing → launch → air', 'px/s')
def tipv(tr):
    pts = [r.get('tip') for r in tr]; v = [0]
    for i in range(1, len(pts)): v.append(math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) * 60 if pts[i] and pts[i - 1] else 0)
    return v
line(ax[1][2], 'whip', tipv, 'Whip: tip speed (spike = crack)', 'px/s')
line(ax[2][0], 'whip', lambda t: [r['vx'] for r in t], 'Whip: hero vx during combo (lunge/steer)', 'px/s')
for d, st, lab in ((B, '--', base), (A, '-', tag)):
    if d and d['tr'].get('arrow'): ar = d['tr']['arrow']; ax[2][1].plot([p[1] - ar[0][1] for p in ar], [-(p[2] - ar[0][2]) for p in ar], st + ('' if st == '--' else 'o'), ms=2, label=lab)
ax[2][1].set_title('Bow: arrow paths (arc)'); ax[2][1].legend(); ax[2][1].grid(alpha=.3)
for d, st, lab in ((B, '--', base), (A, '-', tag)):
    if d and 'bow' in d['tr'] and 'bowK' in d['tr']['bow'][0]: ax[2][2].plot([max(0, r['bowK']) for r in d['tr']['bow']], st, label=lab + ' draw k')
ax[2][2].set_title('Bow: draw charge k over time (tap, then hold)'); ax[2][2].legend(); ax[2][2].grid(alpha=.3)
plt.tight_layout(); out = R + tag + '/plots.png'; plt.savefig(out, dpi=72); print(out)
