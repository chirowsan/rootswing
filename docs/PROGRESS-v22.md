# Rootswing v2.2.0 progress log (versionCode 14) — "harder + surprises"

Resume notes: build `node build.mjs`; tests `node tests/v22.mjs` (~15 s), `node tests/v21.mjs`, `node tests/run-all.mjs` (bg, ~5 min).
Bot: `node tools/diff-bot.mjs <diff> 1,2,3,4,5` (bg, logs /tmp/v22b-<diff>.log; v2.1 baselines /tmp/base-<diff>.log).

## Log
- [done before log] v2.2 code: src/ai22.js (smart AI: guard vs mashing, dodge-punish, feints), src/foes22.js (hunter, mimic, hollow), src/surprise.js + src/surprisePlan.js (seeded events, boons, shrine pacts, merchant, pockets/mini-games, set-pieces, continues, rank, mastery), boss phases + fake death + phase-4 arena, secret chapter 6, Assist toggle, painted sprites art/v22 -> assets/gfx/s_*.webp.
- 2026-10-24 21:00 fixed: tile-hazard damage capped (v2.1 level on Normal); mashGuard in stun branch; Daily excluded from surprises.
- 21:10 fixed: trap state cleared on done; Assist auto-on adds +2 tries; continueRun clears stale spRun; auto-Assist resets on load.
- 21:15 fixed real bug: `sort(() => rng()-0.5)` gave engine-dependent layouts for the same seed (traps/foes/events differed ~1 in 8 loads). Replaced with seeded Fisher-Yates in gauntlet.js + surprisePlan.js. tests/v22.mjs 27/28 (only missing docs/bot-v22.json).
- 21:18 launched bots all 4 difficulties ch1-5 in parallel (do not build until done).
