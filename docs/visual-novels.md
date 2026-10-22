# Visual novels

A visual novel mod is a building that opens a story window: a text box, characters acting on a stage, choices, flags and endings. Start from [`templates/visual-novel`](../templates/visual-novel).

## The files

| File | You edit it? | What it is |
|---|---|---|
| `story.js` | yes | The scenes (labels) and every line in them |
| `actors.js` | yes | Title, settings, flags, stages, the cast |
| `actors/` | yes | Your sprite strips |
| `vn.js`, `af.js` | no | The engine and the animation player |
| `game.html` | rarely | The window |

`game.html` loads `af.js`, `actors.js`, `story.js`, `vn.js`, in that order.

## story.js

```js
SCRIPT.start = "start";          // the first label

SCRIPT.labels = {
  start: [
    "The street is quiet.",                       // narration
    "Kit: Morning!",                              // a line: a cast name, a colon, the words
    "Mew (on the phone): Two minutes away!",      // an aside on the name tag
    { a: "wave", loops: 2 },                      // any animation step
    { b: "jump", text: "Mew trips over the kerb." }, // words shown while it plays
    { choice: [
      ["Help", "help"],                           // [text, label]
      { text: "Laugh", goto: "laugh", add: { fun: 1 }, if: "trust >= 1" },
    ] },
  ],
  help: [
    { add: { trust: 1 } },                        // change flags
    { if: "trust >= 2", goto: "best", else: "plain" },
    { stage: "park", place: { a: .3, b: .7 } },   // another backdrop, actors placed
    { end: "Good Neighbours" },                   // an ending, with its name
  ],
};
```

- A label that does not jump away **runs on into the next label**, so the order of labels matters.
- `{ if: "fun", goto: "x" }` with no `else` falls through to the next line when false. `{ if: "fun", text: "..." }` (no goto) is shown only when true.
- Conditions: `flag`, `!flag`, `flag >= 2` (also `<=`, `==`, `!=`, `>`, `<`), `told == true`.
- `{ note: "..." }` is for you; the player never sees it.
- The player's progress saves at every line. Continue picks up there.

## actors.js

```js
const SCRIPT = {
  title: "Corner Cafe", subtitle: "A tiny Vibe City story",
  textSpeed: 42, dimOthers: true, pauseOnBlur: false,
  flags: { trust: 0, fun: 0 },
  stages: {
    street: { paint: "day" },                          // a painted city, day or night
    cafe:   { colors: ["#3a2a22", "#7a5642", "#4a3528"] },  // a plain stage: sky top, sky bottom, ground
    shop:   { bg: "bg/shop.png" },                     // your own picture
  },
  stage: "street",
  actors: {
    a: { name: "Kit", color: "#2fb3a4", x: .3, y: 1.02, h: .9, anims: moves("kit") },
    b: { name: "Mew", color: "#f08a2c", x: .7, y: 1.02, h: .9, flip: true, hidden: true, anims: moves("mew") },
  },
};
```

A cast member with no art can still talk: give them a one-frame picture and `hidden: true`, and their name tag shows on the text box.

## Optional settings

Put these in `story.js` (VC Novel Studio's Novel tab writes them for you):

| Setting | What it does |
|---|---|
| `SCRIPT.choices = { at: "bottom", layout: "row" }` | Where the choice buttons sit (`top`, `middle`, `bottom`, `left`, `right` or `{ x, y }`) and how (`column`, `row`, `grid`). A choice line can override both with its own `at` and `layout`. |
| `SCRIPT.gallery = [{ name, label, until, stage, place, flags, image }]` | A **Scenes** button on the title screen: replay favourite scenes once the player has reached them, without touching their save. |
| `SCRIPT.galleryOpen = true` | Every scene unlocked from the start. |
| `SCRIPT.ageGate = "This story is for adults."` | Asks once before the title screen, and remembers the answer. |

## Keys for players

Click, Space or Enter reads on. 1 to 9 pick a choice. A toggles Auto, L opens the Log, P pauses, Esc closes.

## VC Novel Studio

The [Studio](../studio) edits all of this as cards: lines, choices, jumps, flags, stages, actions and endings, with a live preview of your unsaved edits, a map of every scene, checks for broken jumps and missing animations, find and replace, and backups on every save.
