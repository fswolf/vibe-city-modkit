// =====================================================================
//  vn.js : the visual novel engine (vb-visual)
//
//  Sits on top of af.js. af.js moves and draws the actors, this file
//  reads your story and runs the novel around it:
//    - the text box (name tag, text typed in, click to read on)
//    - choices, flags, if / goto, endings
//    - saving at every line, Continue, the title screen
//    - Auto, Log, Pause, Menu
//    - where the choice buttons sit, a Scenes menu, an adults-only gate
//  Your story lives in actors.js (who) and story.js (what happens).
//  You never need to change this file to write a new novel.
//
//  Optional settings on SCRIPT (actors.js or story.js):
//    SCRIPT.choices = { at: "middle", layout: "column" }
//        at: "top" "middle" "bottom" "left" "right", or { x: .5, y: .4 }
//        layout: "column" (stacked) "row" (side by side) "grid" (two wide)
//        A choice line can override both: { choice: [...], at: "bottom", layout: "row" }
//    SCRIPT.gallery = [ { name: "The fountain", label: "moment", until: "ending",
//                         stage: "park", place: { a: .3, b: .7 }, flags: { trust: 2 },
//                         image: "bg/fountain.png" } ]
//        A Scenes button on the title screen. A scene unlocks once the player
//        reaches its label. It replays from label and stops at until (or an end),
//        without touching the player's save. SCRIPT.galleryOpen = true unlocks all.
//    SCRIPT.ageGate = "This story is for adults."   asks once, remembered
//    SCRIPT.startLine = 3   start the first label at its fourth line (used by the studio)
// =====================================================================

const VN = (() => {

  // ===================================================================
  //  SETUP
  // ===================================================================

  const $    = id => document.getElementById(id);
  const send = m  => { try { parent !== window && parent.postMessage(m, "*"); } catch {} };   // talk to the game

  // Keys a story line can have that this file handles. Anything else
  // (move, flip, show, hide, stage, sound, actor animations...) goes to af.js.
  const OWN = new Set(["say", "tag", "text", "choice", "set", "add", "if", "goto", "else", "end", "note", "at", "layout"]);

  const V = {
    label: null,   // the label being read
    i:     0,      // the line in it
    flags: {},     // trust, fun, met...
    stage: null,   // the stage name showing
    log:   [],     // lines read so far, for the Log
    auto:  false,  // Auto read on
    replay: null,  // the Scenes entry being replayed, or null
    run:   0,      // bumps on every restart, so an old run stops
    seq:   0,      // bumps on every line, so an old Auto timer does nothing
  };

  let data     = { save: null, endings: [], seen: [], adult: false };   // what the game keeps for us
  let input    = null;   // waiting for the player to read on
  let typing   = null;   // the line being typed
  let choosing = null;   // the choice buttons showing
  let endWait  = null;   // waiting on the end card
  const DEF    = {};     // where each actor starts a new story


  // ===================================================================
  //  READING THE SCRIPT
  // ===================================================================

  // An actor id from an id or a name ("a" or "Kit")
  const actorId = k => SCRIPT.actors[k] ? k
    : Object.keys(SCRIPT.actors).find(id => (SCRIPT.actors[id].name || "").toLowerCase() === k.toLowerCase());

  // Turn a short line into its long form:
  //   "Kit: Hi"  ->  { say: ["a", "Hi"] }
  //   "Narration"  ->  { text: "Narration" }
  function parse(line) {
    if (typeof line !== "string") return line || {};
    // names may have dots, accents and an aside: "Ms. Hazel: Hi", "Zoë: Hi", "Mew (letter): Hi"
    const m = line.match(/^([\p{L}\p{N}_ .'’-]{1,24}?)\s*(?:\(([^()]{1,24})\))?:\s+(.*)$/su);
    if (m) {
      const id = actorId(m[1].trim());
      if (id) return m[2] ? { say: [id, m[3]], tag: `${SCRIPT.actors[id].name || id} (${m[2].trim()})` } : { say: [id, m[3]] };
    }
    return { text: line };
  }

  // Check a condition: "trust >= 2", "met", "!met", or a function(flags)
  function test(c) {
    if (typeof c === "function") return !!c(V.flags);
    const m = String(c).trim().match(/^(!?)(\w+)\s*(?:(>=|<=|==|!=|>|<)\s*(-?[\w.]+))?$/);
    if (!m) { console.warn("vb-visual: cannot read if", c); return false; }
    const v = V.flags[m[2]] ?? 0;
    if (!m[3]) return m[1] ? !v : !!v;
    const r = m[4] === "true" ? true : m[4] === "false" ? false : isNaN(m[4]) ? (m[4] in V.flags ? V.flags[m[4]] : m[4]) : +m[4];
    return { ">=": v >= r, "<=": v <= r, "==": v == r, "!=": v != r, ">": v > r, "<": v < r }[m[3]];
  }

  // { set: {...} } and { add: {...} } on a line or a choice
  const applyFlags = o => {
    if (o.set) Object.assign(V.flags, o.set);
    if (o.add) for (const [k, n] of Object.entries(o.add)) V.flags[k] = (V.flags[k] || 0) + n;
  };

  // Every { end: "Name" } in the story, for "Endings found 1 of 3"
  const endingNames = () => [...new Set(Object.values(SCRIPT.labels).flat().map(parse)
    .filter(l => l.end != null).map(l => l.end))];

  // Everything needed to pick up from this exact line later
  const snapshot = () => ({
    label: V.label, i: V.i, flags: { ...V.flags }, stage: V.stage,
    actors: Object.fromEntries(Object.entries(AF.state.actors)
      .map(([id, a]) => [id, { x: a.x, hidden: !!a.hidden, flip: a.flip, idle: a.idle }])),
  });

  const store = () => send({ vc: "save", data });


  // ===================================================================
  //  THE TEXT BOX
  // ===================================================================

  // Show a line and wait until the player reads on. who = null for narration.
  function stopTyping() {
    if (typing) clearInterval(typing.timer);
    typing = input = null;
  }

  function say(who, text, tag) {
    stopTyping();
    const a = who && AF.state.actors[who], seq = ++V.seq;

    // name tag in the speaker's colour, or none for narration
    $("name").hidden = !a;
    if (a) {
      $("name").textContent = tag || a.name || who;
      $("name").style.background = a.color || "#ff168d";
    }
    $("box").classList.toggle("narr", !a);
    $("box").hidden = false;

    // darken everyone else
    if (SCRIPT.dimOthers !== false)
      for (const [id, x] of Object.entries(AF.state.actors)) x.dim = !!a && id !== who;

    V.log.push([a ? tag || a.name || who : "", text]);
    if (V.log.length > 300) V.log.shift();

    return new Promise(done => {
      const el = $("text");
      let n = 0;
      el.textContent = "";
      $("more").hidden = true;

      // the whole line showing, ready to read on (Auto reads on by itself)
      const finish = () => {
        clearInterval(timer);
        if (seq !== V.seq) return;   // an old line, the player has moved on
        typing = null;
        el.textContent = text;
        $("more").hidden = false;
        if (V.auto) setTimeout(() => { if (V.auto && seq === V.seq && input && !typing) advance(); }, 900 + text.length * 35);
      };

      // type it in a letter at a time
      const timer = setInterval(() => {
        if (AF.state.paused) return;
        el.textContent = text.slice(0, ++n);
        if (n >= text.length) finish();
      }, 1000 / (SCRIPT.textSpeed || 40));
      typing = { finish, timer };
      input = done;
    });
  }

  // Click, Space or Enter: finish the line being typed, or read on
  function advance() {
    if (AF.state.paused || !$("log").hidden || choosing) return;
    if (endWait) { const f = endWait; endWait = null; return f(); }
    if (typing)  return typing.finish();
    if (input)   { const f = input; input = null; f(); }
  }

  // Show choice buttons and wait for one. Options are ["Text", "label"]
  // or { text, goto, if, set, add }. Options whose if fails are left out.
  // Where the buttons sit: SCRIPT.choices, then the line's own at / layout
  const SPOTS = { top: [.5, .2], middle: [.5, .36], bottom: [.5, .6], left: [.27, .36], right: [.73, .36] };
  function place(box, line) {
    const d = SCRIPT.choices || {}, at = line.at ?? d.at ?? "middle", lay = line.layout ?? d.layout ?? "column";
    const [x, y] = typeof at === "object" && at ? [at.x ?? .5, at.y ?? .36] : SPOTS[at] || SPOTS.middle;
    box.style.left = x * 100 + "%";
    box.style.top = y * 100 + "%";
    // an absolute box only gets the room right of its left edge, so wide layouts get a set width
    const side = at === "left" || at === "right";
    box.style.minWidth = side ? "34%" : "";
    box.style.width = lay === "row" ? (side ? "44%" : "88%") : lay === "grid" ? (side ? "44%" : "70%") : "";
    box.className = lay === "row" || lay === "grid" ? lay : "";
  }

  function choose(opts, line = {}) {
    opts = opts.map(o => Array.isArray(o) ? { text: o[0], goto: o[1] } : o)
               .filter(o => o.if == null || test(o.if));
    if (!opts.length) { console.warn("vb-visual: every option of a choice is hidden", line); return Promise.resolve({}); }
    return new Promise(done => {
      const box = $("choices");
      box.innerHTML = "";
      place(box, line);
      box.hidden = false;
      choosing = opts.map((o, k) => {
        const b = document.createElement("button");
        b.innerHTML = `<b>${k + 1}</b>`;
        b.append(o.text);
        b.onclick = () => {
          if (AF.state.paused) return;
          box.hidden = true;
          choosing = null;
          V.log.push(["", "› " + o.text]);
          done(o);
        };
        box.appendChild(b);
        return b;
      });
    });
  }


  // ===================================================================
  //  RUNNING THE STORY
  // ===================================================================

  // Run one line. Returns a label to jump to, "end", or null to carry on.
  async function exec(L) {
    const snap = snapshot();   // taken before the line changes anything, so Continue replays it

    // if: with goto / else it branches, on its own it skips the line when false
    if (L.if != null) {
      const ok = test(L.if);
      if (L.goto || L.else) return ok ? L.goto || null : L.else || null;
      if (!ok) return null;
    }

    applyFlags(L);

    // hand the af.js part of the line (move, animations, stage...) to af.js
    const rest = {};
    let any = false;
    for (const k in L) if (!OWN.has(k)) { rest[k] = L[k]; any = true; }
    let job = null;
    if (any) {
      if (rest.stage) { V.stage = rest.stage; $("box").hidden = true; }
      job = AF.step(rest);
      // a stage change, or a line with no words, finishes before going on.
      // otherwise the words show while it plays.
      if (rest.stage || !(L.say || L.text)) { await job; job = null; }
    }

    if (L.say || L.text) {
      if (!V.replay) { data.save = snap; store(); }
      await say(L.say ? L.say[0] : null, L.say ? L.say[1] : L.text, L.tag);
    }
    if (job) await job;

    if (L.choice) {
      if (!V.replay) { data.save = snap; store(); }
      const o = await choose(L.choice, L);
      applyFlags(o);
      if (o.goto) return o.goto;
    }

    if (L.end != null) { await ending(L.end); return "end"; }
    return L.goto || null;
  }

  // Read a label from line i. Running off the end carries on into the next label.
  async function go(label, i = 0) {
    const run = ++V.run, names = Object.keys(SCRIPT.labels);
    while (run === V.run) {
      const list = SCRIPT.labels[label];
      if (!list) { console.warn("vb-visual: no label", label); return title(); }
      if (i >= list.length) {
        const nx = names[names.indexOf(label) + 1];
        if (!nx) return ending("");
        label = nx; i = 0;
        continue;
      }
      if (i === 0 || V.label !== label) {
        if (V.replay && V.replay.until && label === V.replay.until) return ending("");
        if (!data.seen.includes(label)) { data.seen.push(label); if (!V.replay) store(); }
      }
      V.label = label;
      V.i = i;
      const r = await exec(parse(list[i++]));
      if (run !== V.run || r === "end") return;
      if (r) { label = r; i = 0; }
    }
  }

  // The end card. Remembers the ending, clears the save, back to the title.
  async function ending(name) {
    $("box").hidden = true;
    $("bar").hidden = true;
    if (V.replay) { V.replay = null; ++V.run; return gallery(); }
    if (name && !data.endings.includes(name)) data.endings.push(name);
    data.save = null;
    store();
    $("endname").textContent = name || "";
    $("endcard").hidden = false;
    await new Promise(r => (endWait = r));
    $("endcard").hidden = true;
    title();
  }

  // Reset everything and put the stage and actors where a save (or a new story) says
  async function setup(s) {
    ++V.run;
    stopTyping();
    choosing = endWait = null;
    $("choices").hidden = true;
    $("box").hidden = true;
    V.flags = { ...(s.flags || {}) };
    V.stage = s.stage;
    V.log   = [];
    V.auto  = false;
    V.replay = null;
    $("autobtn").classList.remove("on");
    $("title").hidden = true;
    $("bar").hidden = false;

    const place = Object.fromEntries(Object.entries(s.actors).map(([id, p]) => [id, p.hidden ? null : p.x]));
    await AF.changeStage(s.stage, place, .35);
    for (const [id, p] of Object.entries(s.actors)) {
      const a = AF.state.actors[id];
      if (a) { a.face(p.flip); a.dim = false; a.idle = p.idle || SCRIPT.actors[id].idle || "idle"; a.play(a.idle); }
    }
  }

  async function newStory() {
    await setup({ flags: SCRIPT.flags || {}, stage: SCRIPT.stage, actors: DEF });
    go(SCRIPT.start || Object.keys(SCRIPT.labels)[0], SCRIPT.startLine || 0);
  }

  // Replay one Scenes entry from its label, with its own stage, places and flags
  async function replay(g) {
    const actors = {};
    for (const [id, d] of Object.entries(DEF)) {
      const x = g.place && id in g.place ? g.place[id] : d.hidden ? null : d.x;
      actors[id] = { x: x ?? d.x, hidden: x == null, flip: d.flip };
    }
    $("gallery").hidden = true;
    await setup({ flags: { ...(SCRIPT.flags || {}), ...(g.flags || {}) }, stage: g.stage || SCRIPT.stage, actors });
    V.replay = g;
    go(g.label);
  }

  async function cont() {
    const s = data.save;
    if (!s) return;
    await setup(s);
    go(s.label, s.i);
  }


  // ===================================================================
  //  SCREENS
  // ===================================================================

  function title() {
    ++V.run;
    stopTyping();
    $("box").hidden = true;
    $("bar").hidden = true;
    $("choices").hidden = true;
    choosing = null;
    Object.values(AF.state.actors).forEach(a => (a.dim = false));

    $("tname").textContent = SCRIPT.title;
    $("tsub").textContent  = SCRIPT.subtitle || "";
    $("contbtn").disabled  = !data.save;
    $("scenesbtn").hidden  = !(SCRIPT.gallery && SCRIPT.gallery.length);
    $("gallery").hidden    = true;
    const all = endingNames();
    $("tend").textContent = all.length
      ? `Endings found ${data.endings.filter(e => all.includes(e)).length} of ${all.length}` : "";
    $("title").hidden = false;
  }

  const unlocked = g => SCRIPT.galleryOpen || data.seen.includes(g.label);

  function gallery() {
    ++V.run;
    $("title").hidden = true; $("box").hidden = true; $("bar").hidden = true; $("choices").hidden = true;
    const list = $("glist"), all = SCRIPT.gallery || [];
    list.innerHTML = "";
    for (const g of all) {
      const open = unlocked(g), b = document.createElement("button");
      const pic = open && g.image ? Object.assign(document.createElement("img"), { src: g.image, alt: "" })
        : Object.assign(document.createElement("div"), { className: "ph", textContent: open ? "\u25B6" : "?" });
      const name = document.createElement("span");
      name.textContent = open ? g.name || g.label : "Locked";
      b.append(pic, name);
      if (open) b.onclick = () => replay(g); else b.className = "lock";
      list.appendChild(b);
    }
    $("gcount").textContent = `${all.filter(unlocked).length} of ${all.length} unlocked`;
    $("gallery").hidden = false;
  }

  function gate() {
    if (!SCRIPT.ageGate || data.adult) return false;
    $("title").hidden = true;
    $("gatetext").textContent = typeof SCRIPT.ageGate === "string" ? SCRIPT.ageGate : "This story is for adults only.";
    $("gate").hidden = false;
    return true;
  }

  function showLog(on) {
    $("log").hidden = !on;
    if (!on) return;
    const list = $("loglist");
    list.innerHTML = "";
    for (const [who, t] of V.log) {
      const p = document.createElement("p");
      if (who) { const b = document.createElement("b"); b.textContent = who; p.append(b, " "); }
      p.append(t);
      list.appendChild(p);
    }
    list.scrollTop = list.scrollHeight;
  }

  const pause = p => {
    AF.state.paused = p;
    $("paused").hidden = !p;
    $("pausebtn").textContent = p ? "Resume" : "Pause";
  };


  // ===================================================================
  //  START UP: buttons, keys, the game's messages
  // ===================================================================

  function boot() {
    for (const [id, d] of Object.entries(SCRIPT.actors)) DEF[id] = { x: d.x ?? .5, hidden: !!d.hidden, flip: !!d.flip };
    document.title = SCRIPT.title;

    // buttons
    $("box").onclick     = advance;
    $("stage").onclick   = advance;
    $("endcard").onclick = advance;
    $("newbtn").onclick  = newStory;
    $("contbtn").onclick = cont;
    $("scenesbtn").onclick = gallery;
    $("gback").onclick   = title;
    $("gateyes").onclick = () => { data.adult = true; store(); $("gate").hidden = true; title(); };
    $("gateno").onclick  = () => send({ vc: "close" });
    $("autobtn").onclick = e => {
      e.stopPropagation();
      V.auto = !V.auto;
      $("autobtn").classList.toggle("on", V.auto);
      if (V.auto && input && !typing) advance();
    };
    $("logbtn").onclick   = e => { e.stopPropagation(); showLog(true); };
    $("log").onclick      = () => showLog(false);
    $("menubtn").onclick  = e => { e.stopPropagation(); title(); };
    $("pausebtn").onclick = e => { e.stopPropagation(); pause(!AF.state.paused); };
    $("paused").onclick   = () => pause(false);
    if (SCRIPT.pauseOnBlur) addEventListener("blur", () => pause(true));

    // keys
    addEventListener("keydown", e => {
      if (e.repeat) return;
      if (e.key === "Escape") {
        e.preventDefault();
        if (!$("log").hidden) showLog(false);
        else if (!$("gallery").hidden) title();
        else send({ vc: "close" });
        return;
      }
      if (!$("gate").hidden || !$("gallery").hidden) return;
      if (!$("title").hidden) { if (e.key === "Enter") (data.save ? cont : newStory)(); return; }
      if (e.key === "p" || e.key === "P") return pause(!AF.state.paused);
      if (e.key === "l" || e.key === "L") return showLog($("log").hidden);
      if (e.key === "a" || e.key === "A") return $("autobtn").click();
      const n = parseInt(e.key);
      if (choosing && n >= 1 && n <= choosing.length) return choosing[n - 1].click();
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); advance(); }
    });

    // the game sends our save and its volume when the window opens
    addEventListener("message", e => {
      const d = e.data || {};
      if (d.vc === "init") {
        if (d.data && typeof d.data === "object")
          data = { save: d.data.save || null, endings: d.data.endings || [], seen: d.data.seen || [], adult: !!d.data.adult };
        if (d.settings) AF.state.vol = d.settings.volume ?? 1;
        if (!$("gate").hidden && data.adult) { $("gate").hidden = true; title(); }
        else if (!$("title").hidden && !gate()) title();
      }
    });

    AF.start(SCRIPT, $("stage"))
      .then(() => { if (!gate()) title(); send({ vc: "ready" }); })
      .catch(err => { $("tsub").textContent = "Could not load: " + err.message; console.error(err); });
  }

  boot();
  return { state: V, go, test, say, gallery, replay, data: () => data };
})();
