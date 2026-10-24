# Rootswing

A small, original 2D action platformer for Android and the web. You play a little sprout with a vine hook, swinging through a ruined city that is slowly turning green again.

- **Play in the browser:** https://chirowsan.github.io/rootswing/
- **Android APK:** see [Releases](https://github.com/chirowsan/rootswing/releases)

## What's in it
- **Moves:** run, jump (hold for higher), wall-slide and wall-jump, dash (you can't be hit mid-dash), and a vine hook to **swing** or **zip** to rings. Coyote time, jump buffering, ledge help and hook aim-assist make it forgiving.
- **Fighting:** combo attacks, a heavy attack (hold attack), parry, 4 weapons (Rustblade, Vinelash, Gearhammer, Thornbow), 2 skills (Popseed, Thornling), and Dew Flasks for healing. Enemies pop into sparks.
- **World:** a calm hub garden, then *Rustvine Overpass*: 15–25 randomly arranged rooms with hidden secret rooms, a mini-boss (the Warden) and a 3-phase boss (the Furnace).
- **Keep what you earn:** glimmers buy permanent unlocks in the hub. Progress, settings and a mid-run checkpoint are saved on the device.
- **Gentle by default:** game speed 0.8 and Easy difficulty (both adjustable). There's an option to reduce screen shake, plus music and sound toggles.
- **Controls:** touch (stick on the left, buttons on the right), keyboard, or a gamepad.

Free. No accounts, no ads, no network calls. Everything runs locally.

## Keyboard
Arrows/WASD move · Space/Z jump · X attack (hold for heavy) · Shift/C dash · V hook · F parry · Q/1 and R/2 skills · H/3 flask · Esc pause

## Build
```bash
npm install && npm run build      # -> dist/
npm test                          # headless puppeteer suite (needs puppeteer available)
cd mobile && npm install && ./build-android.sh   # needs JDK 17, Android SDK, KEYSTORE + KSPW
```

## Art (v1.1)
v1.1 replaces the flat code-drawn look with painted backgrounds, tiles, props, characters, a cutout-rigged hero, a painted HUD and lighting/particle effects. See [docs/ART.md](docs/ART.md). Game-ready WebP atlases are in `assets/gfx/`; source paintings are in `art/src/` (rebuilt with `python3 tools/build-art.py`). The Graphics **Fast** setting (and automatic low-performance mode) turns off the lighting, outlines and particles, and the old code-drawn fallback still works if the images fail to load. All sound and music are made with WebAudio. MIT licensed.

Before/after screenshots: `shots/before/` vs `shots/after/`.
