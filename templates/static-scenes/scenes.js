// =====================================================================
//  scenes.js : WHAT happens
//
//  Four scenes. Each one has:
//    name     shown top left
//    bg       the backdrop picture (any size, it is stretched to cover)
//    place    where each actor stands:  x 0 = left edge, 1 = right edge
//             pose = which picture from cast.js, flip = face left
//             leave an actor out and they are not in that scene
//    intro    the dialog when the scene opens. Click to read on.
//    buttons  four play buttons. Each plays a list of steps in order.
//
//  A line of dialog:  "Kit: Hello!"   (a name from cast.js, then a colon)
//  Narration:         "The sun goes down."
//
//  A step:  { kit: "hop", mew: { pose: "happy", move: "spin" }, say: "Mew: Wheee!", fx: "sparkles" }
//    kit: "hop"                 play a move (see MOVES below)
//    kit: { pose: "sad" }       swap the picture
//    kit: { move: "walk", to: .6 }   walk (or slide) to a spot
//    kit: { flip: true }        face left (false = right)
//    say: "Kit: Hi"             a line in the text box, plays on by itself
//    fx:  "sparkles"            hearts, sparkles, notes, sweat, tears, stars, zzz or rain
//         over the first actor in the step, or { kind: "notes", at: "mew" }
//    wait: 1                    seconds to wait before the next step
//    secs: .8                   how long the moves in this step take
//  Everything in one step plays at the same time.
//
//  MOVES (static sprites, so it is all wiggles and hops):
//    hop  jump  bounce  shake  nod  wiggle  spin  turn  grow  shrink
//    walk  slide  fadeout  fadein  float  sink  lean  tremble  dance
// =====================================================================

const SCENES = [

  // ------------------------------------------------------------------
  {
    name: "Morning, The Flat",
    bg:   "bg/bedroom.png",
    place: { kit: { x: .32, pose: "idle" }, mew: { x: .7, pose: "idle", flip: true } },
    intro: [
      "Kit and Mew share a flat above the corner cafe. The alarm has gone off twice.",
      { kit: { pose: "happy" }, mew: "hop" },
      "Kit: Up! The cafe opens in twenty minutes.",
      { mew: { pose: "surprised" } },
      "Mew: Twenty? I have a delivery at eight!",
      { mew: { pose: "idle" } },
    ],
    buttons: [
      { label: "Stretch", steps: [
        { kit: { pose: "happy", move: "grow" }, mew: { pose: "happy", move: "grow" }, secs: 1 },
        { kit: "shrink", mew: "shrink" },
        { say: "Kit: Best stretch of the week." },
        { kit: { pose: "idle" }, mew: { pose: "idle" } },
      ] },
      { label: "Pillow fight", steps: [
        { kit: { pose: "happy", move: "walk", to: .55 }, secs: .7 },
        { kit: "lean", mew: { pose: "surprised", move: "shake" }, fx: { kind: "stars", at: "mew" } },
        { say: "Mew: Hey! No fair!" },
        { mew: { pose: "happy", move: "hop" }, kit: { pose: "surprised", move: "tremble" } },
        { kit: { pose: "idle", move: "walk", to: .32 }, mew: { pose: "idle" }, secs: .7 },
      ] },
      { label: "Snooze", steps: [
        { mew: { pose: "sad", move: "sink" }, fx: { kind: "zzz", at: "mew" }, secs: 1.4 },
        { say: "Kit: Nope! Up! Toast is ready!" },
        { kit: "bounce", mew: { pose: "surprised", move: "float" } },
        { mew: { pose: "idle" } },
      ] },
      { label: "High five", steps: [
        { kit: { pose: "happy", move: "walk", to: .46 }, mew: { pose: "happy", move: "walk", to: .58 }, secs: .9 },
        { kit: "hop", mew: "hop", fx: "sparkles" },
        { say: "Mew: Team breakfast!" },
        { kit: { pose: "idle", move: "walk", to: .32 }, mew: { pose: "idle", move: "walk", to: .7 }, secs: .9 },
      ] },
    ],
  },

  // ------------------------------------------------------------------
  {
    name: "Noon, The Park",
    bg:   "bg/park.png",
    place: { kit: { x: .25, pose: "happy" }, mew: { x: .75, pose: "idle", flip: true } },
    intro: [
      "Lunch break. The park is full of flowers and somebody is flying a kite.",
      "Mew: Race you to the big tree!",
      { kit: { pose: "surprised" } },
      "Kit: You always start before you say go!",
      { kit: { pose: "happy" } },
    ],
    buttons: [
      { label: "Race", steps: [
        { kit: { move: "walk", to: .78, flip: false }, mew: { move: "walk", to: .9 }, secs: 1.2 },
        { mew: { pose: "happy", move: "jump" }, kit: { pose: "sad", move: "shake" } },
        { say: "Mew: Winner!" },
        { kit: { move: "walk", to: .25, pose: "idle" }, mew: { move: "walk", to: .75, pose: "idle" }, secs: 1 },
      ] },
      { label: "Dance", steps: [
        { kit: { pose: "happy", move: "dance" }, mew: { pose: "happy", move: "dance" }, fx: { kind: "notes", at: "kit" }, secs: 2 },
        { say: "Kit: La la la!" },
        { kit: "spin", mew: "spin" },
      ] },
      { label: "Butterfly", steps: [
        { kit: { pose: "surprised", move: "float" }, fx: { kind: "sparkles", at: "kit" } },
        { kit: { pose: "happy", move: "hop" }, wait: .2 },
        { kit: "hop" },
        { say: "Kit: It landed on my nose!" },
        { mew: { pose: "happy", move: "nod" } },
      ] },
      { label: "Rain shower", steps: [
        { fx: { kind: "rain" }, kit: { pose: "surprised", move: "tremble" }, mew: { pose: "surprised", move: "tremble" }, secs: 1.4 },
        { say: "Mew: Run for it!" },
        { kit: { move: "walk", to: .45 }, mew: { move: "walk", to: .55 }, secs: .6 },
        { kit: { pose: "happy" }, mew: { pose: "happy", move: "bounce" }, say: "Kit: Under the tree, quick!" },
        { kit: { move: "walk", to: .25, pose: "happy" }, mew: { move: "walk", to: .75, pose: "idle" }, secs: .8 },
      ] },
    ],
  },

  // ------------------------------------------------------------------
  {
    name: "Evening, The Cafe",
    bg:   "bg/cafe.png",
    place: { kit: { x: .3, pose: "idle" }, mew: { x: .7, pose: "happy", flip: true } },
    intro: [
      "Closing time. The cafe hums with soft music and the smell of fresh coffee.",
      "Mew: Two hot chocolates, please. One for me, one for the barista.",
      { kit: "nod" },
      "Kit: And the last two cookies. Staff perks.",
    ],
    buttons: [
      { label: "Cheers", steps: [
        { kit: { pose: "happy", move: "walk", to: .42 }, mew: { move: "walk", to: .58 }, secs: .6 },
        { kit: "lean", mew: "lean", fx: { kind: "sparkles", at: "kit" } },
        { say: "Kit: To a long day, done." },
        { kit: { move: "slide", to: .3 }, mew: { move: "slide", to: .7 }, secs: .5 },
      ] },
      { label: "Too hot", steps: [
        { mew: { pose: "surprised", move: "tremble" }, fx: { kind: "sweat", at: "mew" }, secs: 1 },
        { say: "Mew: Hot! Hot hot hot!" },
        { kit: { pose: "happy", move: "bounce" }, mew: { pose: "sad" } },
        { mew: { pose: "idle" } },
      ] },
      { label: "Last cookie", steps: [
        { kit: { pose: "surprised" }, mew: { pose: "surprised" } },
        { say: "There is only one cookie left." },
        { kit: "shake", mew: "shake" },
        { kit: { pose: "happy", move: "nod" }, say: "Kit: Halves?" },
        { mew: { pose: "happy", move: "hop" }, fx: { kind: "stars", at: "mew" } },
      ] },
      { label: "Sleepy", steps: [
        { kit: { pose: "idle", move: "sink" }, fx: { kind: "zzz", at: "kit" }, secs: 1.2 },
        { say: "Mew: No sleeping on the counter, boss!" },
        { kit: { pose: "surprised", move: "float" } },
        { kit: { pose: "idle" } },
      ] },
    ],
  },

  // ------------------------------------------------------------------
  {
    name: "Sunset, The Beach",
    bg:   "bg/beach.png",
    place: { kit: { x: .38, pose: "happy" }, mew: { x: .62, pose: "happy", flip: true } },
    intro: [
      "Day off. The sun melts into the sea like an orange popsicle.",
      { kit: { pose: "idle" } },
      "Kit: No customers. No parcels. Just sand.",
      "Mew: Best day off in a year.",
      { kit: { pose: "happy" }, fx: "sparkles" },
    ],
    buttons: [
      { label: "Splash", steps: [
        { kit: { pose: "happy", move: "jump" }, mew: { pose: "surprised", move: "shake" }, fx: { kind: "rain", at: "mew" } },
        { say: "Mew: You're getting me soaked!" },
        { mew: { pose: "happy", move: "jump" }, kit: { pose: "surprised", move: "shake" } },
        { kit: { pose: "happy" } },
      ] },
      { label: "Shell hunt", steps: [
        { kit: { move: "walk", to: .15 }, mew: { move: "walk", to: .85 }, secs: 1 },
        { kit: "sink", mew: "sink", secs: .8 },
        { mew: { pose: "surprised", move: "float" }, fx: { kind: "sparkles", at: "mew" }, say: "Mew: Found a pink one!" },
        { kit: { move: "walk", to: .38, pose: "happy" }, mew: { move: "walk", to: .62, pose: "happy" }, secs: 1 },
      ] },
      { label: "Watch the sun", steps: [
        { kit: { pose: "idle", move: "lean" }, mew: { pose: "idle", move: "lean" }, secs: 1.5 },
        { say: "The sun is gone. The first star comes out." },
        { fx: { kind: "stars", at: "kit" }, kit: { pose: "happy", move: "nod" } },
        { say: "Kit: Make a wish." },
      ] },
      { label: "Head home", steps: [
        { kit: { pose: "happy", move: "wiggle" }, mew: { pose: "happy", move: "wiggle" }, secs: 1.2 },
        { say: "Mew: Same time next week?" },
        { say: "Kit: Same time next week." },
        { kit: "fadeout", mew: "fadeout", secs: 1.2 },
        { kit: "fadein", mew: "fadein", secs: .8 },
      ] },
    ],
  },

];
