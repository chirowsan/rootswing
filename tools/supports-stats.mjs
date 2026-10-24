// v1.6: support-chain stats + audit over many generated runs and the fixed maps (node, no browser)
import { generateRun, buildFixed } from '../src/level.js';
import { HUB, TUTORIAL } from '../src/chunks.js';
import { computeSupports, auditSupports } from '../src/supports.js';
import * as C from '../src/chunks.js';
const T = 24, anc = (sp) => sp.filter((s) => s.c === 'o' || s.c === 'z').map((s) => ({ x: s.x * T + 12, y: s.y * T + 12, kind: s.c === 'o' ? 'swing' : 'zip' }));
const N = +(process.argv[2] || 24), tally = {}; let bad = 0, total = 0;
const maps = [];
for (let i = 0; i < N; i++) for (const b of ['overpass', 'caverns']) maps.push([`${b}#${i}`, generateRun(1000 + i * 37 + (b === 'caverns' ? 7919 : 0), b)]);
maps.push(['hub', buildFixed(HUB)], ['tutorial', buildFixed(TUTORIAL)]); if (C.BOSS_ROOM) maps.push(['boss', buildFixed(C.BOSS_ROOM)]);
for (const [name, L] of maps) {
  const s = computeSupports(L.map, anc(L.spawns), L.traps || []), b = auditSupports(L.map, s); total += s.pieces.length; bad += b.length;
  for (const p of s.pieces) { const k = p.kind + ':' + p.sup.type; tally[k] = (tally[k] || 0) + 1; }
  if (b.length) console.log(name, 'UNSUPPORTED', b.slice(0, 4).map((p) => `${p.kind}/${p.sub || ''}@${p.x0},${p.y} ${JSON.stringify(p.sup.ends)}`));
}
console.log('maps', maps.length, 'pieces', total, 'unsupported', bad); console.log(tally);
