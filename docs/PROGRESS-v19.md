# Rootswing v1.9.0 — combat overhaul (versionCode 11)

Owner ask: "fix the fighting and make it more cool than just slash up and down".
Movement, the hook, maps, missions and the art style are unchanged. There is still one attack button, and no new on-screen buttons were added.

## Moves (how to do each)
| Move | Input | What it does |
|---|---|---|
| Ground combo | tap Attack 4–5× | 5 different hits: cut → reverse cut → spin → lunge → **finisher slam**. The slam sends a vine shockwave along the ground, makes leaves burst, launches the enemy spinning and shows "FINISH!". Every hit has its own hitbox, wind-up, lunge and follow-through. |
| Launcher | hold Up + tap | A rising uppercut that pops small foes into the air. The hero hops after them, so you can keep tapping to juggle them in the air. |
| Air combo | jump, tap | A 3-hit spinning air chain that keeps your momentum. Each hit gives a small hover so the combo can keep going. |
| Plunge slam | in the air, hold Down + tap | A diving strike with falling-star streaks. On landing it sends out a shockwave ring and you bounce back up. |
| Charged whirl | hold Attack (~1 s), release | A charge ring builds up, then a spinning blade whirl pulls enemies in. |
| Dash-slash | Dash, then tap | A fast slash at the end of the dash with speed lines. |
| Perfect dodge | dash through an attack just as it lands | Slow motion kicks in and your next hit is a guaranteed crit. |
| Parry counter | Parry just as an enemy hits, then tap | A flash-step counter slash ("COUNTER!") that always crits. |
| Bloom special | fill the petal gauge around the weapon badge, then hold Attack ~1.5 s | The screen darkens, thorns and flowers burst out of the ground on both sides, and everything nearby takes 3 hits. |
| Hook moves | hook an enemy / tap while hooked | Zip-slash into an enemy, yank small enemies toward you, or kick with your feet while swinging. |

Enemy reactions: white flash, stagger, launch, a spinning tumble and a death burst, plus crit and finisher pop-ups. The boss now has a **poise bar**. Fill it with steady hits to cause a BREAK! and stun the boss.
Hint: an icon-only moves card (no words) appears near the hub dummy.
Sound: separate sounds for normal hits, heavy hits, crits, finishers, parries, poise breaks and the Bloom.

## Art
`tools/hero-combat-poses.py` and `tools/hero-rig.py` add 25 new `c_*` hero frames covering wind-up, strike/smear and follow-through. Capes and hats work on these frames; I checked the berry cape with the crown in captures.

## Tests
`node tests/run-all.mjs` → **88/88** (78 earlier tests + 10 new v1.9 combat tests). The new tests cover: the combo chain, the launcher juggle, plunge/dash/whirl, the counter and Bloom, no soft-lock, perfect dodge, every enemy type being killable, boss poise break, particle/trail/decal caps, and no page errors. The reach validator is untouched.

## Review (self, as art director)
- Iteration 1 scored ~6.5. Problems: a white blob hid the hero, the plunge effect was a flat wedge, the Bloom washed out the screen with floating thorns, and the launcher missed ground foes.
- Iteration 2 scored ~8.5. Changes: thorns now grow from the ground, the background dims behind the hero, the plunge uses star streaks, impact pops play in real time through hit-stop, the hero no longer blinks during attacks, and the enemy flash is shorter during slow motion.
- Still weak: the counter's impact flash stays a little long, and damage numbers can stack up during fast combos.

Screens: `shots/v19/best*.png`, contact sheets `shots/v19/sheet_*.png`.
