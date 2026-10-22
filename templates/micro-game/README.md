# Micro game template

**Bean Catcher**: a small arcade game inside a city building. Catch falling coffee beans in your cup for 45 seconds. Gold beans are worth 5, burnt ones cost 3. At the end of a round the tips go into the city's funds, and your best score is saved with the city.

It is the smallest version of how Vibe City's own mini games work, and it uses everything a mod page can do: saving, paying the city, toasts, the player's volume, pausing when they click away, closing on Escape, and staying shut when the building has no power or water.

| File | What it is |
|---|---|
| `game.js` | **The game.** Rules at the top, then update (what moves) and draw (what you see), and one loop. |
| `city.js` | **Talking to the city.** `CITY.ready`, `save`, `pay`, `toast`, `close`. Copy it into your own game as it is. |
| `game.html` | The window: a canvas and the two scripts. |
| `mod.json` | The building. `money.per_month` caps what the game may pay the city each game month. |
| `R0.png` to `R3.png`, `icon.png`, `pack.sh` | The building's pictures and packing, as in every template. |

No pictures or sound files: the beans and cup are drawn with the canvas and the sounds are little Web Audio beeps, so the whole game is two short scripts.

## Try it

- **In the game:** copy the folder into `Documents/Vibe City/mods/`, build **Beans** from the Decor menu, click it with the pan tool.
- **While you build it:** open `game.html` straight in your browser. `city.js` notices nobody is answering and pretends to be a small test city, so you can play and edit without restarting the game.

## Make your own

1. Change `id` in `mod.json`.
2. In `game.js`, change the rules at the top, then `update()` and `draw()`. Keep the loop, the screens and the CITY calls.
3. Pay the city something sensible: tie it to how well the player did, and keep `money.per_month` modest.

Guide: [docs/micro-games.md](../../docs/micro-games.md).
