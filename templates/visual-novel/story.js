// =====================================================================
//  story.js : WHAT happens
//  A label is a scene: a list of lines read top to bottom. A label that
//  does not jump away runs on into the next one, so order matters.
//
//    "Kit: Hello!"                          a line, said by Kit
//    "The street is quiet."                 narration
//    { choice: [["Help", "help"], ["Leave", "leave"]] }
//    { choice: [{ text: "Joke", goto: "joke", add: { fun: 1 } }] }
//    { goto: "later" }                       jump to a label
//    { if: "trust >= 2", goto: "best", else: "plain" }
//    { add: { trust: 1 } }   { set: { met: true } }
//    { stage: "park", place: { a: .3, b: .7 } }
//    { a: "wave", loops: 2 }                 any animation step (docs/animation.md)
//    { a: "jump", text: "words shown while it plays" }
//    { note: "for you, the reader never sees it" }
//    { end: "Name of this ending" }
//
//  VC Novel Studio edits all of this with cards and a live preview.
// =====================================================================

SCRIPT.start = "start";

SCRIPT.labels = {

  start: [
    "Morning on the high street. The corner cafe has just turned its sign to OPEN.",
    { a: "idle", text: "Kit wipes down the counter for the third time. Nobody has come in yet." },
    { show: { b: 1.15 }, move: { b: .72 }, b: "run", secs: 1.8, text: "A courier skids round the corner with a parcel the size of a fridge." },
    { b: "surprised", hold: .4 },
    "Mew: Excuse me! Is this Pine Street? My map says Pine Street. The street says something else.",
    "Kit: This is Harbour Gate. Pine Street is two stops up the line.",
    { b: "sad", hold: .5 },
    "Mew: Two stops. With this. On foot.",
    { choice: [
      { text: "Offer to look after the parcel", goto: "help", add: { trust: 1 } },
      { text: "Offer a coffee first", goto: "coffee", add: { fun: 1 } },
    ] },
  ],

  help: [
    "Kit: Leave it here. I will mind it while you find the right door.",
    { a: "nod" },
    "Mew: You would do that? You do not even know what is in it.",
    "Kit: If it starts ticking, I will call you.",
    { b: "laugh", loops: 2 },
    { goto: "later" },
  ],

  coffee: [
    "Kit: First, coffee. Nobody finds Pine Street on an empty stomach.",
    { b: "think", loops: 1 },
    "Mew: Is that a rule?",
    "Kit: It is now. I own the cafe, I make the rules.",
    { a: "dance", loops: 1, text: "Kit does a small victory shuffle behind the counter." },
    { goto: "later" },
  ],

  later: [
    { stage: "cafe", place: { a: .32, b: .68 } },
    "That afternoon, the courier is back. No parcel this time.",
    "Mew: Found it. Pine Street. The owner gave me a tip and a very long story about his cat.",
    "Kit: Sounds like a good day.",
    { if: "trust >= 1", goto: "end_regular", else: "board" },
  ],

  board: [
    "Mew: So. The cafe has a board game shelf.",
    "Kit: It does. Nobody has beaten me at draughts in three years.",
    { choice: [
      { text: "Let Mew win", goto: "end_friends", add: { fun: 1 } },
      { text: "Play to win", goto: "end_rivals" },
    ] },
  ],

  end_regular: [
    { a: "highfive", b: "highfive", hold: .6 },
    "Mew drops by every morning after that, on the way to every wrong street in the city.",
    { end: "A Regular" },
  ],

  end_friends: [
    { b: "jump", hold: .4, text: "Mew wins. Kit is very bad at looking surprised." },
    "Mew: Same time tomorrow?",
    "Kit: Same time tomorrow.",
    { end: "Draughts Night" },
  ],

  end_rivals: [
    { a: "laugh", loops: 2 },
    "Kit wins in eleven moves. Mew demands a rematch. And another. The cafe stays open late.",
    { end: "Rivals" },
  ],
};
