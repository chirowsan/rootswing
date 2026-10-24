// CLI: node tools/reach15.mjs chunks | node tools/reach15.mjs runs N [biome]
import { validateAllChunks, validateRun } from '../src/validate.js';
import { generateRun } from '../src/level.js';
const [mode, n = 10, biome] = process.argv.slice(2);
if (mode === 'chunks') { const t = Date.now(); const p = validateAllChunks(); p.forEach((x) => console.log(x)); console.log(p.length, 'chunk problems', Date.now() - t, 'ms'); }
else { let bad = 0; for (let s = 1; s <= +n; s++) for (const b of biome ? [biome] : ['overpass', 'caverns']) { const R = generateRun(s * 7919 + 13, b), v = validateRun(R); if (!v.ok) { bad++; console.log(s, b, v.problems.join(' | ')); } else console.log(s, b, 'ok', v.stands, 'stands', v.ms + 'ms', v.missedExtras.length ? 'missed extras ' + v.missedExtras.join(',') : ''); } console.log('bad runs', bad); }
