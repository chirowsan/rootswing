# Rootswing v2.2.0 progress log (versionCode 14) — "harder + surprises"

Resume notes: build `node build.mjs`; tests `node tests/v22.mjs` (~15 s), `node tests/v21.mjs`, `node tests/run-all.mjs` (bg, ~5 min).
Bot: `node tools/diff-bot.mjs <diff> 1,2,3,4,5` (bg, logs /tmp/v22b-<diff>.log; v2.1 baselines /tmp/base-<diff>.log).

## Log
- [done before log] v2.2 code: src/ai22.js (smart AI: guard vs mashing, dodge-punish, feints), src/foes22.js (hunter, mimic, hollow), src/surprise.js + src/surprisePlan.js (seeded events, boons, shrine pacts, merchant, pockets/mini-games, set-pieces, continues, rank, mastery), boss phases + fake death + phase-4 arena, secret chapter 6, Assist toggle, painted sprites art/v22 -> assets/gfx/s_*.webp.
- 2026-10-24 21:00 fixed: tile-hazard damage capped (v2.1 level on Normal); mashGuard in stun branch; Daily excluded from surprises.
- 21:10 fixed: trap state cleared on done; Assist auto-on adds +2 tries; continueRun clears stale spRun; auto-Assist resets on load.
- 21:15 fixed real bug: `sort(() => rng()-0.5)` gave engine-dependent layouts for the same seed (traps/foes/events differed ~1 in 8 loads). Replaced with seeded Fisher-Yates in gauntlet.js + surprisePlan.js. tests/v22.mjs 27/28 (only missing docs/bot-v22.json).
- 21:18 launched bots all 4 difficulties ch1-5 in parallel (do not build until done).
- 21:35 bots done (4 diffs x ch1-5); Hard bossHp 1.7->1.95, bossAggro 1.45->1.55; docs/bot-v22.json written. Normal deaths v2.1 8 -> v2.2 24 (boss 0 -> 4). HUD: moves hint + event banner no longer overlap chapter title. tools/shots-v22.mjs -> shots/v22 (25 shots).
- 21:24 Fixed hud.js comment bug (ReferenceError 'al' from a // comment inside a one-line fn); boon offers now wait for story beats (fixes v21 warden comic test). v21 32/32 (drag test flaky once under load), v22 34/34.
- 21:32 run-all 107/111 -> fixed 3 intentional-change tests (map check masks sealed secret pockets; weapon test closes warden boon card; boss test follows the fake death + revive) — all pass in isolation; combat-kill flake passes in isolation.
