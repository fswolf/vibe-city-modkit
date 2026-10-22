// =====================================================================
//  stage.js : the scene player. You should not need to change this.
//  Reads CAST (cast.js) and SCENES (scenes.js).
// =====================================================================

const STAGE = (() => {
  const $ = id => document.getElementById(id);
  const send = m => { try { parent !== window && parent.postMessage(m, "*"); } catch {} };
  const sleep = s => new Promise(r => setTimeout(r, s * 1000));
  const ease = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  const D = Math.PI / 180;

  let cur = 0, busy = false, run = 0, data = {};
  const actors = {};   // id -> { el, img, x, flip, pose, s, alpha, fx: {dx,dy,sx,sy,rot} }

  // ---------------- MOVES: p goes 0 to 1. Return offsets (H = window height, W = width)
  const MOVES = {
    hop:     (p, a, H) => ({ dy: -Math.sin(Math.PI * p) * H * .1 }),
    jump:    (p, a, H) => ({ dy: -Math.sin(Math.PI * p) * H * .22, sy: p < .12 || p > .88 ? .9 : 1.04 }),
    bounce:  (p, a, H) => ({ dy: -Math.abs(Math.sin(Math.PI * 2 * p)) * H * .05, sy: 1 - Math.abs(Math.cos(Math.PI * 2 * p)) * .06 }),
    shake:   (p, a, H, W) => ({ dx: Math.sin(p * Math.PI * 10) * (1 - p) * W * .018 }),
    tremble: (p, a, H, W) => ({ dx: (Math.random() - .5) * W * .008, dy: (Math.random() - .5) * H * .004 }),
    nod:     p => ({ rot: Math.sin(p * Math.PI * 4) * (1 - p) * 7 }),
    wiggle:  p => ({ rot: Math.sin(p * Math.PI * 6) * 9 }),
    lean:    (p, a) => ({ rot: Math.sin(Math.PI * p) * 9 * (a.flip ? -1 : 1) }),
    dance:   (p, a, H) => ({ rot: Math.sin(p * Math.PI * 8) * 10, dy: -Math.abs(Math.sin(p * Math.PI * 8)) * H * .04 }),
    float:   (p, a, H) => ({ dy: -Math.sin(Math.PI * p) * H * .07, rot: Math.sin(p * Math.PI * 2) * 3 }),
    sink:    p => ({ sy: 1 - Math.sin(Math.PI * Math.min(1, p * 1.6)) * .15, sx: 1 + Math.sin(Math.PI * Math.min(1, p * 1.6)) * .05 }),
    spin:    p => ({ sx: Math.cos(Math.PI * 2 * ease(p)) }),
    turn:    (p, a) => { if (p >= 1) a.flip = !a.flip; return { sx: Math.abs(Math.cos(Math.PI * ease(p))) || .02 }; },
    grow:    (p, a) => { a.s = a.s0 + (1.12 - a.s0) * ease(p); return {}; },
    shrink:  (p, a) => { a.s = a.s0 + (1 - a.s0) * ease(p); return {}; },
    fadeout: (p, a) => { a.alpha = a.a0 * (1 - p); return {}; },
    fadein:  (p, a) => { a.alpha = a.a0 + (1 - a.a0) * p; return {}; },
    walk:    (p, a, H) => { a.x = a.x0 + (a.to - a.x0) * p; return { dy: -Math.abs(Math.sin(p * Math.PI * 6)) * H * .02, rot: Math.sin(p * Math.PI * 6) * 2 }; },
    slide:   (p, a) => { a.x = a.x0 + (a.to - a.x0) * ease(p); return {}; },
  };
  const SECS = { hop: .45, jump: .7, bounce: .7, shake: .6, tremble: .8, nod: .7, wiggle: 1, lean: .9, dance: 1.6, float: 1, sink: 1,
    spin: .7, turn: .4, grow: .5, shrink: .4, fadeout: .7, fadein: .7, walk: 1, slide: .6 };

  // ---------------- FX: little symbols that float up, or rain over the whole stage
  const FX = { hearts: ["♥", "#ff6fa0"], sparkles: ["✦", "#ffe27a"], notes: ["♪", "#9be3ff"], sweat: ["💧", null], tears: ["💧", null],
    stars: ["★", "#ffe27a"], zzz: ["z", "#d8ccff"] };
  function fx(spec, firstActor) {
    const o = typeof spec === "string" ? { kind: spec } : spec, kind = o.kind || "sparkles", at = o.at || firstActor;
    const box = $("fx"), W = box.clientWidth, H = box.clientHeight;
    if (kind === "rain") {
      for (let i = 0; i < 80; i++) { const d = document.createElement("i"); d.className = "drop";
        d.style.left = Math.random() * 100 + "%"; d.style.animationDelay = Math.random() * 1.2 + "s"; box.appendChild(d); setTimeout(() => d.remove(), 2600); }
      return;
    }
    const a = actors[at], [ch, col] = FX[kind] || FX.sparkles;
    const x = a ? a.x * W : W / 2, y = a ? H * .92 - a.img.clientHeight * a.s * .9 : H * .3;
    for (let i = 0; i < 7; i++) { const s = document.createElement("span"); s.className = "fx"; s.textContent = ch;
      if (col) s.style.color = col;
      s.style.left = x + (Math.random() - .5) * 140 + "px"; s.style.top = y + (Math.random() - .5) * 50 + "px";
      s.style.fontSize = 22 + Math.random() * 22 + "px"; s.style.animationDelay = i * .12 + "s"; box.appendChild(s); setTimeout(() => s.remove(), 2400); }
  }

  // ---------------- drawing the actors every frame
  function draw() {
    const H = $("stage").clientHeight;
    for (const a of Object.values(actors)) {
      const f = a.fx || {};
      a.el.style.left = a.x * 100 + "%";
      a.el.style.opacity = a.alpha;
      a.img.style.height = CAST[a.id].h * H + "px";
      a.el.style.transform = `translate(-50%,0) translate(${f.dx || 0}px,${f.dy || 0}px) rotate(${f.rot || 0}deg) ` +
        `scale(${(a.flip ? -1 : 1) * a.s * (f.sx ?? 1)},${a.s * (f.sy ?? 1)})`;
    }
    requestAnimationFrame(draw);
  }

  // play one move on one actor
  function play(a, move, secs) {
    const fn = MOVES[move]; if (!fn) { console.warn("kitties: no move", move); return Promise.resolve(); }
    const dur = (secs || SECS[move] || .7) * 1000, t0 = performance.now(), r = run;
    a.x0 = a.x; a.s0 = a.s; a.a0 = a.alpha;
    return new Promise(done => {
      const tick = () => {
        if (r !== run) return done();
        const p = Math.min(1, (performance.now() - t0) / dur), H = $("stage").clientHeight, W = $("stage").clientWidth;
        a.fx = fn(p, a, H, W) || {};
        if (p < 1) requestAnimationFrame(tick); else { a.fx = {}; done(); }
      };
      tick();
    });
  }

  function setPose(a, pose) {
    const src = CAST[a.id].poses[pose];
    if (!src) return console.warn("kitties: no pose", a.id, pose);
    a.pose = pose; a.img.src = src;
  }

  // ---------------- the text box
  let skip = null;
  function say(line, wait) {
    const m = typeof line === "string" && line.match(/^([\p{L}\p{N}_ .'-]{1,24}):\s+(.*)$/su);
    const id = m && Object.keys(CAST).find(k => k === m[1].trim().toLowerCase() || CAST[k].name.toLowerCase() === m[1].trim().toLowerCase());
    const text = id ? m[2] : line, c = id && CAST[id];
    $("name").hidden = !c; if (c) { $("name").textContent = c.name; $("name").style.background = c.color; }
    $("box").classList.toggle("narr", !c); $("box").hidden = false; $("more").hidden = true;
    for (const a of Object.values(actors)) a.el.classList.toggle("dim", !!id && a.id !== id);
    const r = run;
    return new Promise(done => {
      let n = 0, typed = false;
      const el = $("text"); el.textContent = "";
      const finish = () => { clearInterval(tm); typed = true; el.textContent = text; $("more").hidden = !wait;
        if (!wait) setTimeout(() => { if (skip === next) { skip = null; done(); } }, 1100 + text.length * 25); };
      const next = () => { if (r !== run) return; if (!typed) return finish(); skip = null; done(); };
      const tm = setInterval(() => { if (r !== run) { clearInterval(tm); return done(); } el.textContent = text.slice(0, ++n); if (n >= text.length) finish(); }, 1000 / 45);
      skip = next;
    });
  }
  const hideBox = () => { $("box").hidden = true; for (const a of Object.values(actors)) a.el.classList.remove("dim"); };

  // ---------------- one step: everything in it at once
  async function step(st) {
    if (typeof st === "string") return say(st, true);
    const jobs = [];
    let first = null;
    for (const id of Object.keys(st)) {
      const a = actors[id]; if (!a) { if (CAST[id]) console.warn("kitties:", id, "is not in this scene"); continue; }
      first = first || id;
      const v = typeof st[id] === "string" ? { move: st[id] } : st[id];
      if (v.pose) setPose(a, v.pose);
      if (v.flip != null) a.flip = !!v.flip;
      if (v.move) {
        if (v.to != null) { a.to = v.to; if (v.move === "walk" && v.flip == null) a.flip = v.to < a.x; }
        jobs.push(play(a, v.move, v.secs || st.secs));
      }
    }
    if (st.fx) fx(st.fx, first);
    if (st.say) jobs.push(say(st.say, false));
    await Promise.all(jobs);
    if (st.wait) await sleep(st.wait);
  }

  // ---------------- scenes
  function build(i) {
    const sc = SCENES[i];
    $("bg").src = sc.bg;
    $("actors").innerHTML = "";
    for (const k of Object.keys(actors)) delete actors[k];
    for (const [id, pl] of Object.entries(sc.place || {})) {
      if (!CAST[id]) { console.warn("kitties: no actor", id, "in cast.js"); continue; }
      const el = document.createElement("div"), img = document.createElement("img");
      el.className = "actor"; img.alt = CAST[id].name; img.draggable = false; el.appendChild(img); $("actors").appendChild(el);
      const a = actors[id] = { id, el, img, x: pl.x ?? .5, flip: !!pl.flip, s: 1, alpha: 1, fx: {} };
      setPose(a, pl.pose || Object.keys(CAST[id].poses)[0]);
    }
    $("sname").textContent = sc.name;
    $("count").textContent = `Scene ${i + 1} of ${SCENES.length}`;
    $("prev").disabled = i === 0; $("next").disabled = i === SCENES.length - 1;
    $("dots").innerHTML = SCENES.map((s, k) => `<i class="${k === i ? "on" : ""}" title="${s.name}"></i>`).join("");
    [...$("dots").children].forEach((d, k) => d.onclick = () => go(k));
    $("btns").innerHTML = "";
    (sc.buttons || []).slice(0, 4).forEach((b, k) => {
      const el = document.createElement("button"); el.innerHTML = `<b>${k + 1}</b>`; el.append(b.label);
      el.disabled = busy; el.onclick = e => { e.stopPropagation(); playButton(b); }; $("btns").appendChild(el);
    });
  }

  async function go(i) {
    if (i < 0 || i >= SCENES.length) return;
    const r = ++run; busy = true; skip = null; setButtons(false);
    $("fade").classList.add("on"); await sleep(.35); if (r !== run) return;
    hideBox(); $("fx").innerHTML = ""; cur = i; build(i);
    data.scene = i; send({ vc: "save", data });
    await sleep(.1); $("fade").classList.remove("on"); await sleep(.3);
    for (const st of SCENES[i].intro || []) { if (r !== run) return; await step(st); }
    if (r !== run) return;
    hideBox(); busy = false; setButtons(true);
  }

  async function playButton(b) {
    if (busy) return;
    const r = run; busy = true; setButtons(false);
    for (const st of b.steps || []) { if (r !== run) return; await step(st); }
    if (r !== run) return;
    hideBox(); busy = false; setButtons(true);
  }
  const setButtons = on => { [...$("btns").children].forEach(b => b.disabled = !on); $("btns").classList.toggle("off", !on); };

  // ---------------- start
  function boot() {
    document.title = (typeof TITLE !== "undefined" && TITLE) || "Kitties Mew";
    const click = () => skip && skip();
    $("stage").onclick = click; $("box").onclick = click;
    $("prev").onclick = e => { e.stopPropagation(); go(cur - 1); };
    $("next").onclick = e => { e.stopPropagation(); go(cur + 1); };
    $("again").onclick = e => { e.stopPropagation(); go(cur); };
    addEventListener("keydown", e => {
      if (e.repeat) return;
      if (e.key === "Escape") return send({ vc: "close" });
      if (e.key === "ArrowLeft" || e.key === "Backspace") return go(cur - 1);
      if (e.key === "ArrowRight") return go(cur + 1);
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); return click(); }
      const n = +e.key; if (n >= 1 && n <= 4) { const b = $("btns").children[n - 1]; if (b && !b.disabled) b.click(); }
    });
    addEventListener("message", e => { const d = e.data || {};
      if (d.vc === "init" && d.data && typeof d.data === "object") { data = d.data; if (data.scene > 0 && data.scene < SCENES.length && data.scene !== cur) go(data.scene); } });
    // preload every picture so poses swap without a blink
    for (const sc of SCENES) new Image().src = sc.bg;
    for (const c of Object.values(CAST)) for (const p of Object.values(c.poses)) new Image().src = p;
    requestAnimationFrame(draw);
    go(0);
    send({ vc: "ready" });
  }
  boot();
  return { go, step, actors, MOVES, cur: () => cur };
})();
