# Animation framework template

Two characters acting out short scenes from sprite strips: walking up to each other, high fives, sitting on a bench, a race. The visual novel template runs on the same engine.

| File | What it is |
|---|---|
| `scene.js` | **What they do.** Quick buttons (Q, W, E) and the scenes menu (1 to 0). |
| `actors.js` | **Who and where.** The stages, the cast, the list of moves. |
| `actors/` | The placeholder strips: `kit_<move>.png`, `mew_<move>.png`, 18 moves each. |
| `af.js` | The engine. You do not need to change it. |
| `game.html` | The window, with a Scenes tab and a Moves tab to try every move. |
| `mod.json`, `R0.png` to `R3.png`, `icon.png`, `pack.sh` | The building and packing, as in every template. |

Try it: copy the folder into `Documents/Vibe City/mods/`, build **Animate** from the Decor menu, click it.

Guide to steps, moves, hooks and making strips: [docs/animation.md](../../docs/animation.md).
