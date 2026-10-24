import { analyze } from './reach.mjs'; import { CW, CH } from '../src/level.js';
const r = analyze(+process.argv[2] * 7919); console.log(r.fails);
const M = r.R.map; for (const c of r.R.cells) console.log(c.x, c.y, c.kind, c.variant.ch.id, [...c.need].join(''));
const [x0, x1, y0, y1] = process.argv.slice(3).map(Number);
for (let y = y0; y < y1; y++) { let s = ''; for (let x = x0; x < x1; x++) s += r.seen[y * M.w + x] ? '*' : M.get(x, y); console.log(String(y).padStart(3), s); }
