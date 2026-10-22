# Micro games

The heart of Vibe City's buildings is the little game inside them: click the casino and play blackjack, click the arcade and play a cabinet. A mod can do the same. [`templates/micro-game`](../templates/micro-game) is a complete one, **Bean Catcher**, in two short scripts.

## The shape of every micro game

```
game.html   a canvas that fills the window, then city.js and game.js
city.js     the messages to and from the city, wrapped in CITY.*
game.js     rules, state, input, update(dt), draw(), one loop
```

### One loop

```js
let last = performance.now();
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000); last = now;   // seconds since the last frame, capped
  update(dt);   // move things: dt keeps the speed the same on any screen
  draw();       // paint the whole screen from scratch
  requestAnimationFrame(loop);
}
```

Cap `dt`: when the window was hidden for a second, an uncapped step makes everything jump.

### Screens

Keep a single `screen` variable: `"title"`, `"play"`, `"over"`. `update` only moves things while playing, `draw` paints the right screen. That is enough for nearly every small game.

### Sizes as fractions

Store positions as fractions of the window (`x: .5` is the middle) and multiply by the canvas size when drawing. The window can be any size the player's screen allows, and nothing needs to change.

## Being a good guest in the city

| Do | Why |
|---|---|
| `CITY.ready(info => ...)` before starting | `info.data` is your save, `info.city.open` says whether the building has power and water, `info.volume` is the player's effects volume |
| Pause on `blur` | The city takes the keyboard back when the player clicks into it. Do not let them lose a round they cannot see. |
| Escape: pause first, close second | The city cannot hear Escape while your page has the keyboard, so closing is up to you |
| `CITY.save(data)` after every round | The window can close without warning (bulldozed, another city loaded) |
| Scale every sound by `volume` | The player set it for a reason |
| Stay closed when `open` is false | A building without power or water is shut, like the casino |
| Pay with `CITY.pay(amount)` | The game caps it at `money.per_month` in mod.json, and answers with `paid` |

## Paying the city

Paying is what makes a micro game part of the city rather than a toy beside it. Tie the money to how well the player did, and keep `money.per_month` modest so the game helps a city without replacing taxes. A building that draws power and water pays nothing while it is closed.

## Developing without restarting the game

Open `game.html` straight in a browser. `city.js` notices nobody answers and pretends to be a small test city after a moment, so you can play, edit and reload. Put it in `Documents/Vibe City/mods/` to try it for real.

## Ideas that fit in an afternoon

- A whack-a-mole at the pest control office
- A memory card game at the library
- A timing game at the fire station: hit the bell when the light turns green
- Catch the fish at the harbour
- A slot machine or a coin pusher at an arcade
- Stack the boxes at the warehouse

Each one is the same file: new rules at the top, new `update` and `draw`.
