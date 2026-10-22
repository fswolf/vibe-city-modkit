// =====================================================================
//  actors.js : WHO is on stage and WHERE
//  The stages (backgrounds) and the actors with their sprite strips.
//  What they do lives in scene.js.
//
//  The cast is two placeholder grown-ups, Kit and Mew. Replace their
//  strips with your own art: see docs/animation.md.
// =====================================================================

// Handy spots on the stage, as a fraction of the width (0 = left edge, 1 = right edge)
const HOME = { a: .28, b: .72 };   // where each actor stands when nothing is happening
const MEET = .5;                     // the middle

// Distances between two actors' feet, in sprite pixels, for moves where they touch.
// Use them as { move: { a: { to: "b", gap: HUG } } }. Tune them by eye for your art.
const HUG      = 150;
const HIGHFIVE = 215;

// ---------------------------------------------------------------------
//  THE MOVES
//  Every strip is 8 frames of 512 x 512 in a row (4096 x 512), drawn
//  facing right (the framework mirrors them for facing left), feet on
//  the same line in every frame.
//
//  name:  [ fps, plays, hold frame ]
//    plays:  "loop" repeats, "once" plays through and goes back to idle
//    hold:   frame to freeze on (0 = first); set the seconds with hold: in a step
// ---------------------------------------------------------------------
const MOVES = {
  idle:      [ 4,   "loop"    ],   // slow on purpose: faster looks jittery
  walk:      [ 8.3, "loop"    ],
  run:       [11.1, "loop"    ],

  wave:      [ 8.3, "loop"    ],
  talk:      [ 8.3, "loop"    ],
  laugh:     [ 8.3, "loop"    ],
  nod:       [ 8.3, "once"    ],
  think:     [ 6.7, "loop"    ],
  dance:     [ 9.1, "loop"    ],

  jump:      [ 9.1, "once", 4 ],
  surprised: [ 8.3, "once", 3 ],
  sad:       [ 7.1, "once", 3 ],

  hug:       [ 7.1, "once", 4 ],
  highfive:  [ 8.3, "once", 4 ],

  // sitting: sitdown, then idle is "sit" until standup
  sitdown:   [ 7.7, "once"    ],
  sit:       [ 4.5, "loop"    ],
  standup:   [ 7.7, "once"    ],

  // facing you: turn, then idle is "front" until turnback
  turn:      [10,   "once"    ],
};

// Build one actor's animations from the table: actors/<who>_<move>.png
function moves(who, own) {
  const out = {};
  for (const [name, [fps, plays, hold]] of Object.entries({ ...MOVES, ...own }))
    out[name] = { sheet: `actors/${who}_${name}.png`, frames: 8, fps, loop: plays === "loop", hold: hold ?? null };
  out.front    = { sheet: `actors/${who}_turn.png`, frames: 8, pose: 7 };                           // still, facing you
  out.turnback = { sheet: `actors/${who}_turn.png`, frames: 8, fps: 10, loop: false, reverse: true };
  return out;
}


const SCENE = {

  title: "Animation Framework",
  pauseOnBlur: false,               // true = pause when the player clicks back into the city

  // ------------------------------------------------------------------
  //  STAGES
  //  { stage: "park", place: { a: .2, b: .8 } } fades to black, swaps the
  //  stage, moves the actors while it is dark, and fades back in.
  //  bg: "bg/street.png" uses your own picture instead of a painted stage.
  // ------------------------------------------------------------------
  stages: {
    street: { paint: "night" },
    park:   { paint: "day"   },
  },
  stage: "street",

  // ------------------------------------------------------------------
  //  ACTORS
  //  x, y      feet position as a fraction of the stage
  //  h         height of a 512 px frame as a fraction of the stage height
  //  flip      true = starts facing left
  //  headroom  empty part of the frame above the head, so speech sits just above it
  // ------------------------------------------------------------------
  actors: {
    a: { name: "Kit", color: "#2fb3a4", x: HOME.a, y: .985, h: .7, headroom: 60 / 512, anims: moves("kit") },
    b: { name: "Mew", color: "#f08a2c", x: HOME.b, y: .985, h: .7, headroom: 60 / 512, flip: true, anims: moves("mew") },
  },
};
