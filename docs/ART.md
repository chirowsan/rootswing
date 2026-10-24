# Rootswing art direction (v1.1)

## 1. Honest critique of v1.0 (see `shots/before/`)
What reads as cheap in v1.0:
- **Flat vector everything.** Every layer is one flat fill. There is no texture, no painted light, and no material read (stone, metal and moss all look like plastic).
- **Generic parallax.** The rectangles-and-blob skyline repeats every 1400 px. Trees are circles on sticks, and the three layers share almost the same value, so the world has no depth.
- **Tiny, low-contrast hero.** The 18x34 hero is a thin green shape on top of green moss and lost against the mid layer, so the eye has to hunt for it.
- **Enemies are icons, not creatures.** They are simple primitives with dot eyes and no anatomy. The Warden and Furnace boss look like rounded boxes.
- **Monotone boss arena.** It is one pink-purple wash, with no sense of a foundry and no heat.
- **Tiles.** They are flat purple blocks with a green strip on top, with no edge variety, no roots and no wear.
- **UI.** The HUD is a small flat bar and the victory screen is a plain card, so the rewards don't feel rewarding.
- **Lighting.** Lighting is a few radial gradients. There is no rim light, fog or ambient life (pollen, embers), and no colour grading.

## 2. Palette per area
| Area | Key light | Shadow | Accent | Notes |
|---|---|---|---|---|
| Rustvine Overpass (runs) | warm sunset amber `#ffcf8a` to `#f0a96e` | teal-navy `#1d3346`, `#27345a` | bioluminescent teal `#5ff0d8`, moss `#7fd05a` | ruined city reclaimed by plants; haze gets warmer toward the horizon |
| Seedhouse (hub) | golden greenhouse shafts `#ffe2a8` | deep green-teal `#1f3a3c` | lantern gold, fountain cyan `#7ff0ff` | safe, cozy, saturated greens |
| Smog Furnace (boss) | furnace orange `#ff8a3a` | soot violet `#1e1a34` | ember yellow `#ffb13b`, telegraph red | heat haze, embers rising, crimson shafts |
| Danger (all areas) | hazard red/magenta `#ff3d6e` with pale-pink edge `#ffd0dc` | `#5a0f38` | | **red is reserved for danger** |

## 3. Shape and line language
- Painted forms with a thin dark ink edge (`#15131f`) only on gameplay objects (hero, enemies, props, anchors, tiles). Backgrounds have **no** ink line, so they sit back.
- Hero and friends use round, soft, leaf-like shapes. Enemies use rusty, riveted, angular shapes with glowing eyes. Hazards use sharp thorns and spikes.
- The background gets softer, lighter and more saturated toward the sky (aerial perspective). The near foliage gets darker and cooler.

## 4. Lighting
- **Key light:** low warm sun from the right and behind, with a warm rim on the right edges.
- **Fill:** cool teal from the shadows.
- **Rim light** on the hero (warm, additive) plus a soft dark backing halo, so the silhouette always separates.
- **Additive lights:** lanterns, anchors, glimmers, furnace grates, moss specks.
- **Light shafts and fog bands** go between the parallax layers. **Particles:** pollen (overpass), dust motes (hub), embers (boss).
- **Grade:** a slight warm/teal split-tone overlay plus a vignette. Low quality drops shafts, fog, particles, rim, grade and vignette.

## 5. Readability rules (enforced in code)
1. **Hero and enemies pop.** Every background layer is pushed back with a darkening/desaturating haze overlay. Gameplay sprites get an ink outline. The hero gets a rim light and a dark contact halo, and its orange scarf is the strongest warm accent in any scene.
2. **Hazards are always red.** Thorns, smog and boss telegraphs use the hazard red/magenta, pulsing, with a pale-pink edge. No other element uses that hue.
3. **Anchors always glow.** Swing anchors are golden vine rings and zip anchors are teal crystals. Both always have an additive glow, and the glow is brighter and larger in hook range.
4. **Foreground occluders** hang only from the top edge, and only above the play band, so they never cover the hero, enemies or hazards.
5. **Pickups:** glimmers are gold stars and health is a green flask. They are never red.

## 6. Asset list (all generated for this project, original; no brands)
- Parallax: `ov_sky/ov_far/ov_mid/ov_near/fg_vines`, `hub_sky/hub_mid/hub_near`, `boss_sky/boss_mid/boss_near`, `title_key`.
- Textures: `tex_stone`, `tex_metal`, `tex_root` (made seamless by `tools/build-art.py`), and the `moss` strip.
- Sprite atlas (`assets/gfx/atlas.webp` + `atlas.json`):
  - Hero cutout rig: `head`, `torso`, `arm`, `leg`, `leg2`.
  - Weapons: `w_blade`, `w_hammer`, `w_bow`, `w_whip`.
  - Enemies: `hopper`, `charger`, `moth`, `puffcap`, `knight`, `bomber`, `dummy`, `tturret`.
  - Bosses: `warden`, `boss`, `fist`, `pipe`.
  - Props: `lantern`, `crate`, `sign`, `chest`, `fountain`, `pedestal`, `door`, `station`, `ring`, `crystal`.
  - HUD: `leaf`, `leafdry`, `glim`, `flask`, `dew`, `bomb`.
- Raw sources: `art/src/*.jpg`. Keyed intermediates: `art/out/` (ignored).
- Rebuild with `python3 tools/build-art.py`.
