# Building template

The smallest complete mod: one building with four pictures and an optional window.

| File | What it is |
|---|---|
| `mod.json` | What the building is, costs and does. Every field is in [docs/MODDING.md](../../docs/MODDING.md). |
| `R0.png` to `R3.png` | The building from the four camera angles, on its own plot. |
| `icon.png` | The menu button picture. |
| `game.html` | The window that opens when the player clicks the building. Delete it (and `window` in mod.json) for a building with no window. |
| `pack.sh` | Packs the folder into one `.asar` to share. |

## Try it

Copy this folder into `Documents/Vibe City/mods/`, start the game, and find **Kiosk** in the Decor menu.

## Make it yours

1. Change `id` first, to something only yours (`yourname-bakery`). Saves remember buildings by it, so do not change it after people have built yours.
2. Swap the four pictures. See [docs/sprites.md](../../docs/sprites.md) for how to draw or generate them so they sit on the tile.
3. Edit `game.html`, or remove the window.
