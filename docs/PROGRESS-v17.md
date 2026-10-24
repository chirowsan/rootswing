# Rootswing v1.7.0 — premium art pass (versionCode 9)

Goal: owner said "U can do better than this" about v1.6. Target look: painted forest in the spirit of Ori / Hollow Knight / Dead Cells.
Unchanged: gameplay, layouts, reach validator, objective, trap timings, controls, hero/enemy art + animation, "nothing floats" rule + tests.

## What changed
- **Painted kit** (tools/build-art.py → atlas): 3 variants each of mossy branches (br0-2), bracket fungus shelves (fb), mushroom caps (mc),
  mossy boulders (bo0-2), hollow logs (glog), irregular mossy ground lip (lip2) with fern / root / grass edge dressing (dc_*).
- **Supports grow, not stand** (src/supportsDraw.js): platforms are branches of ONE thick, leaning, tapered trunk that grows past the
  platform into a leafy crown; a curved side branch cradles the far end; small hanging root tendrils; root arches for low wide spans;
  pale-stalk mushroom shelves for short ones; bracket fungi / wall branches on walls; twisted leafy vines from the canopy for bridges.
  Bark texture + biome tint + cylinder shading (trunks) / top-lit underside-dark shading (limbs) + rim light. No more "picnic table on stilts".
- **Depth & light** (src/paint.js): painted sky, haze-shaded far trunk layer (top faded into haze), dark near trunk layer,
  feathered animated god rays, dark swaying foreground canopy + fern framing, per-area grading
  (glade gold / moss teal / dusk purple-orange with fireflies / caverns blue with bioluminescence), vignette, motes (pollen + leaves,
  spores, fireflies, bio-glow). Background is always darker / less busy than the play layer.
- **Ground**: irregular lip with lit rim, ink under-shadow, jagged root-tendril undersides, buried rocks, dense props; whole-run consistency.
- **Readability**: lit top edges on every walkable surface; light rim silhouette around the hero.
- **Traps**: saw runs in a carved groove along a hollow log (no debug rail); crusher body is a log; crumble branch is cracked + fungus.
- **Cleanup**: stone/metal/rock textures and the old v1.5 parallax layers deleted; fallback renderer (src/art.js) also draws supports.

## Self-review (harsh)
| iteration | shots | score | main problems found |
|---|---|---|---|
| i1 | shots/v17/i1-* | 6.5 | far-trunk layer cut off flat (light rectangle); "tree" limb read as a straight beam on two stilts; arches like A-frames on tall spans; giant boulder bug in caverns |
| i4 | shots/v17/i4-* | 7.8 | single-trunk branches work; brace limbs flat / plank-like; hanging roots looked like green tentacles; pale moss blobs on trunks |
| i7 (ship) | shots/v17/i7-* | 8.6 | remaining nits: near-trunk branch stubs make odd silhouettes in places; camera not moved closer |

Per-shot (i7): glade start 8.6, saws 8.7, hub 8.4, caverns 8.7, dusk boss 8.5.

Before/after (best 4): shots/v17/compare-00-start.png, compare-16-saws.png, compare-hub-hub.png, compare-00-start-b2.png.

## Notes
- Closer camera considered and NOT applied: viewH is tied to reach/readability of the generated layouts; changing it risks gameplay.
- Tests: 69/69 (incl. "nothing floats" data + drawn, 0 undrawn supports).
