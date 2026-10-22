// =====================================================================
//  cast.js : WHO is in the scenes
//
//  Every actor is a set of STATIC pictures (poses), one PNG each.
//  To swap in your ComfyUI art: drop the PNG in sprites/ and change the
//  path here, or just save over the placeholder with the same name.
//
//  Sprite rules, so they all line up:
//    - transparent PNG, the character standing, feet at the bottom middle
//    - any size, the same size for every pose of one actor is best
//      (the placeholders are 600 x 900)
//    - drawn facing RIGHT. flip: true on a scene mirrors it to face left
//
//  The placeholders are two grown-ups: Kit runs the corner cafe, Mew is a courier.
// =====================================================================

const CAST = {

  kit: {
    name:  "Kit",            // name tag on the text box
    color: "#2fb3a4",        // name tag colour
    h:     .62,              // height on screen, as a fraction of the window height
    poses: {
      idle:      "sprites/kit_idle.png",
      happy:     "sprites/kit_happy.png",
      sad:       "sprites/kit_sad.png",
      surprised: "sprites/kit_surprised.png",
      // add as many as you like:  sleepy: "sprites/kit_sleepy.png",
    },
  },

  mew: {
    name:  "Mew",
    color: "#f08a2c",
    h:     .62,
    poses: {
      idle:      "sprites/mew_idle.png",
      happy:     "sprites/mew_happy.png",
      sad:       "sprites/mew_sad.png",
      surprised: "sprites/mew_surprised.png",
    },
  },

};
