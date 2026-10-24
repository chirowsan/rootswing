# Builds src/chunks2.js: v1.3 big-map chunks (wide/tall multi-cell rooms, checkpoints, caverns rooms, extra dead ends).
# Grids are drawn with helpers so every row is exactly 34 (or 68) wide.
import json
W, H = 34, 20
def grid(w=W, h=H):
    g = [['.'] * w for _ in range(h)]
    for x in range(w): g[0][x] = '#'; g[h - 2][x] = '#'; g[h - 1][x] = '#'
    for y in range(h): g[y][0] = '#'; g[y][w - 1] = '#'
    return g
def box(g, x0, y0, x1, y1, c='#'):
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1): g[y][x] = c
def put(g, x, y, c): g[y][x] = c
def plank(g, x0, x1, y): box(g, x0, y, x1, y, '=')
def lan(g, *xs, y=4):
    for x in xs: put(g, x, y, 'L')
out = []
def emit(id, exits, tags, g):
    rows = [''.join(r) for r in g]
    assert all(len(r) == len(rows[0]) for r in rows), id
    out.append({'id': id, 'exits': exits, 'tags': tags, 'rows': rows})
# ---- longswing: thorn pit crossed by swing anchors
g = grid(); box(g, 7, 18, 26, 18, '^'); box(g, 1, 18, 6, 18, '#'); box(g, 27, 18, 32, 18, '#')
for x, y in [(10, 7), (17, 5), (24, 7)]: put(g, x, y, 'o')
box(g, 15, 12, 18, 12, '='); lan(g, 4, 16, 29); put(g, 16, 11, 'g'); put(g, 3, 17, 'j'); put(g, 30, 17, 'e'); put(g, 17, 9, 'f')
box(g, 1, 1, 33 - 1, 1, '#'); emit('longswing', 'LR', ['platform'], g)
# ---- zigshaft: vertical hook shaft (L, U, D)
g = grid(); box(g, 1, 1, 9, 12); box(g, 24, 1, 32, 17)
for i, y in enumerate([3, 7, 11, 15]): put(g, 13 if i % 2 else 20, y, 'z')
plank(g, 10, 13, 5); plank(g, 19, 23, 9); plank(g, 10, 13, 13); put(g, 16, 6, 'f'); put(g, 4, 17, 'e'); lan(g, 12, 21, y=2); put(g, 6, 15, 'g')
box(g, 15, 0, 18, 0, '#'); emit('zigshaft', 'LUD', ['platform'], g)
# ---- pillarhall: combat hall with pillars
g = grid(); box(g, 1, 1, 32, 2)
for x in (9, 16, 23): box(g, x, 12, x + 1, 17)
plank(g, 6, 12, 9); plank(g, 20, 27, 9); put(g, 16, 8, 'o'); lan(g, 5, 16, 28, y=4)
for x, c in [(5, 'e'), (13, 'h'), (20, 'e'), (28, 'j')]: put(g, x, 17, c)
put(g, 12, 7, 'g'); put(g, 21, 7, 'g'); emit('pillarhall', 'LR', ['combat'], g)
# ---- canopy: upper planks + drop hole (L, R, D)
g = grid(); plank(g, 3, 9, 13); plank(g, 13, 20, 10); plank(g, 24, 30, 13); put(g, 8, 6, 'z'); put(g, 25, 6, 'z'); put(g, 16, 4, 'o')
box(g, 12, 18, 21, 19, '#'); lan(g, 6, 27); put(g, 16, 9, 'g'); put(g, 4, 17, 'e'); put(g, 29, 17, 'b'); put(g, 22, 8, 'f')
emit('canopy', 'LRD', ['combat'], g)
# ---- checkpoint shrine (save room)
g = grid(); box(g, 1, 1, 32, 3); box(g, 1, 4, 5, 9); box(g, 28, 4, 32, 9); box(g, 13, 17, 20, 17)
put(g, 16, 16, 'S'); lan(g, 9, 24, y=6); lan(g, 16, y=5); put(g, 11, 15, 'g'); put(g, 22, 15, 'g'); plank(g, 7, 11, 12); plank(g, 22, 26, 12)
emit('checkpoint', 'LR', ['checkpoint'], g)
g = grid(); box(g, 1, 1, 32, 2); box(g, 6, 17, 27, 17); box(g, 10, 16, 23, 16)
put(g, 16, 15, 'S'); lan(g, 8, 25, y=5); plank(g, 3, 7, 11); plank(g, 26, 30, 11); put(g, 16, 6, 'o'); put(g, 5, 10, 'g'); put(g, 28, 10, 'g')
emit('checkpoint2', 'LR', ['checkpoint'], g)
# ---- wide traversal room (68 x 20) split into two cells
g = grid(68)
box(g, 8, 18, 59, 18, '^'); box(g, 1, 18, 7, 18, '#'); box(g, 60, 18, 66, 18, '#')
for x in (14, 30, 46): box(g, x, 13, x + 3, 17)
for x, y in [(11, 7), (22, 6), (38, 6), (54, 7)]: put(g, x, y, 'o')
put(g, 33, 3, 'z'); plank(g, 28, 38, 9); plank(g, 44, 50, 11); plank(g, 17, 22, 11)
lan(g, 6, 20, 34, 48, 62); put(g, 15, 12, 'g'); put(g, 31, 12, 'g'); put(g, 47, 12, 'g'); put(g, 33, 8, 'c')
put(g, 4, 17, 'e'); put(g, 63, 17, 'e'); put(g, 26, 8, 'f'); put(g, 52, 9, 'f'); put(g, 32, 12, 'j')
emit('wideA', 'LR', ['wideA'], [r[:34] for r in g]); emit('wideB', 'LR', ['wideB'], [r[34:] for r in g])
for r in out[-2:]: pass
# tunnel variant: a long low gallery with ceiling thorns and zips
g = grid(68); box(g, 1, 1, 66, 6)
for x in range(8, 60, 9): box(g, x, 7, x + 1, 8, '#'); put(g, x, 9, 'v'); put(g, x + 1, 9, 'v')
for x in (12, 30, 48): plank(g, x, x + 5, 13)
for x in (20, 39, 57): put(g, x, 9, 'z')
box(g, 24, 18, 27, 18, '^'); box(g, 42, 18, 45, 18, '^')
lan(g, 4, 22, 40, 60, y=10); put(g, 6, 17, 'h'); put(g, 34, 17, 'k'); put(g, 62, 17, 'e'); put(g, 15, 12, 'g'); put(g, 51, 12, 'g'); put(g, 33, 12, 't')
emit('tunnelA', 'LR', ['wideA'], [r[:34] for r in g]); emit('tunnelB', 'LR', ['wideB'], [r[34:] for r in g])
# ---- tall shaft room (34 x 40) split into two cells: top L+D, bottom U+L
g = grid(34, 40)
box(g, 22, 1, 32, 37)  # right wall mass
box(g, 1, 18, 8, 19)   # ledge under the top-left entrance
for y, x in [(9, 15), (16, 11), (23, 17), (30, 12)]: put(g, x, y, 'z')
for y, a, b in [(12, 9, 13), (20, 14, 19), (27, 6, 10), (33, 13, 18)]: plank(g, a, b, y)
put(g, 18, 6, 'o'); lan(g, 4, 16, y=3); lan(g, 5, 18, y=24)
put(g, 4, 17, 'e'); put(g, 16, 14, 'f'); put(g, 8, 26, 'g'); put(g, 16, 19, 'g'); put(g, 6, 37, 'e'); put(g, 15, 37, 'j'); put(g, 19, 22, 'f')
box(g, 15, 38, 18, 39, '#')
emit('tallA', 'LD', ['tallA'], g[:20]); emit('tallB', 'UL', ['tallB'], g[20:])
# ---- extra dead ends
g = grid(); box(g, 1, 1, 32, 4); box(g, 1, 5, 7, 17); box(g, 26, 5, 32, 17); box(g, 8, 16, 25, 17)
lan(g, 11, 22, y=7); plank(g, 9, 13, 11); plank(g, 20, 24, 11); box(g, 15, 16, 18, 17, '.'); box(g, 15, 18, 18, 19, '.'); box(g, 13, 16, 14, 16, '#'); box(g, 19, 16, 20, 16, '#')
put(g, 10, 15, 'F'); put(g, 16, 13, 'z'); put(g, 16, 8, 'z'); put(g, 16, 15, '.')
emit('shrineD', 'D', ['fountain'], g)
g = grid(); box(g, 1, 1, 14, 3); box(g, 19, 1, 32, 3); box(g, 1, 4, 5, 17); box(g, 28, 4, 32, 17)
for y, x in [(6, 16), (11, 12)]: put(g, x, y, 'z')
plank(g, 13, 20, 9); plank(g, 8, 14, 13); put(g, 22, 17, 'c'); put(g, 9, 17, 'e'); put(g, 17, 16, 'g'); lan(g, 8, 25, y=5)
emit('vaultU', 'U', ['treasure'], g)
g = grid(); box(g, 1, 1, 32, 4); box(g, 1, 5, 6, 17); box(g, 27, 5, 32, 17); box(g, 7, 16, 14, 17); box(g, 19, 16, 26, 17)
put(g, 10, 15, 'W'); put(g, 16, 13, 'z'); lan(g, 12, 21, y=7); plank(g, 14, 19, 11); put(g, 23, 15, 'g'); put(g, 16, 9, 'f')
emit('armoryD', 'D', ['weapon'], g)
g = grid(); box(g, 1, 1, 32, 3); box(g, 28, 4, 32, 17); box(g, 8, 18, 22, 18, '^'); put(g, 12, 9, 'o'); put(g, 19, 8, 'o')
box(g, 23, 15, 27, 17); put(g, 25, 14, 'c'); put(g, 4, 17, 'j'); lan(g, 6, 18, y=5); put(g, 15, 6, 'g'); put(g, 16, 6, 'g')
emit('gauntletL', 'L', ['treasure'], g)
# ---- caverns-only rooms (tag 'cav'); w = lurefish, y = jelly, s = shellback
g = grid(); box(g, 9, 18, 24, 18, '~'); put(g, 12, 8, 'o'); put(g, 21, 8, 'o'); plank(g, 14, 19, 12); lan(g, 5, 16, 28)
put(g, 4, 17, 's'); put(g, 16, 6, 'y'); put(g, 27, 12, 'w'); put(g, 16, 11, 'g'); put(g, 29, 17, 'e')
emit('glowpool', 'LR', ['combat', 'cav'], g)
g = grid(); box(g, 1, 1, 13, 1); box(g, 20, 1, 32, 1)
for y, a, b in [(5, 18, 25), (9, 8, 14), (13, 20, 27)]: plank(g, a, b, y)
put(g, 16, 3, 'z'); put(g, 11, 7, 'z'); put(g, 23, 11, 'z'); put(g, 10, 12, 'y'); put(g, 24, 4, 'y'); put(g, 6, 17, 'w'); put(g, 26, 17, 's'); lan(g, 5, 29, y=3); put(g, 21, 4, 'g')
emit('jellyshaft', 'LRU', ['platform', 'cav'], g)
g = grid(); box(g, 1, 18, 32, 18, '~'); box(g, 1, 18, 4, 18, '#'); box(g, 29, 18, 32, 18, '#')
for a in (6, 14, 22): plank(g, a, a + 5, 15)
box(g, 1, 15, 4, 17, '.'); put(g, 9, 14, 's'); put(g, 25, 14, 's'); put(g, 16, 7, 'o'); put(g, 17, 10, 'w'); lan(g, 8, 25, y=4); put(g, 17, 13, 'g')
for r in range(15, 18): g[r][1] = '.'
emit('shellbridge', 'LR', ['platform', 'cav'], g)
g = grid(); box(g, 1, 1, 32, 2); box(g, 12, 18, 21, 19, '#'); box(g, 6, 12, 9, 17); box(g, 24, 12, 27, 17)
put(g, 16, 6, 'o'); put(g, 7, 6, 'z'); put(g, 26, 6, 'z'); put(g, 16, 11, 'y'); put(g, 3, 17, 'w'); put(g, 30, 17, 's'); put(g, 16, 17, 'e'); lan(g, 12, 21, y=5); put(g, 7, 11, 'g'); put(g, 25, 11, 'g')
emit('drowned', 'LRD', ['combat', 'cav'], g)
g = grid(); box(g, 1, 1, 32, 2); box(g, 1, 3, 4, 8); box(g, 29, 3, 32, 8); put(g, 8, 6, 'o'); put(g, 25, 6, 'o'); plank(g, 13, 20, 11)
lan(g, 6, 16, 27, y=4); put(g, 16, 15, 'M'); emit('grotto', 'LR', ['miniboss', 'cav'], g)
js = '// Generated by tools/gen-chunks2.py (v1.3 big-map rooms). Do not edit by hand.\nexport const CHUNKS2 = ' + json.dumps(out, separators=(',', ':')).replace('},{', '},\n{') + ';\n'
open('src/chunks2.js', 'w').write(js); print(len(out), 'chunks')
