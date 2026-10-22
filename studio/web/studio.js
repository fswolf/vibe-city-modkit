// =====================================================================
//  vc-novel-studio : edit a Vibe City visual novel's story.js
//  studio.py serves this page, the novel folder and the save button.
//  The story is held as plain data, one list of lines per scene (label),
//  exactly the shape story.js has, and written back out as tidy JS.
// =====================================================================

const $ = id => document.getElementById(id);
const el = (tag, props = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "style") e.style.cssText = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (k in e && typeof v !== "string") e[k] = v;
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) e.append(k);
  return e;
};
// replaceChildren that skips the null and false a ternary leaves behind
const put = (node, ...kids) => node.replaceChildren(...kids.flat().filter(k => k != null && k !== false));
const svgEl = (tag, attrs = {}, ...kids) => {
  const e = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) e.setAttribute(k, v);
  for (const k of kids) if (k != null) e.append(k);
  return e;
};
const ICON = {
  up: "m6 14 6-6 6 6", down: "m6 10 6 6 6-6", copy: "M8 8h11v11H8zM5 16V5h11",
  code: "m9 8-4 4 4 4M15 8l4 4-4 4", play: "M8 5v14l11-7z", del: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13", x: "M6 6l12 12M18 6 6 18",
};
const icon = (name, title, fn, cls = "") => el("button", { class: "ic sm " + cls, title, onclick: e => { e.stopPropagation(); fn(); } },
  svgEl("svg", { viewBox: "0 0 24 24" }, svgEl("path", { d: ICON[name], fill: name === "play" ? "currentColor" : "none" })));

// The server's key, from the address it opened us with. Kept for reloads in this tab.
const KEY = (() => {
  const k = new URLSearchParams(location.search).get("k");
  try { if (k) sessionStorage.setItem("vcns-key", k); return k || sessionStorage.getItem("vcns-key") || ""; } catch (e) { return k || ""; }
})();

const S = {
  novel: null,      // { dir, name, mod, engine, actors, story }
  script: null,     // SCRIPT as actors.js + story.js build it (cast, stages, flags)
  header: "",       // story.js text before SCRIPT.start, kept as written
  start: "",
  labels: [],       // [{ name, lines: [...] }]
  extra: {},        // choices, gallery, galleryOpen, ageGate: written after the labels
  cur: 0, sel: -1,
  consts: {},       // const HUG = 135, so gap: HUG stays HUG
  raw: new Set(),   // cards showing their code
  dirty: false, hist: [], fut: [], burst: null,
  tab: "preview", lastPlay: null, filter: "",
};
const EXTRA = ["choices", "gallery", "galleryOpen", "ageGate"];

const KINDS = {
  say: ["Line", "“"], narr: ["Narration", "¶"], choice: ["Choice", "⑂"], jump: ["Jump", "↪"],
  if: ["If", "?"], flags: ["Flags", "⚑"], stage: ["Stage", "▣"], action: ["Action", "✦"],
  end: ["End", "★"], note: ["Note", "✎"],
};


// ===================================================================
//  READING AND WRITING story.js
// ===================================================================

function constsOf(...texts) {
  const out = {};
  for (const t of texts) for (const m of t.matchAll(/^\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*(-?[\d.]+)\s*;/gm)) out[m[1]] = +m[2];
  return out;
}
const evalNovel = (actors, story) => new Function(`${actors}\n;\n${story}\n;\nreturn SCRIPT;`)();

// A JS value typed into a code box. The novel's numeric consts work in it.
function evalLit(txt) {
  const names = Object.keys(S.consts);
  return new Function(...names, `return (${txt}\n);`)(...names.map(n => S.consts[n]));
}

const clone = v => Array.isArray(v) ? v.map(clone)
  : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, clone(x)])) : v;

const ID = /^[A-Za-z_$][\w$]*$/;
const num = v => String(v).replace(/^(-?)0\./, "$1.");

function lit(v, ind = "", key = null) {
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number") {
    if (key === "gap") { const c = Object.entries(S.consts).find(([, x]) => x === v); if (c) return c[0]; }
    return num(v);
  }
  if (typeof v === "function") return v.toString();
  if (v === null || typeof v !== "object") return String(v);
  const inner = ind + "  ";
  if (Array.isArray(v)) {
    const parts = v.map(x => lit(x, inner));
    const one = "[" + parts.join(", ") + "]";
    if (one.length <= (key === "choice" ? 60 : 90) && !one.includes("\n")) return one;
    return "[\n" + parts.map(p => inner + p + ",").join("\n") + "\n" + ind + "]";
  }
  const parts = Object.entries(v).filter(([, x]) => x !== undefined)
    .map(([k, x]) => (ID.test(k) ? k : JSON.stringify(k)) + ": " + lit(x, inner, k));
  if (!parts.length) return "{}";
  const one = "{ " + parts.join(", ") + " }";
  if (one.length <= 100 && !one.includes("\n")) return one;
  return "{\n" + parts.map(p => inner + p + ",").join("\n") + "\n" + ind + "}";
}

function storyText() {
  const key = n => ID.test(n) ? n : JSON.stringify(n);
  const body = S.labels.map(L =>
    `  ${key(L.name)}: [\n` + L.lines.map(l => "    " + lit(l, "    ") + ",").join("\n") + (L.lines.length ? "\n" : "") + "  ],\n"
  ).join("\n");
  let tail = "";
  for (const k of EXTRA) if (S.extra[k] !== undefined && !(Array.isArray(S.extra[k]) && !S.extra[k].length))
    tail += `\nSCRIPT.${k} = ${lit(S.extra[k], "")};\n`;
  return `${S.header}SCRIPT.start = ${JSON.stringify(S.start)};\n\nSCRIPT.labels = {\n\n${body}\n};\n${tail}`;
}

function load(novel) {
  S.novel = novel;
  S.consts = constsOf(novel.actors, novel.story);
  S.script = evalNovel(novel.actors, novel.story);
  const at = novel.story.search(/^SCRIPT\.(start|labels)\s*=/m);
  S.header = at > 0 ? novel.story.slice(0, at).trimEnd() + "\n\n" : "";
  takeStory(S.script);
  S.cur = Math.max(0, S.labels.findIndex(L => L.name === S.start));
  S.sel = -1; S.hist = []; S.fut = []; S.raw.clear();
  setDirty(false, true);   // keep any draft: the recovery prompt is about to ask for it
}

function takeStory(sc) {
  S.start = sc.start || Object.keys(sc.labels || {})[0] || "start";
  S.labels = Object.entries(sc.labels || {}).map(([name, lines]) => ({ name, lines: lines.map(clone) }));
  S.extra = {};
  for (const k of EXTRA) if (sc[k] !== undefined) S.extra[k] = clone(sc[k]);
}


// ===================================================================
//  WHAT A LINE IS
// ===================================================================

const actorIds = () => Object.keys(S.script.actors || {});
const actorName = id => (S.script.actors[id] || {}).name || id;
const actorColor = id => (S.script.actors[id] || {}).color || "#d6a443";
const actorId = k => S.script.actors[k] ? k
  : actorIds().find(id => (S.script.actors[id].name || "").toLowerCase() === String(k).toLowerCase());
const stageNames = () => Object.keys(S.script.stages || {});

// "Kit: Hi", "Ms. Hazel: Hi", "Zoë: Hi", "Mew (letter): Hi"  ->  [id, text, aside]
const SPEAKER = /^([\p{L}\p{N}_ .'’-]{1,24}?)\s*(?:\(([^()]{1,24})\))?:\s+(.*)$/su;
function speakerOf(s) {
  const m = s.match(SPEAKER);
  const id = m && actorId(m[1].trim());
  return id ? [id, m[3], m[2] ? m[2].trim() : ""] : null;
}
const sayLine = (id, t, aside) => `${actorName(id)}${aside ? ` (${aside})` : ""}: ${t}`;

function kindOf(l) {
  if (typeof l === "string") return speakerOf(l) ? "say" : "narr";
  if (!l || typeof l !== "object" || Array.isArray(l)) return "action";
  const k = Object.keys(l), only = (...a) => k.every(x => a.includes(x));
  if (k.length === 1 && "note" in l) return "note";
  if ("choice" in l && only("choice", "at", "layout")) return "choice";
  if ("end" in l && only("end")) return "end";
  if ("goto" in l && only("goto")) return "jump";
  if ("if" in l && "goto" in l && only("if", "goto", "else")) return "if";
  if (("set" in l || "add" in l) && only("set", "add")) return "flags";
  if ("stage" in l && only("stage", "place", "fadeSecs")) return "stage";
  return "action";
}

function fmtFlags(o) {
  const out = [];
  for (const [k, n] of Object.entries(o.add || {})) out.push(k + (n < 0 ? "-" + -n : "+" + n));
  for (const [k, v] of Object.entries(o.set || {})) out.push(k + "=" + v);
  return out.join(" ");
}
function parseFlags(str) {
  const add = {}, set = {};
  for (const p of str.split(/[\s,]+/).filter(Boolean)) {
    let m;
    if ((m = p.match(/^(\w+)([+-])(\d+(?:\.\d+)?)$/))) add[m[1]] = (m[2] === "-" ? -1 : 1) * +m[3];
    else if ((m = p.match(/^(\w+)=(.+)$/))) set[m[1]] = m[2] === "true" ? true : m[2] === "false" ? false : isNaN(m[2]) ? m[2] : +m[2];
    else throw new Error(`cannot read "${p}", write trust+1 or met=true`);
  }
  const o = {};
  if (Object.keys(add).length) o.add = add;
  if (Object.keys(set).length) o.set = set;
  return o;
}
const fmtPlace = p => p ? Object.entries(p).map(([k, v]) => k + "=" + (v == null ? "off" : num(v))).join(" ") : "";
function parsePlace(str) {
  const o = {};
  for (const p of str.split(/[\s,]+/).filter(Boolean)) {
    const m = p.match(/^(\w+)=(off|-?\d*\.?\d+)$/);
    if (!m) throw new Error(`cannot read "${p}", write a=.3 or b=off`);
    o[m[1]] = m[2] === "off" ? null : +m[2];
  }
  return o;
}

function targets(l) {
  if (!l || typeof l !== "object") return [];
  const t = [];
  if (typeof l.goto === "string") t.push(l.goto);
  if (typeof l.else === "string") t.push(l.else);
  if (Array.isArray(l.choice)) for (const o of l.choice) {
    const g = Array.isArray(o) ? o[1] : o && o.goto;
    if (typeof g === "string") t.push(g);
  }
  return t;
}
// edges for the map: [to, type]
function edges(l) {
  if (!l || typeof l !== "object") return [];
  if (Array.isArray(l.choice)) return l.choice.map(o => [Array.isArray(o) ? o[1] : o && o.goto, "choice"]).filter(e => typeof e[0] === "string");
  const out = [];
  if (typeof l.goto === "string") out.push([l.goto, l.if != null ? "cond" : "jump"]);
  if (typeof l.else === "string") out.push([l.else, "cond"]);
  return out;
}

function fallsThrough(L) {
  const l = L.lines[L.lines.length - 1], k = l === undefined ? null : kindOf(l);
  if (k === "jump" || k === "end") return false;
  if (k === "if" && l.else) return false;
  if (k === "choice") return !l.choice.every(o => Array.isArray(o) ? o[1] : o.goto);
  if (k === "action" && l.if == null && (l.goto || l.end != null)) return false;
  return true;
}
const isEnding = L => L.lines.some(l => l && typeof l === "object" && l.end != null);

const hasAnim = (id, n) => { const a = S.script.actors[id]; return !!a && !!a.anims && (n in a.anims || (n + "_r") in a.anims || (n + "_l") in a.anims); };
const animsOf = id => { const a = S.script.actors[id]; return a && a.anims ? [...new Set(Object.keys(a.anims).map(n => n.replace(/_[rl]$/, "")))] : []; };

// The words a line shows, for search, stats and export: [[who, text, path]]
function wordsOf(l) {
  if (typeof l === "string") { const s = speakerOf(l); return s ? [[actorName(s[0]) + (s[2] ? ` (${s[2]})` : ""), s[1], "say"]] : [["", l, "narr"]]; }
  if (!l || typeof l !== "object") return [];
  const out = [];
  if (Array.isArray(l.say)) out.push([actorName(l.say[0]), l.say[1] || "", "lsay"]);
  if (typeof l.text === "string") out.push(["", l.text, "ltext"]);
  if (Array.isArray(l.choice)) l.choice.forEach((o, n) => out.push(["> choice", Array.isArray(o) ? o[0] : (o && o.text) || "", "c" + n]));
  if (typeof l.note === "string") out.push(["note", l.note, "note"]);
  if (l.end != null) out.push(["END", String(l.end), "end"]);
  return out;
}
const countWords = t => (String(t).match(/[\w'’]+/g) || []).length;


// ===================================================================
//  CHECKS
// ===================================================================

function checks() {
  const out = [], names = new Set(S.labels.map(L => L.name)), stages = stageNames();
  const known = new Set(Object.keys(S.script.flags || {}));
  S.labels.forEach(L => L.lines.forEach(l => {
    if (l && typeof l === "object")
      for (const o of [l, ...(Array.isArray(l.choice) ? l.choice.filter(x => !Array.isArray(x)) : [])])
        for (const k of ["set", "add"]) if (o && o[k]) Object.keys(o[k]).forEach(f => known.add(f));
  }));
  for (const g of S.extra.gallery || []) for (const f of Object.keys(g.flags || {})) known.add(f);
  const bad = (li, i, msg) => out.push({ li, i, msg, w: false });
  const warn = (li, i, msg) => out.push({ li, i, msg, w: true });

  if (!names.has(S.start)) bad(0, -1, `The story starts at "${S.start}", which is not a scene.`);

  S.labels.forEach((L, li) => {
    if (!L.lines.length) warn(li, -1, `"${L.name}" has no lines.`);
    L.lines.forEach((l, i) => {
      for (const t of targets(l)) if (!names.has(t)) bad(li, i, `Jumps to "${t}", there is no such scene.`);
      if (typeof l === "string") {
        const m = l.match(/^(\p{Lu}[\p{L}\p{N}_ .'’()-]{0,30}):\s+/u);
        if (m && !speakerOf(l)) warn(li, i, `Narration starting with "${m[1]}:". No one in the cast is called that.`);
        if (!l.trim()) warn(li, i, "Empty line.");
        else if (speakerOf(l) && !speakerOf(l)[1].trim()) warn(li, i, "Empty line.");
        return;
      }
      if (!l || typeof l !== "object") return bad(li, i, "This line is not text or { ... }.");
      const conds = [l.if, ...(Array.isArray(l.choice) ? l.choice.map(o => !Array.isArray(o) && o && o.if) : [])];
      for (const c of conds) if (typeof c === "string") {
        const m = c.trim().match(/^(!?)(\w+)\s*(?:(>=|<=|==|!=|>|<)\s*(-?[\w.]+))?$/);
        if (!m) bad(li, i, `Cannot read the condition "${c}". Write trust >= 2, met or !met.`);
        else if (!known.has(m[2])) warn(li, i, `Flag "${m[2]}" is never set or added anywhere.`);
      }
      if (l.stage && !stages.includes(l.stage)) bad(li, i, `No stage called "${l.stage}" in actors.js.`);
      for (const k of ["move", "show", "flip", "place", "idle"]) if (l[k] && typeof l[k] === "object")
        for (const id of Object.keys(l[k])) if (!S.script.actors[id]) bad(li, i, `${k}: no actor "${id}".`);
      for (const id of [].concat(l.hide || [])) if (!S.script.actors[id]) bad(li, i, `hide: no actor "${id}".`);
      if (l.say && (!Array.isArray(l.say) || !S.script.actors[l.say[0]])) bad(li, i, `say: no actor "${l.say && l.say[0]}".`);
      for (const id of actorIds()) if (typeof l[id] === "string" && !hasAnim(id, l[id])) bad(li, i, `${actorName(id)} has no "${l[id]}" animation.`);
      if (l.idle) for (const [id, n] of Object.entries(l.idle)) if (S.script.actors[id] && !hasAnim(id, n)) bad(li, i, `${actorName(id)} has no "${n}" animation to rest in.`);
      if (Array.isArray(l.choice)) {
        if (!l.choice.length) bad(li, i, "A choice with no options.");
        else if (l.choice.every(o => !Array.isArray(o) && o && o.if != null))
          warn(li, i, "Every option has a condition. When none of them pass, no buttons show and the story reads on.");
        l.choice.forEach((o, n) => { if (!(Array.isArray(o) ? o[0] : o && o.text)) warn(li, i, `Choice option ${n + 1} has no text.`); });
      }
      if (i < L.lines.length - 1 && !fallsThrough({ lines: [l] }) && kindOf(L.lines[i + 1]) !== "note")
        warn(li, i + 1, "Never read: the line before always jumps away.");
    });
  });

  for (const g of S.extra.gallery || []) {
    if (!names.has(g.label)) bad(0, -1, `Scenes menu: "${g.name || g.label}" starts at "${g.label}", no such scene.`);
    if (g.until && !names.has(g.until)) bad(0, -1, `Scenes menu: "${g.name || g.label}" stops at "${g.until}", no such scene.`);
    if (g.stage && !stages.includes(g.stage)) bad(0, -1, `Scenes menu: "${g.name || g.label}" uses stage "${g.stage}", not in actors.js.`);
  }

  const reach = reachable();
  S.labels.forEach((L, li) => { if (!reach.has(L.name)) warn(li, -1, `Nothing leads to "${L.name}".`); });
  const last = S.labels[S.labels.length - 1];
  if (last && fallsThrough(last)) warn(S.labels.length - 1, -1, `"${last.name}" is the last scene and runs off the end with no End line.`);
  return out;
}

function reachable() {
  const names = new Set(S.labels.map(L => L.name)), reach = new Set(), todo = [S.start, ...(S.extra.gallery || []).map(g => g.label)];
  while (todo.length) {
    const n = todo.pop(); if (reach.has(n) || !names.has(n)) continue;
    reach.add(n);
    const li = S.labels.findIndex(L => L.name === n), L = S.labels[li];
    L.lines.forEach(l => targets(l).forEach(t => todo.push(t)));
    if (fallsThrough(L) && S.labels[li + 1]) todo.push(S.labels[li + 1].name);
  }
  return reach;
}


// ===================================================================
//  EDITING, UNDO, DRAFTS
// ===================================================================

const snap = () => ({ labels: S.labels.map(L => ({ name: L.name, lines: L.lines.map(clone) })), start: S.start, extra: clone(S.extra), cur: S.cur });

function edit(fn, rerender = true) {
  if (!S.burst) { S.hist.push(snap()); if (S.hist.length > 300) S.hist.shift(); S.fut = []; }
  clearTimeout(S.burst);
  S.burst = rerender ? null : setTimeout(() => (S.burst = null), 700);
  fn();
  setDirty(true);
  if (rerender) render(); else light();
}

function undo(back = true) {
  const from = back ? S.hist : S.fut, to = back ? S.fut : S.hist;
  if (!from.length) return;
  clearTimeout(S.burst); S.burst = null;
  to.push(snap());
  const s = from.pop();
  S.labels = s.labels; S.start = s.start; S.extra = s.extra; S.cur = Math.min(s.cur, S.labels.length - 1); S.sel = -1; S.raw.clear();
  setDirty(true);
  render();
}

function setDirty(d, keepDraft) {
  S.dirty = d;
  if (d) status("Unsaved changes", "dirty"); else if (!$("status").textContent.startsWith("Saved")) status("Saved");
  $("save").classList.toggle("dirty", d);
  $("undo").disabled = !S.hist.length; $("redo").disabled = !S.fut.length;
  if (S.novel && !keepDraft) {
    clearTimeout(S.draftT);
    S.draftT = setTimeout(() => {
      try {
        const k = "vcns-draft:" + S.novel.dir;
        if (d) localStorage.setItem(k, JSON.stringify({ at: Date.now(), base: S.novel.story, story: storyText() }));
        else localStorage.removeItem(k);
      } catch (e) {}
    }, 400);
  }
}
function status(t, cls = "") { $("status").textContent = t; $("status").className = cls; }

const L = () => S.labels[S.cur];
const setLine = (i, v, rerender = false) => edit(() => { L().lines[i] = v; }, rerender);

function renameRefs(from, to) {
  const fix = l => {
    if (!l || typeof l !== "object") return;
    if (l.goto === from) l.goto = to;
    if (l.else === from) l.else = to;
    if (Array.isArray(l.choice)) l.choice.forEach(o => { if (Array.isArray(o)) { if (o[1] === from) o[1] = to; } else if (o && o.goto === from) o.goto = to; });
  };
  S.labels.forEach(L => L.lines.forEach(fix));
  if (S.start === from) S.start = to;
  for (const g of S.extra.gallery || []) { if (g.label === from) g.label = to; if (g.until === from) g.until = to; }
}

const firstFlag = () => Object.keys(S.script.flags || {})[0] || "met";
const BLANK = {
  say: () => `${actorName(lastSpeaker() || actorIds()[0] || "a")}: `,
  narr: () => "",
  choice: () => ({ choice: [["", L().name], ["", L().name]] }),
  jump: () => ({ goto: L().name }),
  if: () => ({ if: firstFlag() + " >= 1", goto: L().name }),
  flags: () => ({ add: { [firstFlag()]: 1 } }),
  stage: () => ({ stage: stageNames()[0] || "street" }),
  action: () => ({ [actorIds()[0] || "a"]: "idle" }),
  end: () => ({ end: "" }),
  note: () => ({ note: "" }),
};
// the other speaker from the last line, so a back and forth is quick to type
function lastSpeaker() {
  const lines = L().lines.slice(0, S.sel >= 0 ? S.sel + 1 : undefined).reverse(), ids = actorIds();
  const said = lines.map(l => typeof l === "string" && speakerOf(l)).filter(Boolean).map(s => s[0]);
  if (!said.length) return ids[0];
  const other = said.find(x => x !== said[0]);
  return other || ids.find(x => x !== said[0]) || said[0];
}

function addLine(kind, at = S.sel >= 0 ? S.sel + 1 : L().lines.length) {
  edit(() => { L().lines.splice(at, 0, BLANK[kind]()); S.sel = at; });
  focusLine(at);
}
function focusLine(i) {
  const c = $("lines").children[i];
  if (!c) return;
  c.scrollIntoView({ block: "nearest", behavior: "smooth" });
  const f = c.querySelector("textarea,input"); if (f) { f.focus(); const n = f.value.length; f.setSelectionRange && f.setSelectionRange(n, n); }
}
function moveLine(i, d) {
  const a = L().lines, j = i + d;
  if (j < 0 || j >= a.length) return;
  edit(() => { [a[i], a[j]] = [a[j], a[i]]; S.sel = j; S.raw.clear(); });
}


// ===================================================================
//  THE CARDS
// ===================================================================

const opts = (list, val, extra) => {
  const s = el("select");
  for (const o of extra || []) s.append(el("option", { value: o[0] }, o[1]));
  for (const o of list) { const [v, t] = Array.isArray(o) ? o : [o, o]; s.append(el("option", { value: v }, t)); }
  s.value = val ?? "";
  if (val != null && val !== "" && s.value !== String(val)) { s.append(el("option", { value: val }, val + " (missing)")); s.value = val; s.classList.add("err"); }
  return s;
};
const labelPick = (val, none) => opts(S.labels.map(L => L.name), val ?? "", none ? [["", none]] : null);
const castPick = (val, none) => opts(actorIds().map(id => [id, actorName(id)]), val ?? "", none ? [["", none]] : null);

function field(value, onok, { area = false, code = false, ph = "", cls = "" } = {}) {
  const f = area ? el("textarea", { rows: 1, placeholder: ph, spellcheck: !code }) : el("input", { placeholder: ph, spellcheck: !code });
  f.className = (code ? "code " : "") + cls;
  f.value = value;
  const go = () => { try { onok(f.value); f.classList.remove("err"); f.title = ""; } catch (e) { f.classList.add("err"); f.title = e.message; } };
  f.addEventListener("input", go);
  if (area) { const fit = () => { f.style.height = "auto"; f.style.height = f.scrollHeight + 2 + "px"; }; f.addEventListener("input", fit); requestAnimationFrame(fit); }
  return f;
}
const row = (...kids) => el("div", { class: "row" }, ...kids);
const lab = t => el("label", {}, t);

function choicePlacement(l, i) {
  const cur = l.at ?? "", lay = l.layout ?? "";
  const at = opts([["top", "top"], ["middle", "middle"], ["bottom", "bottom"], ["left", "left"], ["right", "right"]], typeof cur === "string" ? cur : "", [["", "default"]]);
  const ly = opts([["column", "stacked"], ["row", "side by side"], ["grid", "two wide"]], lay, [["", "default"]]);
  const upd = () => { const o = { choice: L().lines[i].choice }; if (at.value) o.at = at.value; else if (l.at && typeof l.at === "object") o.at = l.at; if (ly.value) o.layout = ly.value; setLine(i, o, true); };
  at.onchange = ly.onchange = upd;
  return el("div", { class: "copts" }, lab("Buttons at"), at, lab("layout"), ly,
    !S.novel.engine.choices ? el("span", { class: "hint" }, "(needs the new vn.js)") : null);
}

function editor(l, i) {
  const k = kindOf(l), body = [];
  if (S.raw.has(i)) {
    body.push(field(lit(l, ""), t => setLine(i, evalLit(t)), { area: true, code: true }));
    return body;
  }
  if (k === "say") {
    const [, text] = speakerOf(l);
    body.push(field(text, t => { const [id, , as] = speakerOf(L().lines[i]); setLine(i, sayLine(id, t, as)); }, { area: true, ph: "What they say" }));
  }
  if (k === "narr") body.push(field(l, t => setLine(i, t), { area: true, ph: "Narration" }));
  if (k === "note") body.push(field(l.note, t => setLine(i, { note: t }), { area: true, ph: "A note for you. The reader never sees it." }));
  if (k === "end") body.push(row(lab("Ending name"), field(l.end, t => setLine(i, { end: t }), { ph: "Morning Light", cls: "w" })));
  if (k === "jump") { const s = labelPick(l.goto); s.classList.add("w"); s.onchange = () => setLine(i, { goto: s.value }, true); body.push(row(lab("Go to"), s)); }

  if (k === "if") {
    const mk = () => { const o = { if: c.value, goto: g.value }; if (e.value) o.else = e.value; return o; };
    const c = field(typeof l.if === "string" ? l.if : String(l.if), () => setLine(i, mk()), { ph: "trust >= 2", cls: "w" });
    const g = labelPick(l.goto), e = labelPick(l.else, "carry on");
    g.onchange = e.onchange = () => setLine(i, mk(), true);
    body.push(row(lab("If"), c, lab("go to"), g, lab("else"), e));
  }
  if (k === "flags") body.push(row(lab("Change"), field(fmtFlags(l), t => setLine(i, parseFlags(t)), { ph: "trust+1 met=true", cls: "w" })));

  if (k === "stage") {
    const s = opts(stageNames(), l.stage);
    const upd = () => { const o = { stage: s.value }; const p = parsePlace(pl.value); if (Object.keys(p).length) o.place = p; if (fd.value) o.fadeSecs = +fd.value; setLine(i, o); };
    const pl = field(fmtPlace(l.place), upd, { ph: "a=.3 b=.7 c=off", cls: "w" });
    const fd = field(l.fadeSecs ?? "", upd, { ph: "secs" }); fd.style.width = "64px";
    s.onchange = () => { upd(); render(); };
    body.push(row(lab("Fade to"), s, lab("place"), pl, lab("fade"), fd));
  }

  if (k === "choice") {
    const norm = o => Array.isArray(o) ? { text: o[0], goto: o[1] } : { ...o };
    const back = o => {
      const rest = Object.keys(o).filter(x => !["text", "goto"].includes(x) && o[x] !== undefined);
      return !rest.length && o.goto ? [o.text, o.goto] : Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
    };
    const list = l.choice.map(norm);
    const save = rerender => { const o = { ...L().lines[i], choice: list.map(back) }; setLine(i, o, rerender); };
    const wrap = el("div", { class: "opts" });
    list.forEach((o, n) => {
      const t = field(o.text || "", v => { o.text = v; save(); }, { ph: "What the player clicks", cls: "text" });
      const g = labelPick(o.goto, "carry on");
      g.onchange = () => { o.goto = g.value || undefined; save(true); };
      const c = field(typeof o.if === "string" ? o.if : o.if ? String(o.if) : "", v => { o.if = v || undefined; save(); }, { ph: "only if, e.g. fun >= 1" });
      const f = field(fmtFlags(o), v => { const p = parseFlags(v); o.add = p.add; o.set = p.set; save(); }, { ph: "flags, e.g. trust+1" });
      wrap.append(el("div", { class: "opt" }, el("span", { class: "n" }, n + 1), t, g,
        el("div", { class: "more" }, c, f, icon("up", "Move option up", () => { if (n) { [list[n - 1], list[n]] = [list[n], list[n - 1]]; save(true); } }),
          icon("x", "Remove option", () => { list.splice(n, 1); save(true); }, "bad"))));
    });
    body.push(wrap, row(el("button", { class: "small", onclick: () => { list.push({ text: "", goto: L().name }); save(true); } }, "+ Option")), choicePlacement(l, i));
  }

  if (k === "action") {
    const o = typeof l === "object" && l ? { ...l } : {};
    const words = o.say ? o.say : o.text != null ? ["", o.text] : null;
    delete o.say; delete o.text;
    const who = castPick(words ? words[0] : "", "narration");
    const save = () => {
      const v = evalLit(code.value.trim() || "{}");
      if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("the step must be { ... }");
      if (tx.value) { if (who.value) v.say = [who.value, tx.value]; else v.text = tx.value; }
      setLine(i, v);
    };
    const code = field(lit(o, ""), save, { area: true, code: true, ph: '{ a: "hug", b: "hug", hold: 1 }' });
    const tx = field(words ? words[1] : "", save, { ph: "Words shown while it plays (optional)", cls: "w" });
    who.onchange = () => { try { save(); } catch (e) {} };
    const ac = castPick(actorIds()[0]);
    let an = opts(animsOf(actorIds()[0]), animsOf(actorIds()[0])[0]);
    ac.onchange = () => { const n = opts(animsOf(ac.value), animsOf(ac.value)[0]); an.replaceWith(n); an = n; };
    const put = (key, val) => { const v = evalLit(code.value.trim() || "{}"); v[key] = val; code.value = lit(v, ""); code.dispatchEvent(new Event("input")); };
    body.push(code, row(who, tx),
      row(lab("Quick add"), ac, an, el("button", { class: "small", onclick: () => put(ac.value, an.value) }, "play"),
        el("button", { class: "small", onclick: () => { const v = evalLit(code.value.trim() || "{}"); v.move = { ...(v.move || {}), [ac.value]: .5 }; v.secs = v.secs || 1.5; code.value = lit(v, ""); code.dispatchEvent(new Event("input")); } }, "move"),
        el("button", { class: "small", onclick: () => put("hold", 1) }, "hold"),
        el("button", { class: "small", onclick: () => put("wait", .5) }, "wait")));
  }
  return body;
}

function card(l, i) {
  const k = kindOf(l);
  const head = [el("span", { class: "kind" }, KINDS[k][0])];
  let style = "";
  if (k === "say") {
    const [id] = speakerOf(l);
    style = `--spk:${actorColor(id)}`;
    const who = castPick(id); who.className = "who"; who.style.color = actorColor(id);
    who.onchange = () => { const [, t, as] = speakerOf(L().lines[i]); setLine(i, sayLine(who.value, t, as), true); };
    head[0] = who;
  }
  const c = el("div", { class: `card k-${k}` + (i === S.sel ? " sel" : "") + (["jump", "flags", "end", "if"].includes(k) ? " compact" : ""), style },
    el("div", { class: "gut", title: "Drag to move" }, el("span", { class: "n" }, i + 1), el("span", { class: "g" }, "⁘⁘")),
    el("div", { class: "top" }, ...head, el("div", { class: "tools" },
      icon("play", "Play from this line", () => playAt(i)),
      icon("up", "Move up (Alt+Up)", () => moveLine(i, -1)),
      icon("down", "Move down (Alt+Down)", () => moveLine(i, 1)),
      icon("copy", "Duplicate (Ctrl+D)", () => edit(() => { L().lines.splice(i + 1, 0, clone(l)); S.sel = i + 1; })),
      icon("code", S.raw.has(i) ? "Back to the form" : "Edit as code", () => { S.raw.has(i) ? S.raw.delete(i) : S.raw.add(i); renderLines(); }),
      icon("del", "Delete line", () => edit(() => { L().lines.splice(i, 1); S.sel = Math.min(i, L().lines.length - 1); S.raw.clear(); }), "bad"))),
    el("div", { class: "body" }, ...editor(l, i)));
  c.addEventListener("mousedown", () => select(i));
  c.addEventListener("focusin", () => select(i));
  const gut = c.firstChild;
  gut.addEventListener("mousedown", () => (c.draggable = true));
  c.addEventListener("dragend", () => { c.draggable = false; c.classList.remove("drag"); });
  c.addEventListener("dragstart", e => { e.dataTransfer.setData("text/line", i); c.classList.add("drag"); });
  c.addEventListener("dragover", e => { if (e.dataTransfer.types.includes("text/line")) { e.preventDefault(); c.classList.add("dropat"); } });
  c.addEventListener("dragleave", () => c.classList.remove("dropat"));
  c.addEventListener("drop", e => {
    e.preventDefault(); c.classList.remove("dropat");
    const from = +e.dataTransfer.getData("text/line"); if (from === i) return;
    edit(() => { const a = L().lines, [x] = a.splice(from, 1); a.splice(from < i ? i - 1 : i, 0, x); S.sel = from < i ? i - 1 : i; S.raw.clear(); });
  });
  return c;
}
function select(i) {
  if (S.sel === i) return;
  S.sel = i;
  [...$("lines").children].forEach((x, n) => x.classList.toggle("sel", n === i));
  renderAddAt();
}


// ===================================================================
//  DRAWING THE PAGE
// ===================================================================

function render() { renderLabels(); renderHead(); renderLines(); light(); renderPreviewOpts(); if (S.tab === "map") renderMap(); if (S.tab === "settings") renderSettings(); }
// the cheap parts, redrawn while typing
function light() { const c = S.lastChecks = checks(); renderChecks(c); renderLabelBadges(c); renderFlow(); renderStats(); if (S.tab === "map") renderMap(); }

function renderLabels() {
  const f = S.filter.toLowerCase();
  put($("labels"), S.labels.map((Lb, li) => {
    if (f && !Lb.name.toLowerCase().includes(f)) return null;
    const d = el("div", { class: "lab" + (li === S.cur ? " on" : "") + (isEnding(Lb) ? " end" : ""), onclick: () => openScene(li), draggable: true },
      el("span", { class: "nm" }, Lb.name), Lb.name === S.start ? el("span", { class: "tag" }, "start") : null,
      el("span", { class: "dot", hidden: true }), el("span", { class: "ct" }, Lb.lines.length));
    d.dataset.li = li;
    d.addEventListener("dragstart", e => e.dataTransfer.setData("text/label", li));
    d.addEventListener("dragover", e => { if (e.dataTransfer.types.includes("text/label")) { e.preventDefault(); d.classList.add("dragover"); } });
    d.addEventListener("dragleave", () => d.classList.remove("dragover"));
    d.addEventListener("drop", e => {
      e.preventDefault(); d.classList.remove("dragover");
      const from = +e.dataTransfer.getData("text/label"); if (from === li) return;
      edit(() => { const name = L().name, [x] = S.labels.splice(from, 1); S.labels.splice(li, 0, x); S.cur = S.labels.findIndex(L => L.name === name); });
    });
    return d;
  }));
}
function renderLabelBadges(list) {
  const errs = {};
  for (const c of list) if (!c.w) errs[c.li] = 1;
  for (const d of $("labels").children) { const li = +d.dataset.li; d.querySelector(".dot").hidden = !errs[li]; d.querySelector(".ct").textContent = S.labels[li] ? S.labels[li].lines.length : ""; }
}
function renderHead() {
  $("lname").textContent = L() ? L().name : "";
  $("startlabel").disabled = !L() || L().name === S.start;
  document.title = `${S.script.title || S.novel.name} - vc-novel-studio`;
  const w = $("enginewarn");
  w.hidden = S.novel.engine.gallery && S.novel.engine.choices;
  w.textContent = "This novel's vn.js is an older one: choice placement, the Scenes menu and the adults-only gate will not show in the preview or the game until its vn.js and game.html are updated.";
}
function renderLines() {
  const lines = L() ? L().lines : [];
  $("lines").replaceChildren(...lines.map(card));
  $("empty").hidden = lines.length > 0;
  renderAddAt();
}
function renderAddAt() {
  const n = L() ? L().lines.length : 0;
  $("addat").textContent = S.sel >= 0 && S.sel < n - 1 ? `Adds after line ${S.sel + 1}` : "Adds at the end of the scene";
}

function renderChecks(list) {
  $("checkcount").textContent = list.length ? `${list.filter(c => !c.w).length} errors · ${list.filter(c => c.w).length} notes` : "";
  $("checks").replaceChildren(...(list.length ? list.map(c => el("div", {
    class: "ck" + (c.w ? " w" : ""),
    onclick: () => { openScene(c.li, c.i); },
  }, el("b", {}, S.labels[c.li] ? S.labels[c.li].name : ""), c.i >= 0 ? ` line ${c.i + 1}` : "", ": ", c.msg))
    : [el("div", { class: "ck ok" }, "All good. Nothing broken.")]));
}

function renderFlow() {
  if (!L()) return $("flow").replaceChildren();
  const me = L().name, li = S.cur;
  const from = S.labels.filter((x, n) => x.lines.some(l => targets(l).includes(me)) || (n === li - 1 && fallsThrough(x))).map(x => x.name);
  const to = [...new Set(L().lines.flatMap(targets))];
  const runs = fallsThrough(L()) && S.labels[li + 1];
  const chip = n => el("span", { class: "chip", onclick: () => { const k = S.labels.findIndex(x => x.name === n); if (k >= 0) openScene(k); } }, n);
  put($("flow"),
    "From", ...(me === S.start ? [el("span", { class: "chip on" }, "the start")] : []), ...from.map(chip),
    !from.length && me !== S.start ? el("span", { class: "chip on" }, "nothing yet") : null,
    el("span", { class: "sep" }, "→"), "To", ...to.map(chip), runs ? chip(S.labels[li + 1].name) : null,
    runs ? el("span", { class: "hint" }, "(runs on)") : null,
    !to.length && !runs ? el("span", { class: "chip on" }, isEnding(L()) ? "the end" : "nowhere") : null);
}

function renderStats() {
  let lines = 0, words = 0;
  for (const Lb of S.labels) for (const l of Lb.lines) { lines++; for (const [, t, p] of wordsOf(l)) if (p !== "note") words += countWords(t); }
  const mins = Math.max(1, Math.round(words / 200));
  const ends = new Set(S.labels.flatMap(Lb => Lb.lines.filter(l => l && l.end != null).map(l => l.end))).size;
  $("stats").replaceChildren(...[[S.labels.length, "scenes"], [lines, "lines"], [words.toLocaleString(), "words"], [ends, "endings"], ["~" + mins, "min read"]]
    .map(([n, t]) => el("span", {}, el("b", {}, n), t)));
}

function renderPreviewOpts() {
  const s = $("pvstage"), names = stageNames();
  let guess = S.script.stage;
  for (const Lb of S.labels.slice(0, S.cur)) for (const l of Lb.lines) if (l && typeof l === "object" && l.stage) guess = l.stage;
  s.replaceChildren(...names.map(n => el("option", { value: n }, n)));
  s.value = guess;
}

function openScene(li, line = -1) {
  if (li < 0 || li >= S.labels.length) return;
  if (li !== S.cur) S.raw.clear();
  S.cur = li; S.sel = line;
  render();
  if (line >= 0) requestAnimationFrame(() => { const x = $("lines").children[line]; if (x) x.scrollIntoView({ block: "center" }); });
  else $("mid").scrollTop = 0;
}


// ===================================================================
//  MAP
// ===================================================================

function renderMap() {
  const names = S.labels.map(Lb => Lb.name), idx = new Map(names.map((n, i) => [n, i]));
  const out = names.map(() => []);
  S.labels.forEach((Lb, i) => {
    const seen = new Set();
    for (const l of Lb.lines) for (const [t, type] of edges(l)) if (idx.has(t) && !seen.has(t + type)) { seen.add(t + type); out[i].push([idx.get(t), type]); }
    if (fallsThrough(Lb) && i + 1 < names.length) out[i].push([i + 1, "run"]);
  });
  // layers: longest path from the start over a BFS order, cycles ignored
  const layer = names.map(() => -1), start = idx.get(S.start) ?? 0, q = [start];
  layer[start] = 0;
  while (q.length) {
    const a = q.shift();
    for (const [b] of out[a]) if (layer[b] < 0) { layer[b] = layer[a] + 1; q.push(b); }
  }
  let maxL = Math.max(0, ...layer);
  names.forEach((_, i) => { if (layer[i] < 0) layer[i] = ++maxL; });   // scenes nothing reaches go last
  const cols = [];
  names.forEach((_, i) => (cols[layer[i]] = cols[layer[i]] || []).push(i));
  // rows top to bottom, each row centred
  const W = 140, H = 44, GX = 18, GY = 56, pos = [];
  const wide = Math.max(...cols.map(c => c.length)), width = Math.max(40 + wide * (W + GX), 300), height = 40 + cols.length * (H + GY);
  cols.forEach((c, y) => { const x0 = (width - (c.length * (W + GX) - GX)) / 2; c.forEach((i, x) => (pos[i] = [x0 + x * (W + GX), 20 + y * (H + GY)])); });
  const reach = reachable();
  const svg = svgEl("svg", { width, height, viewBox: `0 0 ${width} ${height}` },
    svgEl("defs", {}, ...[["a", "#8a6a2c"], ["c", "#c9a24a"], ["g", "#7fa66a"], ["r", "#5d4a36"]].map(([id, col]) =>
      svgEl("marker", { id: "m" + id, viewBox: "0 0 10 10", refX: 9, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" }, svgEl("path", { d: "M0 0 10 5 0 10z", fill: col })))));
  out.forEach((list, a) => list.forEach(([b, type]) => {
    const [x1, y1] = pos[a], [x2, y2] = pos[b];
    const back = y2 <= y1, sx = x1 + W / 2, sy = y1 + H;
    let d;
    if (back) {                              // a loop back up: out the side and round
      const side = x2 + W / 2 >= x1 + W / 2 ? 1 : -1, ox = x1 + (side > 0 ? W : 0), oy = y1 + H / 2, ex = x2 + (side > 0 ? W : 0), ey = y2 + H / 2;
      d = `M${ox} ${oy} C${ox + side * 50} ${oy}, ${ex + side * 50} ${ey}, ${ex} ${ey}`;
    } else { const ex = x2 + W / 2, ey = y2; d = `M${sx} ${sy} C${sx} ${sy + GY / 2}, ${ex} ${ey - GY / 2}, ${ex} ${ey}`; }
    const m = { choice: "c", cond: "g", run: "r" }[type] || "a";
    svg.append(svgEl("path", { d, class: "me " + type, "marker-end": `url(#m${m})` }));
  }));
  S.labels.forEach((Lb, i) => {
    const [x, y] = pos[i];
    const g = svgEl("g", { class: "mn" + (i === S.cur ? " on" : "") + (Lb.name === S.start ? " start" : "") + (isEnding(Lb) ? " end" : "") + (reach.has(Lb.name) ? "" : " lost"), transform: `translate(${x} ${y})` },
      svgEl("rect", { width: W, height: H, rx: 8 }),
      svgEl("text", { x: 10, y: 19 }, Lb.name.length > 19 ? Lb.name.slice(0, 18) + "…" : Lb.name),
      svgEl("text", { x: 10, y: 34, class: "sub" }, `${Lb.lines.length} lines` + (isEnding(Lb) ? " · ending" : "") + (Lb.name === S.start ? " · start" : "")));
    g.addEventListener("click", () => openScene(i));
    svg.append(g);
  });
  $("map").replaceChildren(svg);
}


// ===================================================================
//  NOVEL SETTINGS: choices, the Scenes menu, the adults-only gate
// ===================================================================

function renderSettings() {
  const ch = S.extra.choices || {}, at = ch.at ?? "middle", lay = ch.layout ?? "column";
  const setCh = (k, v) => edit(() => {
    const c = { ...(S.extra.choices || {}) }; c[k] = v;
    if (c.at === "middle") delete c.at; if (c.layout === "column") delete c.layout;
    if (Object.keys(c).length) S.extra.choices = c; else delete S.extra.choices;
  });
  const spots = el("div", { class: "spots" }, ...[["", "top", ""], ["left", "middle", "right"], ["", "bottom", ""]].flat().map(n =>
    n ? el("button", { class: n === at ? "on" : "", title: n, onclick: () => setCh("at", n) }) : el("span")));
  const seg = (list, val, fn) => el("div", { class: "seg" }, ...list.map(([v, t]) => el("button", { class: v === val ? "on" : "", onclick: () => fn(v) }, t)));
  const engineNote = !S.novel.engine.gallery ? el("p", {}, "This novel's vn.js is older and ignores these settings. Update its vn.js and game.html first.") : null;

  const gal = S.extra.gallery || [];
  const setGal = fn => edit(() => { const g = clone(S.extra.gallery || []); fn(g); if (g.length) S.extra.gallery = g; else delete S.extra.gallery; });
  const gi = (g, n) => {
    const upd = (k, v, rerender = false) => edit(() => { const e = S.extra.gallery[n]; if (v === "" || v == null) delete e[k]; else e[k] = v; }, rerender);
    const startP = labelPick(g.label), untilP = labelPick(g.until, "until the end"), stP = opts(stageNames(), g.stage ?? "", [["", "first stage"]]);
    startP.onchange = () => upd("label", startP.value, true); untilP.onchange = () => upd("until", untilP.value, true); stP.onchange = () => upd("stage", stP.value, true);
    return el("div", { class: "gi" },
      el("label", { class: "full" }, "Name in the menu", field(g.name || "", v => upd("name", v), { ph: "The fountain" })),
      el("div", {}, icon("x", "Remove", () => setGal(a => a.splice(n, 1)), "bad")),
      el("label", {}, "Starts at", startP), el("label", {}, "Stops at", untilP), el("label", {}, "Stage", stP), el("span"),
      el("label", {}, "Place", field(fmtPlace(g.place), v => upd("place", Object.keys(parsePlace(v)).length ? parsePlace(v) : null), { ph: "a=.3 b=.7" })),
      el("label", {}, "Flags", field(Object.entries(g.flags || {}).map(([k, v]) => k + "=" + v).join(" "), v => upd("flags", Object.keys(parseFlags(v).set || {}).length ? parseFlags(v).set : null), { ph: "love=3" })),
      el("label", {}, "Picture", field(g.image || "", v => upd("image", v), { ph: "bg/fountain.png" })), el("span"));
  };

  const gate = S.extra.ageGate;
  put($("settings"),
    engineNote,
    el("div", { class: "set" }, el("h3", {}, "Choice buttons"),
      el("p", {}, "Where the buttons sit on screen for every choice. A choice line can still set its own, under its options."),
      el("div", { class: "row", style: "gap:22px;align-items:flex-start" }, spots,
        el("div", { style: "display:flex;flex-direction:column;gap:8px" }, lab("Layout"),
          seg([["column", "Stacked"], ["row", "Side by side"], ["grid", "Two wide"]], lay, v => setCh("layout", v)),
          el("span", { class: "hint" }, `Now: ${at}, ${{ column: "stacked", row: "side by side", grid: "two wide" }[lay]}`)))),
    el("div", { class: "set" }, el("h3", {}, "Scenes menu"),
      el("p", {}, "A Scenes button on the title screen, for jumping straight to favourite scenes, the way story and gallery modes work in most visual novels. A scene unlocks once the player has reached it, and replays without touching their save."),
      el("div", { class: "gal" }, ...gal.map(gi)),
      row(el("button", { class: "small", onclick: () => setGal(a => a.push({ name: L().name, label: L().name })) }, `+ Add "${L() ? L().name : ""}"`),
        el("label", { class: "chk" }, el("input", { type: "checkbox", checked: !!S.extra.galleryOpen, onchange: e => edit(() => { if (e.target.checked) S.extra.galleryOpen = true; else delete S.extra.galleryOpen; }) }), " Everything unlocked from the start"))),
    el("div", { class: "set" }, el("h3", {}, "Adults only"),
      el("p", {}, "Asks the player to confirm they are 18 or older before the title screen, once. The answer is saved with the city."),
      row(el("label", { class: "chk" }, el("input", { type: "checkbox", checked: gate != null, onchange: e => edit(() => { if (e.target.checked) S.extra.ageGate = "This story contains adult content."; else delete S.extra.ageGate; }) }), " Ask before the story opens")),
      gate != null ? field(typeof gate === "string" ? gate : "", v => edit(() => { S.extra.ageGate = v || true; }, false), { area: true, ph: "What the gate says" }) : null),
    el("div", { class: "set" }, el("h3", {}, "Cast, stages and title"),
      el("p", {}, `These live in actors.js and are edited by hand. Title: ${S.script.title || "(none)"}. Cast: ${actorIds().map(actorName).join(", ")}. Stages: ${stageNames().join(", ")}. Flags: ${Object.keys(S.script.flags || {}).join(", ") || "(none)"}. Reload the studio after changing it.`)));
}


// ===================================================================
//  FIND AND REPLACE
// ===================================================================

function findOpen() { $("find").hidden = false; $("fq").focus(); $("fq").select(); findRun(); }
function findClose() { $("find").hidden = true; }
function findRun() {
  const q = $("fq").value, out = [];
  if (q) S.labels.forEach((Lb, li) => Lb.lines.forEach((l, i) => {
    for (const [who, t] of wordsOf(l)) {
      const at = t.toLowerCase().indexOf(q.toLowerCase());
      if (at >= 0) out.push({ li, i, who, t, at });
    }
  }));
  $("frall").disabled = !out.length;
  $("fres").replaceChildren(...(q && !out.length ? [el("div", { class: "fnone" }, "Not found.")] : out.slice(0, 300).map(r => {
    const a = Math.max(0, r.at - 40), pre = (a ? "…" : "") + r.t.slice(a, r.at), hit = r.t.slice(r.at, r.at + q.length), post = r.t.slice(r.at + q.length, r.at + q.length + 70);
    return el("div", { class: "fr", onclick: () => { openScene(r.li, r.i); } },
      el("span", { class: "w" }, `${S.labels[r.li].name} ${r.i + 1}`), el("span", {}, r.who ? r.who + ": " : "", pre, el("mark", {}, hit), post));
  })));
}
function replaceIn(l, q, r) {
  const rx = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), sub = t => t.replace(rx, () => r);
  if (typeof l === "string") { const s = speakerOf(l); return s && rx.test(s[1]) ? (rx.lastIndex = 0, sayLine(s[0], sub(s[1]), s[2])) : (rx.lastIndex = 0, s ? l : sub(l)); }
  if (!l || typeof l !== "object") return l;
  const o = clone(l);
  if (Array.isArray(o.say)) o.say[1] = sub(o.say[1] || "");
  if (typeof o.text === "string") o.text = sub(o.text);
  if (typeof o.note === "string") o.note = sub(o.note);
  if (Array.isArray(o.choice)) o.choice = o.choice.map(c => Array.isArray(c) ? [sub(c[0]), c[1]] : { ...c, text: sub(c.text || "") });
  return o;
}


// ===================================================================
//  PREVIEW, SAVE, EXPORT, NOVELS, BACKUPS
// ===================================================================

async function api(path, body) {
  const headers = { "X-Studio-Key": KEY };
  if (body) headers["Content-Type"] = "application/json";
  const r = await fetch(path, body ? { method: "POST", headers, body: JSON.stringify(body) } : { headers });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}

async function play(label, line = 0) {
  let p;
  try { p = parseFlags($("pvflags").value); $("pvflags").classList.remove("err"); }
  catch (e) { $("pvflags").classList.add("err"); return; }
  const flags = { ...(p.add || {}), ...(p.set || {}) };
  const fresh = label === S.start && !line && !$("pvflags").value;
  await api("/api/draft", { story: storyText() });
  const q = new URLSearchParams({ label, stage: fresh ? "" : $("pvstage").value, show: $("pvshow").checked && !fresh ? "1" : "0",
    flags: JSON.stringify(flags), line: line || "", gate: fresh ? "1" : "", t: Date.now() });
  S.lastPlay = [label, line];
  showTab("preview");
  // from the very start: the title screen as the player sees it (Scenes menu, gate and all)
  $("pv").src = "/novel/game.html?" + (fresh ? "t=" + Date.now() : q);
  $("pv").focus();
}
const playAt = i => play(L().name, i);

async function save() {
  const bad = checks().filter(c => !c.w);
  if (bad.length && (await ask("Save with errors?", el("p", {}, `${bad.length} error${bad.length > 1 ? "s" : ""} in the checks. The novel may stop at them. Save anyway?`))) !== "ok") return;
  try {
    const text = storyText(), back = evalNovel(S.novel.actors, text);
    if (JSON.stringify(back.labels) !== JSON.stringify(Object.fromEntries(S.labels.map(L => [L.name, L.lines]))))
      throw new Error("the written story did not read back the same");
    const lost = Object.keys(S.script).filter(k => !EXTRA.includes(k) && !(k in back));
    if (lost.length) throw new Error(`story.js sets SCRIPT.${lost.join(", SCRIPT.")}, which the studio would drop. Move it to actors.js.`);
    const h = S.hist.length, f = S.fut.length;
    const r = await api("/api/save", { story: text });
    S.novel.story = text;
    status("Saved \u00B7 the old copy is in studio-backups/" + r.dir + "/" + r.backup);
    setDirty(S.hist.length !== h || S.fut.length !== f || storyText() !== text);
  } catch (e) { status("Save failed: " + e.message, "bad"); }
}

function exportText() {
  const out = [`${S.script.title || S.novel.name}`, S.script.subtitle || "", ""];
  for (const Lb of S.labels) {
    out.push("", `== ${Lb.name}${Lb.name === S.start ? " (start)" : ""} ==`, "");
    for (const l of Lb.lines) {
      const k = kindOf(l);
      for (const [who, t, p] of wordsOf(l)) {
        if (p === "note") out.push(`    [note: ${t}]`);
        else if (p.startsWith("c")) { const o = l.choice[+p.slice(1)]; out.push(`    ${+p.slice(1) + 1}. ${t}  -> ${(Array.isArray(o) ? o[1] : o.goto) || "carry on"}`); }
        else if (p === "end") out.push(`    THE END: ${t}`);
        else out.push(who ? `${who.toUpperCase()}: ${t}` : t);
      }
      if (k === "choice") continue;
      if (k === "jump") out.push(`    -> ${l.goto}`);
      if (k === "if") out.push(`    if ${l.if} -> ${l.goto}${l.else ? ", else -> " + l.else : ""}`);
      if (k === "stage") out.push(`    [to ${l.stage}]`);
      if (k === "flags") out.push(`    [${fmtFlags(l)}]`);
    }
  }
  const a = el("a", { href: URL.createObjectURL(new Blob([out.join("\n")], { type: "text/plain" })), download: `${S.novel.name}-script.txt` });
  document.body.append(a); a.click(); a.remove();
  status("Exported " + a.download);
}

function ask(title, ...kids) {
  $("dlgt").textContent = title;
  $("dlgb").replaceChildren(...kids);
  const d = $("dlg");
  d.showModal();
  const f = d.querySelector("#dlgb input"); if (f) { f.focus(); f.select(); }
  return new Promise(r => d.addEventListener("close", () => r(d.returnValue), { once: true }));
}

async function nameAsk(title, val) {
  const f = el("input", { value: val || "" });
  f.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("dlgok").click(); } });
  if ((await ask(title, f)) !== "ok") return null;
  const n = f.value.trim().replace(/\s+/g, "_");
  if (!n) return null;
  if (S.labels.some(x => x.name === n) && n !== val) { await ask("That name is taken", el("p", {}, `There is already a scene called "${n}".`)); return null; }
  return n;
}

function showTab(t) {
  S.tab = t;
  for (const b of document.querySelectorAll(".tabs button")) b.classList.toggle("on", b.dataset.tab === t);
  for (const x of ["preview", "map", "settings"]) $("tab-" + x).hidden = x !== t;
  if (t === "map") renderMap();
  if (t === "settings") renderSettings();
}

// The novel picker: every novel found, then Open folder and New novel
function fillNovels(list) {
  const groups = {};
  for (const n of list.novels) (groups[n.where] = groups[n.where] || []).push(n);
  const names = { "mods-dist": "Your mods-dist", installed: "Documents/Vibe City/mods", folder: "Opened" };
  put($("novels"),
    !list.current ? el("option", { value: "" }, "No novel open") : null,
    Object.entries(groups).map(([w, ns]) => el("optgroup", { label: names[w] || w }, ...ns.map(n => el("option", { value: n.dir }, n.name)))),
    el("optgroup", { label: "More" },
      list.canPick ? el("option", { value: "?pick" }, "Open a folder\u2026") : el("option", { value: "?path" }, "Open a folder by path\u2026"),
      list.canNew ? el("option", { value: "?new" }, "New novel\u2026") : null));
  $("novels").value = list.current || "";
  S.novels = list;
}

async function openNovel(v) {
  if (v === "?new") {
    const f = el("input", { placeholder: "My Story" });
    f.addEventListener("keydown", e => { if (e.key === "Enter") { e.preventDefault(); $("dlgok").click(); } });
    if ((await ask("New novel", el("p", {}, `A copy of the novel template, in ${S.novels.newIn}. Give it a name:`), f)) !== "ok" || !f.value.trim()) return false;
    await api("/api/new", { name: f.value.trim() });
    return true;
  }
  if (v === "?path") {
    const f = el("input", { placeholder: "/home/you/Documents/Vibe City/mods/my-story" });
    if ((await ask("Open a novel folder", f)) !== "ok" || !f.value.trim()) return false;
    v = f.value.trim();
  }
  const r = await api("/api/open", { dir: v });
  return !r.cancelled;
}

function welcome(list) {
  document.querySelector("main").hidden = true;
  const box = el("div", { class: "welcome" },
    el("h1", {}, "VC Novel Studio"),
    el("p", {}, "Write visual novels for Vibe City: scenes, choices, endings, a Scenes menu, all played back in the novel's own engine as you go."),
    el("div", { class: "row" },
      list.canNew ? el("button", { class: "primary", onclick: () => go("?new") }, "New novel") : null,
      el("button", { class: "small", onclick: () => go(list.canPick ? "?pick" : "?path") }, "Open a folder")),
    list.novels.length ? el("div", { class: "wlist" }, el("h2", {}, "Novels found"),
      ...list.novels.map(n => el("button", { class: "small", onclick: () => go(n.dir) }, n.name, el("span", {}, n.where)))) : null);
  const go = async v => { try { if (await openNovel(v)) location.reload(); } catch (e) { status(e.message, "bad"); } };
  document.body.append(box);
}

async function boot() {
  try {
    const list = await api("/api/novels");
    fillNovels(list);
    if (!list.current) return welcome(list);
    const nv = await api("/api/novel");
    load(nv);
    render();
    status("Saved");
    $("pv").src = "/novel/game.html";
    // a draft left over from a closed tab or a crash
    try {
      const d = JSON.parse(localStorage.getItem("vcns-draft:" + nv.dir) || "null");
      if (d && d.story === nv.story) localStorage.removeItem("vcns-draft:" + nv.dir);
      else if (d) {
        const when = new Date(d.at).toLocaleString();
        const msg = d.base === nv.story ? `You have unsaved edits from ${when}. Bring them back?`
          : `You have unsaved edits from ${when}, but story.js has changed on disk since. Bringing them back replaces what is on disk when you save.`;
        if ((await ask("Unsaved edits found", el("p", {}, msg))) === "ok") {
          const sc = evalNovel(nv.actors, d.story);
          edit(() => { takeStory(sc); S.cur = 0; S.sel = -1; });
          status("Brought back your unsaved edits", "dirty");
        } else localStorage.removeItem("vcns-draft:" + nv.dir);
      }
    } catch (e) {}
  } catch (e) {
    document.body.append(el("p", { style: "position:fixed;inset:80px 20px auto;padding:20px;color:#ff6b5e;background:#1d1510;border:1px solid #ff6b5e;border-radius:10px" }, "Could not open the novel: " + e.message));
  }
}


// ===================================================================
//  BUTTONS AND KEYS
// ===================================================================

$("save").onclick = save;
$("undo").onclick = () => undo(true);
$("redo").onclick = () => undo(false);
$("exportbtn").onclick = exportText;
$("findbtn").onclick = findOpen;
$("fclose").onclick = findClose;
$("fq").addEventListener("input", findRun);
$("fq").addEventListener("keydown", e => { if (e.key === "Enter") { const r = $("fres").querySelector(".fr"); if (r) r.click(); } });
$("frall").onclick = () => {
  const q = $("fq").value, r = $("fr").value; if (!q) return;
  let n = 0;
  edit(() => S.labels.forEach(Lb => Lb.lines.forEach((l, i) => { const v = replaceIn(l, q, r); if (lit(v) !== lit(l)) { Lb.lines[i] = v; n++; } })));
  status(`Replaced in ${n} line${n === 1 ? "" : "s"}`, "dirty");
  findRun();
};
document.querySelectorAll(".tabs button").forEach(b => (b.onclick = () => showTab(b.dataset.tab)));
$("playscene").onclick = () => L() && play(L().name);
$("playstart").onclick = () => play(S.start);
$("pvreload").onclick = () => S.lastPlay ? play(...S.lastPlay) : play(S.start);
$("lfilter").addEventListener("input", e => { S.filter = e.target.value; renderLabels(); renderLabelBadges(S.lastChecks || []); });
$("addlabel").onclick = async () => {
  const n = await nameAsk("New scene"); if (!n) return;
  edit(() => { S.labels.splice(S.cur + 1, 0, { name: n, lines: [] }); S.cur++; S.sel = -1; });
};
$("lname").onclick = async () => {
  const old = L().name, n = await nameAsk("Rename scene", old); if (!n || n === old) return;
  edit(() => { L().name = n; renameRefs(old, n); });
};
$("dellabel").onclick = async () => {
  const me = L().name, used = S.labels.filter(x => x.lines.some(l => targets(l).includes(me))).map(x => x.name);
  const msg = `Delete "${me}" and its ${L().lines.length} lines?` + (used.length ? ` ${used.join(", ")} still jump${used.length === 1 ? "s" : ""} here.` : "") + " Undo brings it back.";
  if ((await ask("Delete scene", el("p", {}, msg))) !== "ok") return;
  edit(() => { S.labels.splice(S.cur, 1); S.cur = Math.max(0, S.cur - 1); if (!S.labels.length) S.labels.push({ name: "start", lines: [] }); });
};
$("uplabel").onclick = () => S.cur > 0 && edit(() => { [S.labels[S.cur - 1], S.labels[S.cur]] = [S.labels[S.cur], S.labels[S.cur - 1]]; S.cur--; });
$("downlabel").onclick = () => S.cur < S.labels.length - 1 && edit(() => { [S.labels[S.cur + 1], S.labels[S.cur]] = [S.labels[S.cur], S.labels[S.cur + 1]]; S.cur++; });
$("startlabel").onclick = () => edit(() => { S.start = L().name; });
$("backups").onclick = async () => {
  const { backups } = await api("/api/backups");
  let pick = null;
  const list = el("div", { class: "blist" }, ...(backups.length ? backups.map(b => el("button", { onclick: e => { e.preventDefault(); pick = b; $("dlgok").click(); } }, b.replace(/^story-(\d{4})(\d\d)(\d\d)-(\d\d)(\d\d)(\d\d)\.js$/, "$1-$2-$3  $4:$5:$6")))
    : [el("p", {}, "No backups yet. One is made every time you save.")]));
  if ((await ask("Load a backup", el("p", {}, "Loads it into the editor. Nothing is written until you save, and Undo takes it back."), list)) !== "ok" || !pick) return;
  const text = await (await fetch("/api/backup/" + encodeURIComponent(pick), { headers: { "X-Studio-Key": KEY } })).text();
  try { const sc = evalNovel(S.novel.actors, text); edit(() => { takeStory(sc); S.cur = 0; S.sel = -1; }); status("Loaded backup " + pick, "dirty"); }
  catch (e) { status("That backup does not read: " + e.message, "bad"); }
};
$("novels").onchange = async e => {
  const v = e.target.value, back = () => ($("novels").value = S.novel ? S.novel.dir : "");
  if (S.dirty && (await ask("Switch novel?", el("p", {}, "Your unsaved edits here stay in the browser and come back next time you open this novel."))) !== "ok") return back();
  try { if (await openNovel(v)) location.reload(); else back(); }
  catch (err) { status(err.message, "bad"); back(); }
};
$("adders").append(...Object.entries(KINDS).map(([k, [t, g]]) => el("button", { onclick: () => addLine(k), title: `Add a ${t.toLowerCase()} line` }, el("i", {}, g), t)));

addEventListener("keydown", e => {
  const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
  if (mod && k === "s") { e.preventDefault(); save(); }
  else if (mod && k === "f") { e.preventDefault(); findOpen(); }
  else if (e.key === "Escape" && !$("find").hidden) findClose();
  else if (mod && !typing && k === "z") { e.preventDefault(); undo(!e.shiftKey); }
  else if (mod && !typing && k === "y") { e.preventDefault(); undo(false); }
  else if (e.altKey && (e.key === "ArrowUp" || e.key === "ArrowDown") && S.sel >= 0) { e.preventDefault(); moveLine(S.sel, e.key === "ArrowUp" ? -1 : 1); focusLine(S.sel); }
  else if (mod && k === "d" && S.sel >= 0) { e.preventDefault(); const i = S.sel; edit(() => { L().lines.splice(i + 1, 0, clone(L().lines[i])); S.sel = i + 1; }); focusLine(i + 1); }
  else if (mod && e.key === "Enter" && L()) { e.preventDefault(); const cur = L().lines[S.sel]; addLine(cur === undefined ? "say" : ["say", "narr"].includes(kindOf(cur)) ? kindOf(cur) : "say"); }
});
$("pv").addEventListener("load", () => {
  try { $("pv").contentWindow.addEventListener("keydown", e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") { e.preventDefault(); save(); } }); } catch (e) {}
});
addEventListener("beforeunload", e => { if (S.dirty) { e.preventDefault(); e.returnValue = ""; } });

boot();
