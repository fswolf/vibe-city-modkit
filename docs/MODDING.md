# Making a Vibe City mod

Mods live in a folder called `mods` inside `Documents/Vibe City` (on Linux, `~/Documents/Vibe City/mods`). The game reads it each time it starts. Each mod is one folder in there:

```
mods/
  neon-brew/
    mod.json        what the building is and does
    R0.png ... R3.png   the building from the four camera angles
    icon.png        the picture on its menu button (optional)
    game.html       a window that opens when you click it (optional)
```

## mod.json

```json
{
  "id": "neon-brew",
  "name": "Neon Brew",
  "label": "Cafe",
  "author": "Ryan",
  "version": "1.0",
  "desc": "A late night coffee shop.",
  "group": "decor",
  "price": 3500,
  "upkeep": 25,
  "power": 6,
  "water": 6,
  "jobs": 8,
  "reach": 5,
  "sprites": ["R0.png", "R1.png", "R2.png", "R3.png"],
  "icon": "icon.png",
  "window": { "page": "game.html", "title": "Neon Brew", "width": 900, "height": 560 },
  "money": { "per_month": 1500 }
}
```

| field | what it does |
|---|---|
| `id` | Lower case letters, digits, `-` and `_`. Saves remember mods by this, so do not change it once people have built your building. |
| `name` | Shown on the tooltip and in the inspector (28 characters). |
| `label` | The short word under the menu button (12 characters). |
| `author`, `version`, `desc` | Shown on the tooltip. |
| `group` | Which menu drawer it goes in: `transport`, `utilities`, `civic` or `decor`. |
| `price` | What it costs to build, in dollars. |
| `upkeep` | Dollars a month. |
| `power`, `water` | What it draws. Give both or neither. A building that draws them is closed without them, like the casino. |
| `jobs` | Commercial jobs it adds while open. |
| `reach` | Tiles of growth boost around it, like a park or gallery (0 to 12). |
| `sprites` | Four pictures, one per camera angle, or one picture for all four. PNG, WebP or JPEG. |
| `icon` | The menu picture. Leave it out and the first sprite is used. |
| `window` | A page that opens when the player clicks the building with the pan tool. Width 320 to 1200, height 240 to 800. |
| `money.per_month` | The most your page may pay into the city's funds in one game month. 0, or left out, means it cannot pay at all. |

Anything out of range is pulled back into range. A mod that cannot be used (no usable sprites, an id another mod already has) is skipped. Whatever went wrong is written to the console (Ctrl+Shift+I when running from the project folder) and the first problem shows in a toast when the game starts, so check there if your building does not appear. A picture that will not load borrows one of the other angles, and with none at all the building is drawn as a plain purple box so it can still be found and bulldozed.

Two ids that differ only by `-` and `_` (`my-mod`, `my_mod`) count as the same.

## The pictures

Draw each building on its own square ground slab, in the same isometric view as the game's buildings, on a transparent background. The game finds the slab's two lower edges and fits them to the tile by itself, so you do not have to measure anything. Keep everything inside the slab: anything hanging over the edge is trimmed where the tile ends.

The four angles go R0, R1, R2, R3 as the camera turns. What faces you on the left at one angle faces you on the right at the next.

To have your building face the street, say which picture shows its front where: `"facing": [0, 3, 2, 1]` lists the sprite (0 for R0 up to 3 for R3) whose front door is at the down-left, up-left, up-right and down-right of the screen, in that order. The game then picks the picture that turns the front to the nearest road, whichever way the camera points. If your four pictures go front down-left, up-left, up-right, down-right in order, `"facing": "standard"` does the same. Leave it out and the pictures turn with the camera.

If the automatic fit is ever wrong, you can give it yourself: `"fit": { "span": [1.01, 1.01, 1.01, 1.01], "nudge": [0.39, 0.39, 0.39, 0.39] }`. `span` is how much wider the picture is than the tile, and `nudge` is how far up from the bottom of the picture (as a fraction of its height) the tile's centre sits.

## The window

Your page runs in a sealed frame. It cannot see the game or the player's files. It talks to the game only with messages:

```js
parent.postMessage({ vc: "ready" }, "*");        // send me the city
window.addEventListener("message", e => {
  const d = e.data;
  if (d.vc === "init") {
    // d.api    1, the version of these messages; it goes up only if something here changes
    // d.data   what you saved last time, or null
    // d.city   { open, name, year, month, pop, jobs, funds, demand: {r, c, i}, taxRate, built }
    //          open is false while a building that needs power and water has not got them
    // d.money  { perMonth, left }   what you may still pay this month
    // d.settings { volume }  the player's effects volume, 0 to 1: scale your sounds by it
  }
  if (d.vc === "paid") { /* d.amount was paid, d.left is what is left this month, d.open false if it was closed */ }
  if (d.vc === "city") { /* d.city, fresh */ }
});
```

| send | what happens |
|---|---|
| `{ vc: "ready" }` | The game answers with `init`. |
| `{ vc: "save", data }` | Keeps `data` with the city, in its save file. Any JSON, up to 32 KB. You get it back in the next `init`. |
| `{ vc: "pay", amount }` | Puts whole dollars into the city's funds, up to what is left of `money.per_month` this game month. A closed building (no power or water) pays nothing. The game answers `paid`. |
| `{ vc: "toast", text }` | A line at the bottom of the game's screen (120 characters, one a second at most). |
| `{ vc: "city" }` | The game answers with a fresh `city`. |
| `{ vc: "close" }` | Closes your window. |

Your page gets the keyboard when the window opens, and keeps it until the player clicks back into the city. Pause your game on the page's `blur` event, so nothing is lost while they are away. Escape closes windows everywhere else in the game, but the city never hears it while your page has the keyboard, so send `close` on Escape yourself (Neon Brew pauses on the first press and closes on the second). If the building is bulldozed or the player loads another city, the window closes without warning, so send `save` whenever there is something worth keeping rather than only at the end.

Keep everything your page needs inside its own folder: scripts, styles, pictures and sounds load from there by plain file name. Your page cannot reach the internet, so nothing can come from a CDN or a web font service: copy what you need into the folder. Inline `<script>` and `<style>` are fine, and so is WebAssembly. Files are 64 MB at most, and a link (symlink) that points out of your folder is refused.

## Saves

A save remembers which buildings were from which mod. Open a city without a mod it used and those buildings turn into grass for the time being, and the game says which mods were missing. The city remembers where they stood, and what your page saved: install the mod again and they come back, unless something was built on the lot in the meantime.
