// =====================================================================
//  scene.js : WHAT the actors do
//  Quick buttons and the scenes menu. Who they are lives in actors.js.
//
//  A scene is a list of steps, played top to bottom. Each step waits
//  for everything it started before the next one begins.
//
//    { move: { a: .7 }, secs: 1.4 }          walk actor a to x .7 over 1.4 s
//    { move: { a: .7 }, secs: .8, a: "run" } run there instead
//    { move: { a: { to: "b", gap: HUG } } }  walk up beside actor b
//    { a: "hug", b: "hug", hold: 1 }         play animations, freeze 1 s on the hold frame
//    { a: "dance", loops: 3 }                play a loop 3 times
//    { say: ["a", "Hi there!"] }             speech window over actor a
//    { flip: { a: true } }                   face left (false = right)
//    { a: "sitdown", idle: { a: "sit" } }    sit, and stay sitting between moves
//    { a: "standup", idle: { a: "idle" } }   stand back up
//    { a: "turn", idle: { a: "front" } }     face you (turnback to undo)
//    { wait: .5 }                            pause after the step
//    { stage: "park", place: {...} }         fade to another stage
// =====================================================================

// Both back to their spots, facing each other
const GO_HOME = [
  { move: { a: HOME.a, b: HOME.b }, secs: 2 },
  { flip: { a: false, b: true } },
];


// ---------------------------------------------------------------------
//  QUICK BUTTONS  (keys Q, W, E). Each press plays one of the "pick" lists at random.
// ---------------------------------------------------------------------
SCENE.quick = [

  { id: "walk", label: "Walk", pick: [
    [ { move: { a: .1 }, secs: 1.4 }, { move: { a: HOME.a }, secs: 1.4 }, { flip: { a: false } } ],
    [ { move: { b: .9 }, secs: 1.4 }, { move: { b: HOME.b }, secs: 1.4 }, { flip: { b: true } } ],
    [ { move: { a: .9, b: .1 }, secs: 3.6 }, ...GO_HOME ],
  ] },

  { id: "greet", label: "Greet", pick: [
    [ { move: { a: { to: "b", gap: HIGHFIVE } }, secs: 1.6 }, { a: "highfive", b: "highfive", hold: .8 }, ...GO_HOME ],
    [ { move: { b: { to: "a", gap: HUG } }, secs: 1.6 }, { a: "hug", b: "hug", hold: 1.2, say: ["a", "Long time no see!"] }, ...GO_HOME ],
  ] },

  { id: "idle", label: "Chill", pick: [
    [ { b: "think", loops: 2, say: ["b", "Hmm"] } ],
    [ { a: "wave", loops: 2 }, { b: "wave", loops: 2 } ],
    [ { say: ["a", "Nice weather today"], a: "talk", loops: 2 }, { b: "nod" } ],
    [ { a: "turn", b: "turn", idle: { a: "front", b: "front" } }, { wait: 1.4 },
      { a: "turnback", b: "turnback", idle: { a: "idle", b: "idle" } } ],
  ] },
];


// ---------------------------------------------------------------------
//  SCENES MENU  (keys 1 to 9, then 0)
// ---------------------------------------------------------------------
SCENE.acts = [

  { id: "hello", label: "Say hello", steps: [
    { a: "wave", loops: 2, say: ["a", "Mew! Over here!"] },
    { move: { a: MEET - .12 }, secs: 1.6 },
    { b: "surprised", hold: .3, say: ["b", "Kit! Hi!"] },
    { a: "talk", loops: 3, say: ["a", "Coffee? I just opened up."] },
    { b: "laugh", loops: 2 },
    ...GO_HOME,
  ] },

  { id: "highfive", label: "High five", steps: [
    { move: { b: MEET + .1 }, secs: 1.6 },
    { move: { a: { to: "b", gap: HIGHFIVE } }, secs: 1.4 },
    { a: "highfive", b: "highfive", hold: .8, say: ["b", "Nice!"] },
    ...GO_HOME,
  ] },

  { id: "park", label: "Park bench", steps: [
    { stage: "park", place: { a: .4, b: .6 } },
    { flip: { a: false, b: true } },
    { a: "sitdown", b: "sitdown", idle: { a: "sit", b: "sit" } },
    { say: ["b", "Long day."], wait: .6 },
    { say: ["a", "Longer tomorrow."], wait: .6 },
    { a: "standup", b: "standup", idle: { a: "idle", b: "idle" } },
    { stage: "street", place: { a: HOME.a, b: HOME.b } },
    { flip: { a: false, b: true } },
  ] },

  { id: "dance", label: "Dance party", steps: [
    { move: { a: MEET - .1, b: MEET + .1 }, secs: 1.4 },
    { a: "dance", b: "dance", loops: 4 },
    { a: "jump", b: "jump", hold: .4 },
    ...GO_HOME,
  ] },

  { id: "news", label: "Bad news", steps: [
    { say: ["b", "The bakery closed."] },
    { a: "sad", hold: 1 },
    { b: "think", loops: 2, say: ["b", "...We could open one."] },
    { a: "surprised", hold: .4 },
    { a: "laugh", b: "laugh", loops: 2 },
  ] },

  { id: "race", label: "Race", steps: [
    { move: { a: .1, b: .2 }, secs: 1.2 },
    { flip: { a: false, b: false } },
    { say: ["a", "Ready, steady..."], wait: .3 },
    { move: { a: 1.1, b: 1.1 }, secs: 1.4, a: "run", b: "run" },
    { move: { a: -.1, b: -.1 }, secs: .01 },
    { move: { a: HOME.a, b: HOME.b }, secs: 1.2, a: "run", b: "run" },
    { flip: { a: false, b: true } },
    { b: "jump", hold: .4, say: ["b", "I win!"] },
  ] },

  { id: "every", label: "Every move", steps: everyMove() },
];


// ---------------------------------------------------------------------
//  "Every move": both play each animation in turn, its name over Kit
// ---------------------------------------------------------------------
function everyMove() {
  const steps = [{ move: { a: .38, b: .62 }, secs: 1.6 }, { flip: { a: false, b: true } }];
  const show = (name, extra) => steps.push({ a: name, b: name, say: ["a", name], sayFor: 1.4, ...extra });
  for (const n of ["idle", "wave", "talk", "laugh", "think", "dance"]) show(n, { loops: 2 });
  for (const n of ["nod", "jump", "surprised", "sad", "highfive", "hug"]) show(n, { hold: .5 });
  steps.push({ a: "sitdown", b: "sitdown", idle: { a: "sit", b: "sit" }, say: ["a", "sitdown, sit"], sayFor: 1.4 });
  steps.push({ a: "standup", b: "standup", idle: { a: "idle", b: "idle" }, say: ["a", "standup"], sayFor: 1.4 });
  steps.push({ a: "turn", b: "turn", idle: { a: "front", b: "front" }, say: ["a", "turn"], sayFor: 1.4 });
  steps.push({ wait: 1.2 });
  steps.push({ a: "turnback", b: "turnback", idle: { a: "idle", b: "idle" } });
  steps.push({ move: { a: .1, b: .9 }, secs: 1.6, say: ["a", "walk"], sayFor: 1.4 });
  steps.push({ move: { a: .9, b: .1 }, secs: 1.1, a: "run", b: "run", say: ["a", "run"], sayFor: 1.4 });
  steps.push(...GO_HOME);
  return steps;
}


// ---------------------------------------------------------------------
//  A park bench on the park stage, drawn behind the actors (the "back" hook).
//  The sit strips put the seat about 140 sprite px above the feet.
// ---------------------------------------------------------------------
AF.on("back", (g, W, H) => {
  if (AF.state.stage !== SCENE.stages.park) return;
  const a = SCENE.actors.a, px = a.h * H / 512;
  const feet = a.y * H - 40 * px, seat = feet - 140 * px;
  const x0 = W * .3, x1 = W * .7, wood = "#8a5a34", dark = "#5e3b20";
  g.fillStyle = dark;
  for (const x of [x0 + 14 * px, x1 - 24 * px]) g.fillRect(x, seat, 10 * px, feet - seat);
  g.fillStyle = wood;
  g.fillRect(x0, seat - 120 * px, x1 - x0, 22 * px);
  g.fillRect(x0, seat - 80 * px, x1 - x0, 22 * px);
  g.fillRect(x0 - 8 * px, seat, x1 - x0 + 16 * px, 14 * px);
});
