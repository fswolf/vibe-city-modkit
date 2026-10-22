# Static scenes

The simplest kind of character mod: still pictures (one PNG per pose) on backdrops, brought to life with hops, wiggles, walks and little effects. No sprite strips to draw. Start from [`templates/static-scenes`](../templates/static-scenes).

## cast.js

```js
const CAST = {
  kit: {
    name: "Kit", color: "#2fb3a4", h: .62,       // name tag, its colour, height on screen
    poses: { idle: "sprites/kit_idle.png", happy: "sprites/kit_happy.png" },
  },
};
```

Sprites: transparent PNG, standing, feet at the bottom middle, facing right. Keep every pose of one actor the same size so swaps do not jump.

## scenes.js

Each scene has a `name`, a `bg` picture, `place` (where each actor stands, their starting pose, `flip: true` to face left), `intro` (the lines when it opens, click to read on) and up to four `buttons`, each a list of steps.

```js
{ kit: "hop", mew: { pose: "happy", move: "spin" }, say: "Mew: Wheee!", fx: "sparkles" }
```

| Key | What it does |
|---|---|
| `kit: "hop"` | Play a move |
| `kit: { pose: "sad" }` | Swap the picture |
| `kit: { move: "walk", to: .6 }` | Walk (or `slide`) to a spot |
| `kit: { flip: true }` | Face left |
| `say: "Kit: Hi"` | A line in the text box (plays on by itself) |
| `fx: "hearts"` | `hearts`, `sparkles`, `notes`, `sweat`, `tears`, `stars`, `zzz` or `rain`, over the first actor in the step, or `{ kind, at }` |
| `wait: 1` | Seconds before the next step |
| `secs: .8` | How long the moves in the step take |

**Moves:** hop, jump, bounce, shake, tremble, nod, wiggle, lean, dance, float, sink, spin, turn, grow, shrink, walk, slide, fadeout, fadein.

The player remembers the last scene the player was on.
