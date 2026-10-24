// v1.5 level-design overhaul: hand-authored room chunks on a strict grid. Each chunk teaches or tests ONE idea.
// Grid rules (checked by lintChunk + proven by src/reach.js):
//   floor top = row 18; walkable bands every 3 rows (15, 12, 9, 6, 3) -> every step-up is one comfy jump (max ~3.8 rows)
//   same-band gaps <= 4 tiles (tier 1: <= 3); hook points sit in fixed bands: swing 'o' rows 5/8, zip 'z' rows 4/7/10/13
//   (2 rows above the ledge they serve); chains use one even spacing so they read as a line.
//   doors: L/R rows 14-17 at cols 0/33 (cols 1-4 always safe floor), U/D cols 15-18 (landing zone cols 12-21 trap-free).
// Legend adds (v1.5): Q root-seed spot (glimmers when not a seed room), K pop-up spikes, Y saw (rail runs over '-'),
//   C crusher (hangs from the ceiling), u crumbling plank, V steam vent, A thorn shooter (in a wall).
export const BANDS = [15, 12, 9, 6, 3], SWING_ROWS = [5, 8], ZIP_ROWS = [4, 7, 10, 13];
const W = 34, H = 20;
function room(id, exits, tags, tier, build) {
  const g = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (y === 0 || y >= 18 || x === 0 || x === W - 1 ? '#' : '.')));
  const fill = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) g[y][x] = c; };
  const R = {
    put: (x, y, c) => { g[y][x] = c; }, fill,
    plank: (x, row, len, c = '=') => fill(x, row, x + len - 1, row, c),
    block: (x, top, w, bottom = 17) => fill(x, top, x + w - 1, bottom, '#'),
    pit: (x0, x1) => fill(x0, 18, x1, 18, '~'),
    ceil: (row, x0 = 1, x1 = 32) => fill(x0, 1, x1, row, '#'),
    lamps: (...xs) => xs.forEach((x) => { if (g[4][x] === '.') g[4][x] = 'L'; }),
    open: (side) => { if (side === 'R') fill(33, 1, 33, 17, '.'); if (side === 'L') fill(0, 1, 0, 17, '.'); if (side === 'D') fill(1, 18, 32, 19, '.'); if (side === 'U') fill(1, 0, 32, 0, '.'); },
  };
  build(R);
  return { id, exits, tags: [...tags, 'v15'], tier, rows: g.map((r) => r.join('')) };
}
export const CHUNKS15 = [
  // ---------------- start / exit / rest / mini-boss ----------------
  room('start', 'RD', ['start'], 0, (r) => { r.put(4, 17, 'P'); r.plank(8, 15, 6); r.plank(20, 15, 6); r.put(10, 14, 'g'); r.put(23, 14, 'g'); r.lamps(6, 16, 27); }),
  room('gate', 'LU', ['exit'], 0, (r) => { r.plank(4, 15, 6); r.plank(12, 12, 8); r.put(28, 17, 'D'); r.put(16, 11, 'g'); r.lamps(6, 14, 22, 29); r.plank(14, 6, 6); r.plank(6, 9, 6); }),
  room('rest', 'LR', ['checkpoint'], 0, (r) => { r.put(16, 17, 'S'); r.plank(6, 15, 4); r.plank(24, 15, 4); r.put(7, 14, 'g'); r.put(25, 14, 'g'); r.lamps(5, 12, 21, 28); }),
  room('rest2', 'LR', ['checkpoint'], 0, (r) => { r.put(16, 17, 'S'); r.block(10, 16, 2); r.block(22, 16, 2); r.put(11, 15, 'g'); r.put(23, 15, 'g'); r.lamps(8, 16, 25); }),
  room('arena', 'LR', ['miniboss'], 0, (r) => { r.ceil(2); r.put(16, 17, 'M'); r.plank(4, 12, 6); r.plank(24, 12, 6); r.lamps(8, 16, 25); }),
  // ---------------- tier 1: one idea each ----------------
  room('gaps', 'LRD', ['platform', 'idea:gap'], 1, (r) => { r.pit(9, 11); r.pit(21, 23); r.put(10, 15, 'g'); r.put(22, 15, 'g'); r.put(28, 16, 'Q'); r.lamps(5, 16, 28); }),
  room('stairs', 'LR', ['platform', 'idea:stairs'], 1, (r) => {
    r.block(8, 15, 4); r.block(12, 12, 4); r.block(16, 9, 2); r.block(18, 12, 4); r.block(22, 15, 4);
    r.put(17, 7, 'Q'); r.put(10, 14, 'g'); r.put(14, 11, 'g'); r.put(20, 11, 'g'); r.put(24, 14, 'g'); r.lamps(5, 28);
  }),
  room('climb', 'LRUD', ['platform', 'idea:climb'], 1, (r) => {
    r.plank(5, 15, 8); r.plank(21, 15, 8); r.plank(11, 12, 12); r.plank(5, 9, 8); r.plank(21, 9, 8); r.plank(13, 6, 8);
    r.put(16, 4, 'Q'); r.put(8, 8, 'g'); r.put(25, 8, 'g'); r.lamps(3, 30);
  }),
  room('drop', 'LRUD', ['platform', 'idea:drop'], 1, (r) => { r.plank(4, 15, 6); r.plank(24, 15, 6); r.plank(12, 12, 10); r.plank(5, 9, 6); r.plank(23, 9, 6); r.plank(13, 6, 8); r.put(16, 11, 'Q'); r.put(6, 14, 'g'); r.put(26, 14, 'g'); r.lamps(6, 16, 27); }),
  room('arena1', 'LRD', ['combat', 'idea:fight'], 1, (r) => { r.plank(5, 15, 6); r.plank(23, 15, 6); r.plank(13, 12, 8); r.put(12, 17, 'e'); r.put(22, 17, 'e'); r.put(16, 11, 'Q'); r.lamps(8, 16, 25); }),
  room('spikes', 'LR', ['trap', 'idea:spikes'], 1, (r) => { for (const x of [9, 10, 16, 17, 23, 24]) r.put(x, 17, 'K'); r.put(28, 16, 'Q'); r.put(13, 15, 'g'); r.put(20, 15, 'g'); r.lamps(6, 16, 27); }),
  room('vents', 'LR', ['trap', 'idea:vents'], 1, (r) => { for (const x of [10, 17, 24]) r.put(x, 17, 'V'); r.plank(12, 15, 4); r.plank(19, 15, 4); r.put(28, 16, 'Q'); r.put(14, 14, 'g'); r.put(21, 14, 'g'); r.lamps(6, 16, 27); }),
  // ---------------- tier 2: harder single ideas ----------------
  room('hookchain', 'LRD', ['platform', 'idea:hookchain'], 2, (r) => {
    r.pit(7, 26); r.put(10, 8, 'o'); r.put(17, 8, 'o'); r.put(24, 8, 'o'); r.put(13, 12, 'g'); r.put(20, 12, 'g'); r.put(29, 16, 'Q'); r.lamps(4, 17, 30);
  }),
  room('hookledge', 'LRU', ['platform', 'idea:hookledge'], 2, (r) => {
    r.block(15, 9, 4); r.put(13, 7, 'z'); r.put(20, 7, 'z'); r.put(16, 8, 'Q'); r.put(10, 15, 'g'); r.put(23, 15, 'g'); r.lamps(5, 28);
  }),
  room('zipladder', 'LRUD', ['platform', 'idea:zipladder'], 2, (r) => {
    r.plank(4, 15, 6); r.plank(24, 15, 6); r.put(16, 13, 'z'); r.put(16, 10, 'z'); r.put(16, 7, 'z'); r.plank(8, 9, 4); r.plank(22, 9, 4); r.put(9, 8, 'Q'); r.put(16, 15, 'g'); r.lamps(4, 29);
  }),
  room('gaps2', 'LRD', ['platform', 'idea:gap'], 2, (r) => { r.pit(7, 10); r.pit(15, 18); r.pit(23, 26); r.put(9, 15, 'g'); r.put(17, 15, 'g'); r.put(25, 15, 'g'); r.put(29, 16, 'Q'); r.put(13, 17, 'e'); r.lamps(5, 13, 21, 29); }),
  room('arena2', 'LRU', ['combat', 'idea:fight'], 2, (r) => {
    r.block(13, 15, 8); r.plank(4, 12, 6); r.plank(24, 12, 6); r.plank(12, 9, 10); r.plank(14, 6, 6);
    r.put(8, 17, 'e'); r.put(26, 17, 'e'); r.put(17, 13, 'f'); r.put(16, 5, 'Q'); r.lamps(4, 29);
  }),
  room('saws', 'LRD', ['trap', 'idea:saws'], 2, (r) => {
    r.put(8, 17, 'Y'); for (let x = 9; x <= 25; x++) r.put(x, 17, '-'); r.plank(9, 15, 4); r.plank(15, 15, 4); r.plank(21, 15, 4);
    r.put(29, 16, 'Q'); r.put(17, 14, 'g'); r.lamps(5, 17, 28);
  }),
  room('crushers', 'LR', ['trap', 'idea:crushers'], 2, (r) => { r.ceil(9); for (const x of [9, 16, 23]) r.put(x, 10, 'C'); r.put(29, 16, 'Q'); r.put(13, 16, 'g'); r.put(20, 16, 'g'); }),
  room('crumble', 'LRD', ['trap', 'idea:crumble'], 2, (r) => {
    r.pit(6, 27); for (const x of [7, 13, 19, 25]) r.plank(x, 15, 2, 'u'); r.put(8, 13, 'g'); r.put(14, 13, 'g'); r.put(20, 13, 'g'); r.put(29, 16, 'Q'); r.lamps(4, 16, 30);
  }),
  room('ventstairs', 'LRUD', ['trap', 'idea:vents'], 2, (r) => {
    r.block(6, 15, 4); r.block(24, 15, 4); r.plank(11, 12, 12); r.put(13, 11, 'V'); r.put(20, 11, 'V'); r.plank(6, 9, 6); r.plank(22, 9, 6); r.plank(13, 6, 8);
    r.put(16, 5, 'Q'); r.put(8, 8, 'g'); r.put(25, 8, 'g'); r.lamps(3, 30);
  }),
  // ---------------- tier 3: combos ----------------
  room('hookspikes', 'LRD', ['trap', 'platform', 'idea:combo'], 3, (r) => {
    r.pit(7, 26); r.put(10, 8, 'o'); r.put(17, 8, 'o'); r.put(24, 8, 'o'); r.block(16, 15, 2); r.put(16, 14, 'K'); r.put(17, 14, 'K');
    r.put(13, 12, 'g'); r.put(20, 12, 'g'); r.put(29, 16, 'Q'); r.lamps(4, 30);
  }),
  room('sawcrumble', 'LRD', ['trap', 'idea:combo'], 3, (r) => {
    r.pit(6, 27); for (const x of [7, 13, 19, 25]) r.plank(x, 15, 2, 'u'); r.put(9, 11, 'Y'); for (let x = 10; x <= 24; x++) r.put(x, 11, '-');
    r.put(29, 16, 'Q'); r.put(16, 13, 'g'); r.lamps(4, 30);
  }),
  room('gauntlet', 'LRD', ['trap', 'combat', 'idea:combo'], 3, (r) => {
    r.ceil(9, 12, 21); r.put(16, 10, 'C'); for (const x of [8, 9, 24, 25]) r.put(x, 17, 'K'); r.put(28, 17, 'e'); r.put(29, 14, 'Q'); r.plank(27, 15, 4); r.lamps(5, 29);
  }),
  room('shooters', 'LRD', ['trap', 'idea:shooter'], 3, (r) => {
    r.block(26, 12, 2); r.put(26, 16, 'A'); r.plank(29, 15, 3); r.block(12, 16, 2); r.block(19, 16, 2); r.put(13, 15, 'g'); r.put(20, 15, 'g'); r.put(27, 11, 'Q'); r.plank(22, 15, 3); r.lamps(5, 16, 30);
  }),
  // ---------------- multi-cell rooms ----------------
  room('wideA', 'LR', ['wideA'], 3, (r) => { r.open('R'); r.pit(8, 33); r.put(11, 8, 'o'); r.put(18, 8, 'o'); r.put(25, 8, 'o'); r.put(32, 8, 'o'); r.put(14, 12, 'g'); r.put(21, 12, 'g'); r.put(28, 12, 'g'); r.lamps(4, 18, 30); }),
  room('wideB', 'LR', ['wideB'], 3, (r) => { r.open('L'); r.pit(0, 6); r.block(7, 15, 6); r.pit(13, 26); r.put(16, 8, 'o'); r.put(23, 8, 'o'); r.put(10, 13, 'Q'); r.put(19, 12, 'g'); r.lamps(4, 18, 30); }),
  room('tallA', 'LD', ['tallA'], 2, (r) => { r.fill(11, 18, 22, 19, '.'); r.plank(3, 15, 6); r.plank(24, 15, 6); r.plank(12, 12, 10); r.put(16, 11, 'g'); r.lamps(5, 28); }),
  room('tallB', 'UL', ['tallB'], 2, (r) => { r.fill(11, 0, 22, 0, '.'); r.plank(6, 6, 6); r.plank(22, 6, 6); r.plank(12, 9, 10); r.plank(5, 12, 6); r.put(16, 8, 'Q'); r.put(8, 11, 'g'); r.lamps(28); }),
  // ---------------- side rooms (dead ends) ----------------
  room('treasure', 'L', ['treasure'], 0, (r) => { r.block(14, 15, 6); r.block(20, 12, 6); r.block(26, 15, 3); r.put(23, 11, 'c'); r.put(17, 14, 'g'); r.put(28, 17, 'g'); r.lamps(10, 22); }),
  room('treasureU', 'U', ['treasure'], 0, (r) => { r.plank(8, 15, 6); r.plank(20, 15, 6); r.plank(12, 12, 10); r.plank(13, 9, 8); r.plank(14, 6, 6); r.put(28, 17, 'c'); r.put(6, 17, 'g'); r.lamps(5, 28); }),
  room('treasureD', 'D', ['treasure', 'secret'], 0, (r) => { r.plank(4, 15, 8); r.plank(22, 15, 8); r.put(7, 14, 'c'); r.put(26, 14, 'g'); r.lamps(6, 27); }),
  room('fountain', 'L', ['fountain'], 0, (r) => { r.put(22, 17, 'F'); r.plank(10, 15, 4); r.put(11, 14, 'g'); r.lamps(10, 22, 29); }),
  room('fountainD', 'D', ['fountain'], 0, (r) => { r.put(26, 17, 'F'); r.plank(4, 15, 6); r.put(6, 14, 'g'); r.lamps(10, 22, 29); }),
  room('weapon', 'L', ['weapon'], 0, (r) => { r.put(24, 17, 'W'); r.block(12, 16, 2); r.put(12, 15, 'g'); r.lamps(10, 24); }),
  room('weaponU', 'U', ['weapon'], 0, (r) => { r.plank(8, 15, 6); r.plank(20, 15, 6); r.plank(12, 12, 10); r.plank(13, 9, 8); r.plank(14, 6, 6); r.put(5, 17, 'W'); r.lamps(10, 24); }),
  room('secret', 'L', ['secret'], 0, (r) => { r.put(20, 17, 'c'); r.put(26, 17, 'c'); r.put(12, 16, 'g'); r.put(16, 16, 'g'); r.lamps(14, 24); }),
];
// Static grid lint (the dynamic proof is src/reach.js). Returns a list of problems.
export function lintChunk(ch) {
  const out = [], rows = ch.rows, at = (x, y) => (rows[y] && rows[y][x]) || '#';
  const solid = (c) => c === '#' || c === 'B' || c === 'A';
  for (let y = 1; y < 18; y++) for (let x = 1; x < 33; x++) {
    const c = at(x, y);
    if ((c === '=' || c === 'u') && !BANDS.includes(y)) out.push(`${ch.id}: plank off-band at ${x},${y}`);
    if (c === '#' && !solid(at(x, y - 1)) && !BANDS.includes(y) && y !== 16) out.push(`${ch.id}: block top off-band at ${x},${y}`); // step tops on a band (or a 2-row step)
    if (c === 'o' && !SWING_ROWS.includes(y)) out.push(`${ch.id}: swing anchor off-band at ${x},${y}`);
    if (c === 'z' && !ZIP_ROWS.includes(y)) out.push(`${ch.id}: zip anchor off-band at ${x},${y}`);
  }
  // chains: all anchors on one row of a chunk must be evenly spaced
  const byRow = new Map();
  for (let y = 0; y < 20; y++) for (let x = 0; x < 34; x++) if ('oz'.includes(at(x, y))) { if (!byRow.has(y)) byRow.set(y, []); byRow.get(y).push(x); }
  for (const [y, xs] of byRow) if (xs.length >= 3) { const d = xs[1] - xs[0]; for (let i = 2; i < xs.length; i++) if (xs[i] - xs[i - 1] !== d) out.push(`${ch.id}: uneven hook chain on row ${y}`); }
  // blind landings: nothing dangerous right inside a side door or under a top hole
  const danger = (c) => 'KYCVA~^v-u'.includes(c);
  for (const e of ch.exits) {
    if ((e === 'R' && ch.tags.includes('wideA')) || (e === 'L' && ch.tags.includes('wideB'))) continue; // interior joint of a 2-room hall
    if (e === 'L' || e === 'R') for (let x = 1; x <= 4; x++) for (let y = 14; y <= 18; y++) { const xx = e === 'L' ? x : 33 - x; if (danger(at(xx, y))) out.push(`${ch.id}: trap/pit at ${e} door ${xx},${y}`); }
    if (e === 'U') for (let x = 12; x <= 21; x++) for (let y = 14; y <= 18; y++) if (danger(at(x, y))) out.push(`${ch.id}: trap/pit under the top hole ${x},${y}`);
  }
  if (rows.length !== 20 || rows.some((r) => r.length !== 34)) out.push(`${ch.id}: bad size`);
  return out;
}
