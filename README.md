# Flashback for modern Web Browsers
This project is a TypeScript rewrite of [REminiscence](http://cyxdown.free.fr/reminiscence/) which is a reimplementation of the engine of [Flashback](https://en.wikipedia.org/wiki/Flashback_(1992_video_game)), a game released in 1992 for the Commodore-Amiga & DOS.

I converted by hand most of the C++ code to TypeScript.

SDL functions have been mapped to their Canvas/WebAudio equivalent functions.

## Requirements

 - a modern browser (Chrome/FF/Safari 15+)
 - a keyboard (no touch support yet)
 
## What's implemented:

- DOS demo version only is supported
- Cutscenes (most opcodes implemented, a few gfx glitches)
- Gameplay (rolling demo, as well as user-controlled demo work)
- Sound (including "sfx" in-game music)
- Keyboard-based controls

## What's missing:

- Some opcodes (very few for cutscenes, about 25 for the game)
- Savegame support
- Joystick support
- Scalers (flashback-web uses CSS-based blurry scaling)
- Module/OGG sound
- Loading your own data (only the freely distributable demo was tested)
