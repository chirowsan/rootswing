// Bundles src/ into dist/ (single page + game.js + icons + manifest). Icons are drawn in code.
import { build } from 'esbuild';
import fs from 'fs';
import { execFileSync } from 'child_process';
fs.mkdirSync('dist', { recursive: true });
await build({ entryPoints: ['src/main.js'], bundle: true, minify: !process.env.DEV, format: 'iife', target: ['es2020'], outfile: 'dist/game.js', legalComments: 'none' });
for (const f of ['index.html', 'style.css']) fs.copyFileSync(f, 'dist/' + f);
fs.writeFileSync('dist/manifest.webmanifest', JSON.stringify({ name: 'ROOTSWING', short_name: 'Rootswing', start_url: '.', display: 'fullscreen', orientation: 'landscape', background_color: '#1b1730', theme_color: '#1b1730', icons: [192, 512].map((s) => ({ src: `icon-${s}.png`, sizes: `${s}x${s}`, type: 'image/png' })) }, null, 1));
if (!fs.existsSync('assets/icon-512.png')) { try { execFileSync('node', ['tools/make-icons.mjs'], { stdio: 'inherit' }); } catch (e) { console.warn('icon generation skipped:', e.message); } }
for (const s of [192, 512]) if (fs.existsSync(`assets/icon-${s}.png`)) fs.copyFileSync(`assets/icon-${s}.png`, `dist/icon-${s}.png`);
fs.rmSync('dist/gfx', { recursive: true, force: true }); fs.mkdirSync('dist/gfx', { recursive: true });
for (const f of fs.readdirSync('assets/gfx')) fs.copyFileSync('assets/gfx/' + f, 'dist/gfx/' + f);
fs.writeFileSync('dist/.nojekyll', '');
console.log('built dist/', (fs.statSync('dist/game.js').size / 1024).toFixed(1) + ' KB');
