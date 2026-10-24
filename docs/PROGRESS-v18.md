# Rootswing v1.8.0 (versionCode 10): Side Missions

A mission system for kids aged 5–10. It uses almost no text and works through icons. Nothing is paid; every reward is earned in play.

## Mission Board (hub)
- A painted wooden board with a lantern and a shingle roof stands between the shop stations and the door. It shows its 3 live mission notes as small paper cards, plus a bouncing "!" bubble.
- Walk up to the board and press interact to open the board screen. It has 3 pinned notes (mission icon, progress bar, n/t, gift → reward icon) and a Daily note (sun, today's modifier icon, trophy best, Play).
- A completed mission is replaced right away by a new one of a different type. Each type gets harder after 2 completions (3 tiers).

## Mission types (9)
| Icon | Type | Goal |
|---|---|---|
| bunny | rescue | Find lost critters (2 per run, in side/dead-end rooms) and touch them. They hop happily, follow you, then sparkle home. |
| shield | clean | Clear a room without getting hit. |
| key | secret | Find secret walls. |
| enemy sprite | hunt | Defeat N of one enemy type (hopper / charger / bomber). |
| chain | chain | Chain N vine hooks without touching the ground. |
| clock | quick | Beat the mini-boss within the time limit (150/120/95 s). |
| glimmer | gold | Collect glimmers. |
| no-flask | dry | Finish an area (biome) without drinking a potion. |
| sun | daily | Play the Daily run. |

## Daily run
- One seeded run per local day: `dailySeed(YYYY-MM-DD)` (FNV-1a hash).
- Modifiers change only damage or a colour tint (glass ×1.5 taken, mighty ×1.5 dealt, firefly tint, golden tint …). Gravity, jump and hook physics are never changed, so every reachability proof still holds.
- Score = glimmers + kills×5 + rooms×10 + critters×25 + win 150. The best score for the day is saved locally and shown on the death/victory screens and the board.

## Feedback
- Toasts at the top centre. Progress toasts show the mission icon plus pips or a bar, with a pickup sound. Completion toasts have a gold border, a star, an arrow, the reward icon and orbiting stars, with unlock and victory sounds and a star burst and ring on the hero.
- An HUD tracker on the left (icon, bar, n/t) can be switched on or off with the eye button on the board.

## Rewards (earn-only)
- Capes: leaf, sky, berry, gold★, night★. Each recolours Sprig's own painted scarf/cape on every animation frame, so it stays fully animated. Boots and belt keep their leather.
- Hats: flower, acorn, leaf crown, mushroom, crown. These are vector shapes anchored to the face point of each frame.
- Vine colours: berry, frost, sunset, rainbow (animated).
- Hub companions: bunny, squirrel, beetle, hedgehog. The worn one follows you; the others play by the board.
- Badges: one per mission type, plus 1/5/10/25 missions done and "all friends".
- Wardrobe screen: a live hero preview plus rows of capes, hats, vines and pets, with a lock on anything not yet earned, and a badge grid.

## Save
- `progress.missions` (ver 1) and `progress.saveVer = 18`. On boot, `migrateSave` adds the mission block to v1.7 saves without touching glimmers, stars, vines or unlocks.

## Files
- `src/missions.js` holds the pure logic: types, rewards, events, daily and critter spot picking.
- `src/missionsWorld.js` handles critters, the board drawing, toasts, the HUD, hats and cape recolour.
- Changes elsewhere: wiring in `world.js`, `player.js`, `main.js` and `ui.js`; v1.8 CSS; HUB station `4`.
- Art: `art/src/v8_critters.jpg` and `art/src/v8_board.jpg` (generated) → atlas sprites `board`, `cr_bunny`, `cr_squirrel`, `cr_beetle`, `cr_hog`.

## Tests (added to tests/run-all.mjs)
daily determinism; critter reachability (explore proof, 12 spots / 6 seeds); save migration; progress events; completion + reward unlock + badge + refill + saved; real critter rescue + no-hit-room rule; board/wardrobe UI; daily run seed/modifier/best; no page errors.

## Screenshots
`shots/v18/`: board.png, critter-rescue.png, toast.png, wardrobe.png. The wardrobe and board shots use a save with several rewards pre-unlocked for display.

## Ship log (2026-10-24)
- Tests: 78/78 pass. Also hardened the pre-existing flaky 'biome-2 shellback' test: it now resets Sprig to the flat spot before each enemy. It had failed about 1 in 8 runs on v1.7 as well.
- APK: release/Rootswing-1.8.0.apk (6.9M), sha256 f5299f3eb0dadf68…; AAB: 6.8M. Signing cert SHA-256 6e59e14a…d8de (verified).
- Release: https://github.com/chirowsan/rootswing/releases/tag/v1.8.0
- Live: https://chirowsan.github.io/rootswing/. The live game.js hash matches dist. verify-live passed with 0 errors, and the board opens live with 3 missions.
- Not yet verified: on-device play on a real Android phone; full multi-day daily rollover in real time; the timed mini-boss and no-potion missions were tested only through their event plumbing, not by playing them to completion.
