// Dump a generated run (tiles + spawns + cells + traps) to JSON for offline map renders (tools/maprender.py).
import { generateRun } from '../src/level.js';
const seed = +(process.argv[2] || 2026), biome = process.argv[3] || 'overpass', out = process.argv[4] || '/tmp/map.json';
const R = generateRun(seed, biome);
const fs = await import('fs');
fs.writeFileSync(out, JSON.stringify({ w: R.map.w, h: R.map.h, t: R.map.t.join(''), spawns: R.spawns.map((s) => ({ c: s.c, x: s.x, y: s.y })), traps: (R.traps || []).map((t) => ({ ...t, cell: undefined })),
  cells: R.cells.map((c) => ({ x: c.x, y: c.y, kind: c.kind, branch: !!c.branch, depth: c.depth, id: c.variant.ch.id, flip: c.variant.flip, seed: !!c.seed })) }));
console.log('wrote', out, R.cells.length, 'cells');
