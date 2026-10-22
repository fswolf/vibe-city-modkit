# Static scenes template

Four scenes, each with its own backdrop, an opening conversation and four play buttons, built from **still pictures** instead of animated strips. The easiest way to start: one PNG per pose, no sprite strips to draw.

| File | What it is |
|---|---|
| `scenes.js` | **What happens.** The four scenes: backdrop, who stands where, the opening lines, the buttons and their steps. |
| `cast.js` | **Who.** Each actor's name, tag colour, height and poses (one PNG each). |
| `sprites/` | Placeholder poses: `kit_` and `mew_` idle, happy, sad, surprised (600 x 900). |
| `bg/` | Placeholder backdrops: flat, park, cafe, beach (1920 x 1080). |
| `stage.js` | The player. You do not need to change it. |
| `game.html` | The window. |
| `mod.json`, `R0.png` to `R3.png`, `icon.png`, `pack.sh` | The building and packing, as in every template. |

## Swapping in your art

- **Same names:** save your PNG over the placeholder (`sprites/kit_happy.png`) and you are done.
- **More poses or actors:** add them to `cast.js`, then use `pose: "sleepy"` in `scenes.js`.
- **Sprites:** transparent PNG, standing, feet at the bottom middle, facing right. Keep all poses of one actor the same size.
- **Backdrops:** any size, stretched to cover the window (16:10 at 960 x 600).

## Controls

Click or Space reads on. 1 to 4 play the buttons. The arrows (or Back and Next) change scene, the dots jump to any scene, the round arrow replays the opening, Esc closes. The game remembers the last scene.

Full guide: [docs/static-scenes.md](../../docs/static-scenes.md).
