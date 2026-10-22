# The animation framework

`af.js` plays characters from **sprite strips**: walking about, playing moves, touching moves like hugs and high fives, speech windows, stage changes. The visual novel engine runs on it, and [`templates/animation`](../templates/animation) shows it on its own.

## Sprite strips

- One PNG per move: `actors/<who>_<move>.png`.
- **8 frames in a row, 512 x 512 each (4096 x 512)**, transparent background.
- Drawn **facing right**. The framework mirrors them when a character faces left.
- **Feet on the same line in every frame** (about 40 px above the bottom), body centred in the frame. A strip that drifts makes the character slide about.
- Every frame is drawn at the same scale.

The move table in `actors.js` says how each strip plays:

```js
const MOVES = {
  idle:  [4,   "loop"],      // fps, plays
  walk:  [8.3, "loop"],      // a loop used while moving becomes the gait
  jump:  [9.1, "once", 4],   // a once move, with a hold frame (zero based)
  turn:  [10,  "once"],
};
```

`moves("kit")` builds an actor's animations from that table, plus two made from the turn strip: `front` (its last frame, a still) and `turnback` (the strip played backwards).

## Steps

A scene is a list of steps, played top to bottom. Everything in one step happens at once, and the next step waits for it.

| Step | What it does |
|---|---|
| `{ move: { a: .7 }, secs: 1.4 }` | Walk actor `a` to 70% across in 1.4 s |
| `{ move: { a: .7 }, secs: .8, a: "run" }` | Run there instead (any looping move works as a gait) |
| `{ move: { a: { to: "b", gap: HUG } } }` | Walk up beside actor `b`, feet `HUG` sprite px apart |
| `{ a: "hug", b: "hug", hold: 1 }` | Play moves, freeze 1 s on the hold frame |
| `{ a: "dance", loops: 3 }` | Play a loop 3 times |
| `{ say: ["a", "Hi!"] }` | Speech window over `a` |
| `{ flip: { a: true } }` | Face left (`false` = right) |
| `{ a: "sitdown", idle: { a: "sit" } }` | Sit, and stay sitting between moves |
| `{ a: "turn", idle: { a: "front" } }` | Face you, until `turnback` |
| `{ show: { b: .7 } }`, `{ hide: "b" }` | Bring someone on, or take them off |
| `{ wait: .5 }` | Pause after the step |
| `{ stage: "park", place: { a: .2, b: .8 } }` | Fade to another stage, actors placed in the dark |

## Touching moves

Two characters hugging or high fiving have to stand a set distance apart, measured between their feet in sprite pixels. Tune it once by eye for your art, put it in a constant (`HUG = 150`), and use `{ to: "b", gap: HUG }` everywhere.

## Hooks

```js
AF.on("back", (g, W, H) => { /* draw behind the actors: a bench, a counter */ });
AF.on("draw", (g, W, H) => { /* draw in front: rain, a vignette */ });
AF.on("stage", name => { /* the stage changed */ });
```

`AF.state` has everything live: `actors`, `stage`, `paused`, `busy`, `vol`.

## Making strips with an image generator

Ask for one move per image, and say all of this:

- "A horizontal strip of 8 frames, each 512 x 512, total 4096 x 512."
- "The same character, outfit and size in every frame. Only the pose changes."
- "Facing right. Feet on the same line in every frame, about 40 px from the bottom. Centred in each frame."
- "Transparent background, a real alpha channel, not a drawn checkerboard."
- "No shadow, no floor, no text."

Attach a finished strip of the same character as a reference for every new move. Check that the frames line up before you use it; `af.js` cannot fix a strip whose feet jump around.
