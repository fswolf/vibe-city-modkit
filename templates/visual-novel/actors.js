// =====================================================================
//  actors.js : WHO is in the story and WHERE
//  The title, settings, flags, stages and the cast.
//  What happens lives in story.js (edit it by hand or in VC Novel Studio).
//
//  The cast here is two placeholder grown-ups, Kit (runs the corner cafe)
//  and Mew (a courier). Swap in your own sprite strips: see docs/animation.md.
// =====================================================================

// Feet apart in sprite pixels for moves where two actors touch
const HUG      = 150;
const HIGHFIVE = 215;

// ---------------------------------------------------------------------
//  THE MOVES the placeholder strips have. name: [ fps, "loop" or "once", hold frame ]
//  Every strip is actors/<who>_<move>.png: 8 frames of 512 x 512 in a row,
//  drawn facing right (the engine mirrors them), feet on the same line.
// ---------------------------------------------------------------------
const MOVES = {
  idle: [4, "loop"], walk: [8.3, "loop"], run: [11.1, "loop"],
  wave: [8.3, "loop"], talk: [8.3, "loop"], laugh: [8.3, "loop"], nod: [8.3, "once"], think: [6.7, "loop"],
  jump: [9.1, "once", 4], surprised: [8.3, "once", 3], sad: [7.1, "once", 3], dance: [9.1, "loop"],
  hug: [7.1, "once", 4], highfive: [8.3, "once", 4],
  sitdown: [7.7, "once"], sit: [4.5, "loop"], standup: [7.7, "once"], turn: [10, "once"],
};

// Build one actor's animations from the table: actors/<who>_<move>.png
function moves(who, own) {
  const out = {};
  for (const [name, [fps, plays, hold]] of Object.entries({ ...MOVES, ...own }))
    out[name] = { sheet: `actors/${who}_${name}.png`, frames: 8, fps, loop: plays === "loop", hold: hold ?? null };
  out.front    = { sheet: `actors/${who}_turn.png`, frames: 8, pose: 7 };                          // still, facing you
  out.turnback = { sheet: `actors/${who}_turn.png`, frames: 8, fps: 10, loop: false, reverse: true };
  return out;
}

const SCRIPT = {

  title:    "Corner Cafe",
  subtitle: "A tiny Vibe City story",

  // ------------------------------------------------------------------
  //  SETTINGS
  // ------------------------------------------------------------------
  textSpeed:   42,      // letters a second
  dimOthers:   true,    // darken whoever is not talking
  pauseOnBlur: false,   // true = pause when the player clicks back into the city

  // ------------------------------------------------------------------
  //  FLAGS: what the story remembers about your choices.
  //  Change them in story.js with { add: { trust: 1 } } or { set: { met: true } }
  // ------------------------------------------------------------------
  flags: { trust: 0, fun: 0 },

  // ------------------------------------------------------------------
  //  STAGES. Switch with { stage: "park" } (fades to black and back).
  //  paint: "day" or "night" draws a city, colors: [sky top, sky bottom, ground]
  //  paints a plain stage, bg: "bg/cafe.png" uses your own picture.
  // ------------------------------------------------------------------
  stages: {
    street: { paint: "day" },
    cafe:   { colors: ["#3a2a22", "#7a5642", "#4a3528"] },
    park:   { paint: "night" },
  },
  stage: "street",      // the stage shown first

  // ------------------------------------------------------------------
  //  ACTORS
  //  name, color  the name tag on the text box
  //  x, y         feet position as a fraction of the stage
  //  h            height of a 512 px frame as a fraction of the stage height
  //  flip         true = starts facing left
  //  hidden       true = off stage until a { show: { a: .3 } } line
  // ------------------------------------------------------------------
  actors: {
    a: { name: "Kit", color: "#2fb3a4", x: .3, y: 1.02, h: .9, headroom: 60 / 512, anims: moves("kit") },
    b: { name: "Mew", color: "#f08a2c", x: .7, y: 1.02, h: .9, headroom: 60 / 512, flip: true, hidden: true, anims: moves("mew") },
  },
};
