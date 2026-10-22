// =====================================================================
//  af.js : the Animation Frame Work (vb_af)
//
//  The engine that acts out a scene. Your own files only describe things:
//    actors.js   who is on stage, their sprite sheets, the stages
//    scene.js    what they do (vb-af)   /   story.js (vb-visual)
//  This file loads the sheets, plays them frame by frame, walks actors
//  around, draws speech windows and backgrounds, and runs the steps.
//  You never need to change it to make a new mod.
//
//  What it gives you (the AF object):
//    AF.start(scene, canvas)   load everything and start drawing
//    AF.run(steps)             play a list of steps, waits until done
//    AF.step(step)             play one step
//    AF.halt()                 stop the scene that is playing
//    AF.reset()                back to the first stage, everyone home and standing
//    AF.say(id, text)          speech window over an actor
//    AF.changeStage(name)      fade to another stage
//    AF.on(event, fn)          hooks: "act", "end", "stage", or any emit name,
//                              "back" draws behind the actors, "draw" in front
//    AF.state                  everything live: actors, paused, busy, volume
//
//  Sheet options (in actors.js): frames, fps, cols, loop: false, hold,
//    pose: 7       always show that one frame (a still, like "front" after a turn)
//    reverse: true play the strip backwards (a turn played back to the side)
// =====================================================================

const AF = (() => {

  // ===================================================================
  //  SMALL HELPERS
  // ===================================================================

  const imgs  = {};   // every picture loaded so far, so each loads once
  const hooks = {};   // AF.on() listeners, by event name

  // Load a picture once, return a promise of it
  const load = src => imgs[src] || (imgs[src] = new Promise((ok, no) => {
    const i = new Image();
    i.onload  = () => ok(i);
    i.onerror = () => no(new Error("missing " + src));
    i.src = src;
  }));

  const on    = (ev, fn)   => (hooks[ev] = hooks[ev] || []).push(fn);
  const emit  = (ev, ...a) => (hooks[ev] || []).forEach(f => f(...a));
  const sleep = ms         => new Promise(r => setTimeout(r, ms));
  const ease  = t          => t < .5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;   // smooth start and stop

  // A wait that stops counting while paused, and ends early if the scene is stopped
  const wait = async ms => {
    let left = ms, t = performance.now();
    while (left > 0 && !S.stop) {
      await sleep(Math.min(50, left));
      const n = performance.now();
      if (!S.paused) left -= n - t;
      t = n;
    }
  };

  // An actor by id, or a warning (a typo in a scene should not break the window)
  const actor = id => S.actors[id] || (console.warn("vb_af: no actor", id), null);


  // ===================================================================
  //  ACTOR
  //  One character on stage: position, facing, the animation playing,
  //  and a walk in progress.
  // ===================================================================

  class Actor {

    constructor(id, def) {
      // defaults, then whatever actors.js gave
      Object.assign(this, { id, x: .3, y: .92, h: .55, flip: false, idle: "idle" }, def);
      this.cur = null;   // the sheet playing now
      this.t   = 0;      // seconds into it
      this.tw  = null;   // a move in progress
    }

    // Load every sheet and work out its frame size
    async init() {
      const list = Object.values(this.anims);
      await Promise.all(list.map(a => load(a.sheet)));    // all sheets at once
      for (const a of list) {
        a.img    = await load(a.sheet);
        a.frames = a.frames || 1;
        a.cols   = a.cols || a.frames;           // a strip, unless cols says it is a grid
        a.rows   = Math.ceil(a.frames / a.cols);
        a.fw     = a.img.width / a.cols;         // one frame's size
        a.fh     = a.img.height / a.rows;
        a.fps    = a.fps || 8;
        a.loop   = a.loop !== false;
        if (a.hold == null) a.hold = null;
      }
      this.play(this.idle);
    }

    has(name) {
      return !!(this.anims[name] || this.anims[name + "_r"] || this.anims[name + "_l"]);
    }

    // Which sheet to use for an animation, and whether to mirror it.
    // "walk_l" / "walk_r" are drawn the way they face and never mirrored.
    // A plain "walk" is mirrored when the actor faces left.
    pick(name) {
      const own = this.anims[name + (this.flip ? "_l" : "_r")];
      if (own) return [own, false];
      if (this.anims[name]) return [this.anims[name], this.flip];
      const other = this.anims[name + (this.flip ? "_r" : "_l")];
      return other ? [other, true] : null;
    }

    // Play an animation. loops: how many times (Infinity = forever).
    // hold: seconds to freeze on the sheet's hold frame (a hug, a reach).
    // The promise resolves when it finishes and idle takes over.
    play(name, loops = Infinity, hold = 0) {
      if (!this.pick(name)) {
        console.warn("vb_af: no anim", this.id, name);
        name = this.pick(this.idle) ? this.idle : this.pick("idle") ? "idle" : Object.keys(this.anims)[0];
      }
      const prev = this.done;                  // whatever was playing is over: let its step move on
      this.done = null;
      if (prev) prev();
      [this.cur, this.mirror] = this.pick(name);
      this.anim  = name;
      this.t     = 0;
      this.loops = this.cur.loop ? loops : 1;
      this.holdS = this.cur.hold != null ? hold : 0;
      return new Promise(r => (this.done = r));
    }

    // Turn left (true) or right (false), keeping the same animation
    face(left) {
      if (this.flip === left) return;
      this.flip = left;
      const p = this.pick(this.anim);
      if (p) [this.cur, this.mirror] = p;
    }

    // Slide to a new x over secs. The promise resolves on arrival.
    moveTo(x, secs) {
      this.tw = { x0: this.x, x1: x, t: 0, d: Math.max(.01, secs) };
      return new Promise(r => (this.tw.done = r));
    }

    // Every frame: advance the clock and the move, finish the animation when due
    update(dt) {
      const a = this.cur;
      if (!a) return;
      this.t += dt;

      if (this.tw) {
        const w = this.tw;
        w.t += dt;
        const k = Math.min(1, w.t / w.d);
        this.x = w.x0 + (w.x1 - w.x0) * ease(k);
        if (k >= 1) { this.tw = null; w.done(); }
      }

      const len = a.frames / a.fps + (this.holdS || 0);
      if (this.loops !== Infinity && this.t >= len * this.loops) {
        const d = this.done;
        this.done = null;
        this.play(this.idle);
        d && d();
      }
    }

    // The frame number to show right now
    frame() {
      const a = this.cur;
      let t = this.t;
      if (this.holdS) {                        // freeze on the hold frame for holdS seconds
        const h0 = a.hold / a.fps;
        if (t >= h0) t = t < h0 + this.holdS ? h0 : t - this.holdS;
      }
      if (a.pose != null) return a.pose;       // a still frame
      const f0 = Math.floor(t * a.fps + 1e-6);
      const f  = a.loop ? f0 % a.frames : Math.min(f0, a.frames - 1);
      return a.reverse ? a.frames - 1 - f : f;
    }

    // Draw with the feet at (x, y), h tall. dim = darker (not the one talking).
    draw(g, W, H) {
      const a = this.cur;
      if (!a || this.hidden) return;
      const f  = this.frame();
      const sx = (f % a.cols) * a.fw;
      const sy = Math.floor(f / a.cols) * a.fh;
      const dh = this.h * H;
      const dw = dh * a.fw / a.fh;
      const x  = this.x * W;
      const y  = this.y * H;

      g.save();
      if (this.dim) g.filter = "brightness(.55) saturate(.8)";
      g.translate(x, y);
      if (this.mirror) g.scale(-1, 1);
      g.drawImage(a.img, sx, sy, a.fw, a.fh, -dw / 2, -dh, dw, dh);
      g.restore();
    }
  }


  // ===================================================================
  //  STATE AND THE DRAW LOOP
  // ===================================================================

  const S = {
    actors:  {},      // by id
    bubbles: [],      // speech windows showing
    paused:  false,
    busy:    false,   // a scene is playing
    stop:    false,   // halt() was asked for
    vol:     1,       // the game's volume, for sounds
    stage:   null,    // the stage showing
    fade:    0,       // 0 = clear, 1 = black
  };
  let canvas, g, bg = null, last = 0;

  async function start(scene, cv) {
    canvas = cv;
    g = canvas.getContext("2d");
    g.imageSmoothingEnabled = true;
    S.scene  = scene;
    S.stages = scene.stages || {};
    await setStage(typeof scene.stage === "string" ? scene.stage : (scene.stage || {}));
    for (const [id, def] of Object.entries(scene.actors)) {
      S.actors[id] = new Actor(id, def);
      await S.actors[id].init();
    }
    requestAnimationFrame(tick);
    emit("start", S);
  }

  // Keep the canvas sharp at any window size
  function fit() {
    const r = canvas.getBoundingClientRect(), d = devicePixelRatio || 1;
    if (canvas.width !== Math.round(r.width * d) || canvas.height !== Math.round(r.height * d)) {
      canvas.width  = Math.round(r.width * d);
      canvas.height = Math.round(r.height * d);
    }
  }

  // One frame: background, actors (back to front), speech, hooks, fade
  function tick(ts) {
    const dt = Math.min(.1, (ts - last) / 1000 || 0);
    last = ts;
    fit();
    if (!S.paused) Object.values(S.actors).forEach(a => a.update(dt));
    else S.bubbles.forEach(b => { b.from += dt * 1000; b.until += dt * 1000; });   // speech waits too

    const W = canvas.width, H = canvas.height, st = S.stage || {};
    if (bg)                   g.drawImage(bg, 0, 0, W, H);
    else if (PAINT[st.paint]) PAINT[st.paint](g, W, H, ts);
    else                      drawFloor(W, H);
    emit("back", g, W, H, dt);                 // props behind the actors (a bench, a counter)

    Object.values(S.actors).sort((p, q) => p.y - q.y).forEach(a => a.draw(g, W, H));

    S.bubbles = S.bubbles.filter(b => b.until > ts);
    S.bubbles.forEach(b => bubble(b, W, H, ts));

    emit("draw", g, W, H, dt);

    if (S.fade > 0) { g.fillStyle = `rgba(8,4,16,${S.fade})`; g.fillRect(0, 0, W, H); }
    requestAnimationFrame(tick);
  }


  // ===================================================================
  //  STAGES
  // ===================================================================

  async function setStage(st) {
    if (typeof st === "string") st = S.stages[st] || (console.warn("vb_af: no stage", st), {});
    S.stage = st;
    bg = st.bg ? await load(st.bg).catch(() => null) : null;
  }

  // Fade to black, swap the stage, place actors while it is dark, fade back in.
  // place: { a: .3, b: null }   null hides that actor
  async function changeStage(name, place, secs = .45) {
    const fade = async to => {
      const from = S.fade;
      let done = 0, t = performance.now();
      while (true) {
        const k = Math.min(1, done / (secs * 1000));
        S.fade = from + (to - from) * k;
        if (k >= 1) break;
        await sleep(16);
        const n = performance.now();
        if (!S.paused) done += n - t;          // the fade waits while paused
        t = n;
      }
    };
    await fade(1);
    await setStage(name);
    if (place) for (const [id, v] of Object.entries(place)) {
      const a = actor(id);
      if (!a) continue;
      if (v === null) a.hidden = true;
      else { a.hidden = false; a.x = v; }
    }
    emit("stage", name);
    await fade(0);
  }

  // Painted stages, so a scene works before any background art exists
  const PAINT = {

    night(g, W, H, ts) {
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, "#140d2a");
      gr.addColorStop(.75, "#3a2560");
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);

      g.fillStyle = "#fff6";                                        // stars
      for (let i = 0; i < 40; i++) {
        const x = (i * 97 % 101) / 101 * W, y = (i * 53 % 61) / 61 * H * .45;
        g.fillRect(x, y, 2, 2);
      }

      const bw = W / 9;                                             // buildings with lit windows
      for (let i = 0; i < 9; i++) {
        const h = H * (.28 + ((i * 37) % 7) / 20);
        g.fillStyle = "#1b1233";
        g.fillRect(i * bw, H * .78 - h, bw - 4, h);
        g.fillStyle = "#ffcf6e";
        for (let w = 0; w < 6; w++) if ((i + w * 3) % 4)
          g.fillRect(i * bw + 8 + (w % 2) * bw * .45, H * .78 - h + 14 + Math.floor(w / 2) * 22, bw * .2, 8);
      }

      g.fillStyle = "#2b1c45";   g.fillRect(0, H * .78, W, H * .22);   // street
      g.fillStyle = "#ff168d55"; g.fillRect(0, H * .78, W, 3);         // neon line
    },

    day(g, W, H, ts) {
      const gr = g.createLinearGradient(0, 0, 0, H);
      gr.addColorStop(0, "#8fd3ff");
      gr.addColorStop(.75, "#d9f2ff");
      g.fillStyle = gr;
      g.fillRect(0, 0, W, H);

      g.fillStyle = "#fff6b0";                                      // sun
      g.beginPath(); g.arc(W * .82, H * .18, H * .08, 0, 7); g.fill();

      g.fillStyle = "#fffc";                                        // clouds
      for (const [cx, cy, r] of [[.18, .16, .05], [.24, .14, .06], [.3, .17, .045], [.6, .1, .04], [.65, .08, .05]]) {
        g.beginPath(); g.arc(W * cx, H * cy, H * r, 0, 7); g.fill();
      }

      for (let i = 0; i < 7; i++) {                                 // trees
        const x = W * (i + .5) / 7, h = H * (.18 + (i % 3) * .04);
        g.fillStyle = "#6b4a2b";
        g.fillRect(x - 5, H * .78 - h * .5, 10, h * .5);
        g.fillStyle = i % 2 ? "#4fae5a" : "#5cc06a";
        g.beginPath(); g.arc(x, H * .78 - h * .55, h * .38, 0, 7); g.fill();
      }

      g.fillStyle = "#7fcf6b"; g.fillRect(0, H * .78, W, H * .22);     // grass
      g.fillStyle = "#e9d8a6"; g.fillRect(0, H * .86, W, H * .05);     // path
    },
  };

  // A plain stage from colors: [sky top, sky bottom, floor]
  function drawFloor(W, H) {
    const c = (S.stage && S.stage.colors) || ["#1d1530", "#3a2560", "#2b1c45"];
    const gr = g.createLinearGradient(0, 0, 0, H);
    gr.addColorStop(0, c[0]);
    gr.addColorStop(.7, c[1]);
    g.fillStyle = gr;
    g.fillRect(0, 0, W, H);
    g.fillStyle = c[2];
    g.fillRect(0, H * .78, W, H * .22);
  }


  // ===================================================================
  //  SPEECH WINDOWS
  //  Rounded box over the speaker, tail pointing at them, name tag in
  //  their colour, text typed in at about 35 letters a second.
  // ===================================================================

  // Break text into lines no wider than maxW
  function wrap(text, maxW) {
    const out = [];
    let line = "";
    for (const w of text.split(" ")) {
      const t = line ? line + " " + w : w;
      if (g.measureText(t).width > maxW && line) { out.push(line); line = w; }
      else line = t;
    }
    return line ? out.concat(line) : out;
  }

  function bubble(b, W, H, ts) {
    const a = S.actors[b.who];
    if (!a) return;

    // sizes come from the window height, so it reads the same at any size
    const fs = Math.round(H * .042), pad = fs * .75, r = fs * .55, col = a.color || "#ff168d";
    const shown = b.text.slice(0, Math.max(1, Math.floor((ts - b.from) / 28)));

    g.font = `600 ${fs}px sans-serif`;
    const lines = wrap(b.text, W * .34);
    const tw = Math.max(...lines.map(l => g.measureText(l).width));
    const bw = tw + pad * 2, bh = lines.length * fs * 1.3 + pad * 1.6;

    // above the head, kept inside the window
    const hx = a.x * W, top = a.y * H - a.h * H * (1 - (a.headroom || 0));   // headroom: empty space above the head
    const x = Math.min(W - bw - 10, Math.max(10, hx - bw / 2));
    const y = Math.max(fs * 1.6, top - bh - fs * .9);

    // pop in
    const pop = Math.min(1, (ts - b.from) / 140);
    g.save();
    g.globalAlpha = pop;
    g.translate(hx, y + bh);
    g.scale(.9 + .1 * pop, .9 + .1 * pop);
    g.translate(-hx, -(y + bh));

    // shadow
    g.fillStyle = "rgba(20,10,35,.35)";
    g.beginPath(); g.roundRect(x + 3, y + 4, bw, bh, r); g.fill();

    // box and tail
    g.fillStyle = "#fff8ee";
    g.strokeStyle = "#2a1d3d";
    g.lineWidth = Math.max(2, fs * .1);
    const tx = Math.min(x + bw - r * 2, Math.max(x + r * 2, hx));
    g.beginPath(); g.roundRect(x, y, bw, bh, r); g.fill(); g.stroke();
    g.beginPath();
    g.moveTo(tx - fs * .45, y + bh - 1);
    g.lineTo(hx, y + bh + fs * .75);
    g.lineTo(tx + fs * .45, y + bh - 1);
    g.closePath(); g.fill(); g.stroke();
    g.fillRect(tx - fs * .45 + 2, y + bh - g.lineWidth - 1, fs * .9 - 4, g.lineWidth + 2);   // hide the seam

    // name tag
    if (a.name) {
      const nf = Math.round(fs * .7);
      g.font = `700 ${nf}px sans-serif`;
      const nw = g.measureText(a.name).width + nf;
      g.fillStyle = col;
      g.beginPath(); g.roundRect(x + pad * .6, y - nf * .8, nw, nf * 1.45, nf * .7); g.fill();
      g.fillStyle = "#fff";
      g.textBaseline = "middle";
      g.fillText(a.name, x + pad * .6 + nf / 2, y - nf * .8 + nf * .74);
      g.font = `600 ${fs}px sans-serif`;
    }

    // the text, typed in
    g.fillStyle = "#2a1d3d";
    g.textBaseline = "top";
    let left = shown.length;
    lines.forEach((l, i) => {
      const part = l.slice(0, Math.max(0, left));
      left -= l.length + 1;
      g.fillText(part, x + pad, y + pad * .9 + i * fs * 1.3);
    });
    g.restore();
  }

  // Show a speech window (one at a time). Longer text stays up longer.
  const say = (who, text, secs) => {
    const now = performance.now();
    secs = secs || Math.max(2.2, 1 + text.length * .06);
    (S.bubbles = []).push({ who, text, from: now, until: now + secs * 1000 });
  };


  // ===================================================================
  //  STEPS
  //  { a: "wave", b: "jump", loops: 2, hold: 1, move: { a: .7 }, secs: 1,
  //    say: ["a", "Hi"], wait: .5, flip: { a: true }, show, hide,
  //    stage, place, fadeSecs, sound: "pop.ogg", emit: "name",
  //    idle: { a: "sit" } }   what the actor goes back to between moves (sitting, facing front)
  //  Everything in a step starts together. The step ends when all of it is done.
  // ===================================================================

  async function step(st) {
    const jobs = [], secs = st.secs || 1;

    if (st.stage) await changeStage(st.stage, st.place, st.fadeSecs);

    if (st.show) for (const [id, x] of Object.entries(st.show)) {
      const a = actor(id);
      if (!a) continue;
      a.hidden = false;
      if (typeof x === "number") a.x = x;
    }
    if (st.hide) for (const id of [].concat(st.hide)) { const a = actor(id); if (a) a.hidden = true; }
    if (st.flip) for (const [id, v] of Object.entries(st.flip)) { const a = actor(id); if (a) a.face(v); }
    if (st.idle) for (const [id, v] of Object.entries(st.idle)) {     // new resting animation
      const a = actor(id);
      if (!a) continue;
      a.idle = v;
      if (!st[id] && !(st.move && id in st.move)) a.play(v);         // nothing else to play first: switch now
    }
    if (st.say)  say(st.say[0], st.say[1], st.sayFor);

    // A move target is a stage x (0 to 1), or { to: "b", gap: 140 } to stand
    // beside another actor. gap is in sprite pixels between their feet, so it
    // holds at any window size. The mover stays on the side it is already on.
    const where = (a, x) => {
      if (typeof x === "number") return x;
      const o    = actor(x.to);
      if (!o) return a.x;
      const side = x.side || (a.x <= o.x ? -1 : 1);
      const f    = a.cur || Object.values(a.anims)[0];
      return o.x + side * (x.gap ?? 140) * (a.h * canvas.height / f.fh) / canvas.width;
    };

    // A move walks there (if the actor has a walk), turning to face the way
    // it goes. Give a looping animation to move with it instead, like
    // { move: { a: .9 }, a: "run" }. Give a one shot one (like a shove's
    // "surprised") and the actor slides while it plays, without turning.
    const gaits = new Set();
    if (st.move) for (const [id, x0] of Object.entries(st.move)) {
      const a = actor(id);
      if (!a) continue;
      const x = where(a, x0);
      const named = st[id], sheet = named && a.pick(named);
      const gait = named ? (sheet && sheet[0].loop && named !== a.idle && named) : (a.has("walk") && "walk");
      if (gait) {
        gaits.add(id);
        if (x !== a.x) a.face(x < a.x);
        a.play(gait);
        jobs.push(a.moveTo(x, secs).then(() => { a.play(a.idle); }));
      } else {
        jobs.push(a.moveTo(x, secs));
      }
    }

    // Animations named in the step, like { a: "hug" }. idle never holds a step up.
    for (const id of Object.keys(S.actors)) if (st[id] && !gaits.has(id)) {
      const a = S.actors[id], p = a.play(st[id], st.loops || 1, st.hold || 0);
      if (st[id] !== a.idle) jobs.push(p);
    }

    if (st.emit)  emit(st.emit, st);
    if (st.sound) { const s = new Audio(st.sound); s.volume = S.vol; s.play().catch(() => {}); }

    await Promise.all(jobs);
    if (st.wait) await wait(st.wait * 1000);
    while (S.paused && !S.stop) await sleep(100);
  }

  // Play a whole scene: a list of steps, or { steps: [...] }
  async function run(act) {
    if (Array.isArray(act)) act = { steps: act };
    if (S.busy) return false;
    S.busy = true;
    S.stop = false;
    emit("act", act);
    let broke = null;
    try {
      for (const st of act.steps) {
        if (S.stop) break;
        await step(st);
      }
    } catch (err) {
      broke = err;                               // a bad step: report it, never leave the window stuck
      console.error("vb_af: scene stopped", err);
    } finally {
      Object.values(S.actors).forEach(a => a.play(a.idle));
      S.busy = false;
    }
    emit("end", act, !S.stop && !broke);
    return !broke;
  }

  const halt = () => { S.stop = true; S.bubbles = []; };

  // Back to how the scene starts: first stage, everyone home, standing, facing
  // their first way. Used after a scene is stopped halfway (Esc).
  async function reset(secs = .3) {
    const place = {};
    for (const [id, def] of Object.entries(S.scene.actors)) place[id] = def.hidden ? null : (def.x ?? .3);
    await changeStage(typeof S.scene.stage === "string" ? S.scene.stage : (S.scene.stage || {}), place, secs);
    for (const [id, def] of Object.entries(S.scene.actors)) {
      const a = S.actors[id];
      a.tw = null;
      a.idle = def.idle || "idle";
      a.face(!!def.flip);
      a.play(a.idle);
    }
  }


  return { start, run, halt, reset, on, say, step, changeStage, state: S, Actor, wrap: (t, w) => wrap(t, w), ctx: () => g };
})();
