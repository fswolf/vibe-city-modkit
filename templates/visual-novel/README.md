# Visual novel template

A complete little visual novel, *Corner Cafe*: two characters, three scenes, choices, flags and three endings. Copy it, then rewrite it into your own.

| File | What it is |
|---|---|
| `story.js` | **What happens.** Every scene, line, choice and ending. This is the file you write in. |
| `actors.js` | **Who and where.** Title, settings, flags, stages (backdrops) and the cast with their sprite strips. |
| `actors/` | The placeholder sprite strips: `kit_<move>.png`, `mew_<move>.png`. |
| `vn.js` | The engine: text box, choices, saves, Auto, Log, Scenes menu. You do not need to change it. |
| `af.js` | The animation player the engine sits on. You do not need to change it. |
| `game.html` | The window. |
| `mod.json`, `R0.png` to `R3.png`, `icon.png` | The building that opens the novel in the city. |
| `pack.sh` | Packs the folder into one `.asar` to share. |

## Try it

Copy this folder into `Documents/Vibe City/mods/`, start the game, build **Novel** from the Decor menu, and click it with the pan tool.

## Write your own

- **In VC Novel Studio** (in `studio/` at the top of this repo): open this folder, edit scenes as cards, play any line in the preview, save. The easiest way.
- **By hand:** `story.js` is plain JavaScript with comments at the top showing every kind of line.

Full guide: [docs/visual-novels.md](../../docs/visual-novels.md).

## Your own characters

Draw or generate a strip for each move: 8 frames in a row, 512 x 512 each (4096 x 512), facing right, feet on the same line in every frame. Name them `actors/<name>_<move>.png` and change the cast in `actors.js`. The move list there says which strips each actor needs. See [docs/animation.md](../../docs/animation.md).

Change `id` in `mod.json` before you share it, to something only yours.
