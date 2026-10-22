"use strict";
/* ---------- vc-novel-studio: the little server behind the editor ----------
 *
 * A web page cannot write files to your disk, so this serves the editor and
 * does the reading and saving for it. Plain Node, no packages. It runs:
 *   - inside the VC Novel Studio app (main.js starts it), or
 *   - on its own for development:  node server.js [novel folder] [--port 8790] [--no-browser]
 *
 * It listens on 127.0.0.1 only, and every API call must carry the key it was
 * started with, so no web page in your browser can reach it.
 *
 * It only ever writes:
 *   - the open novel's story.js, when you press Save (the old one is copied to
 *     Documents/Vibe City/studio-backups/<novel>/ first, the last 50 kept)
 *   - a new novel folder, copied from the template, when you ask for one
 */
const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");

const KEEP = 50;
const NOVEL_FILES = ["vn.js", "story.js", "actors.js", "game.html"];
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".md": "text/plain; charset=utf-8", ".txt": "text/plain; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".svg": "image/svg+xml",
  ".ogg": "audio/ogg", ".mp3": "audio/mpeg", ".wav": "audio/wav", ".woff2": "font/woff2", ".ico": "image/x-icon",
};

const isNovel = d => !!d && NOVEL_FILES.every(f => fs.existsSync(path.join(d, f)));
const read = p => fs.readFileSync(p, "utf8");
// A path under base, or null if rel tries to climb out of it
function inside(base, rel) {
  const p = path.resolve(base, "." + path.sep + rel);
  if (!(p === base || p.startsWith(base + path.sep))) return null;
  try {   // and no symlink out of it either
    const rb = fs.realpathSync(base), rp = fs.realpathSync(p);
    return rp === rb || rp.startsWith(rb + path.sep) ? p : null;
  } catch { return p; }   // not there yet: the caller answers 404
}
// 20261020-153012-123, milliseconds so two quick saves never share a backup name
const stamp = () => new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").replace(".", "-").slice(0, 19);
const BACKUP = /^story-\d{8}-\d{6}(-\d{3})?\.js$/;
const same = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };

// Runs before vn.js in the preview: start at the chosen scene and line, skip the title.
const PREVIEW = `<script>(() => {
  const q = new URLSearchParams(location.search);
  if (!q.has("label")) return;
  SCRIPT.start = q.get("label");
  if (q.get("stage")) SCRIPT.stage = q.get("stage");
  if (q.get("line")) SCRIPT.startLine = +q.get("line");
  if (q.get("open") === "1") SCRIPT.galleryOpen = true;
  if (q.get("gate") !== "1") delete SCRIPT.ageGate;      // only the full play-through asks
  if (q.get("show") === "1") for (const a of Object.values(SCRIPT.actors)) a.hidden = false;
  try { SCRIPT.flags = Object.assign({}, SCRIPT.flags, JSON.parse(q.get("flags") || "{}")); } catch (e) {}
  const t = setInterval(() => {
    const el = document.getElementById("title"), b = document.getElementById("newbtn");
    if (el && b && !el.hidden) { clearInterval(t); b.click(); }
  }, 80);
})();</script>
`;

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const d of fs.readdirSync(from, { withFileTypes: true })) {
    if (d.name === ".DS_Store" || d.name === "Thumbs.db") continue;
    const a = path.join(from, d.name), b = path.join(to, d.name);
    if (d.isDirectory()) copyDir(a, b); else if (d.isFile()) fs.copyFileSync(a, b);
  }
}

/* opts:
 *   port      0 = any free port
 *   web       the editor's folder,        fonts  the game fonts
 *   roots     [{ dir, label }] folders whose sub folders are listed as novels
 *   template  a novel folder copied for New novel (or null)
 *   newIn     where New novel puts them
 *   backups   where saves keep the old story.js
 *   novel     the novel to open first
 *   pick      async () => folder or null   (the app's folder dialog, if any)
 *   onOpen    (dir) => {}                  (the app remembers the last one)
 */
function start(opts) {
  const key = crypto.randomBytes(16).toString("hex");
  let novel = isNovel(opts.novel) ? path.resolve(opts.novel) : null;
  let draft = null;       // the story.js being edited, served to the preview instead of the saved one

  const novels = () => {
    const out = [], seen = new Set();
    for (const r of opts.roots) {
      if (!fs.existsSync(r.dir)) continue;
      for (const n of fs.readdirSync(r.dir).sort()) {
        const d = path.join(r.dir, n);
        if (!seen.has(d) && isNovel(d)) { seen.add(d); out.push({ name: n, dir: d, where: r.label }); }
      }
    }
    if (novel && !seen.has(novel)) out.unshift({ name: path.basename(novel), dir: novel, where: "folder" });
    return out;
  };
  // one folder per novel: two copies with the same folder name (mods-dist and Documents) keep apart
  const backupName = () => path.basename(novel) + "-" + crypto.createHash("sha1").update(path.resolve(novel)).digest("hex").slice(0, 6);
  const backupDir = () => path.join(opts.backups, backupName());

  const send = (res, code, body, type = "application/json; charset=utf-8") => {
    if (body !== null && typeof body === "object" && !Buffer.isBuffer(body)) body = JSON.stringify(body);
    res.writeHead(code, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "same-origin" });
    res.end(body);
  };
  const file = (res, p, text) => {
    if (text == null) {
      if (!p || !fs.existsSync(p) || !fs.statSync(p).isFile()) return send(res, 404, "not found", "text/plain");
      text = fs.readFileSync(p);
    }
    send(res, 200, text, TYPES[path.extname(p).toLowerCase()] || "application/octet-stream");
  };
  const body = req => new Promise((ok, no) => {
    let b = "";
    req.on("data", c => { b += c; if (b.length > 20e6) { no(new Error("too big")); req.destroy(); } });
    req.on("end", () => { try { ok(JSON.parse(b || "{}")); } catch (e) { no(e); } });
  });

  async function api(req, res, p) {
    if (req.method === "GET" && p === "/api/novel") {
      if (!novel) return send(res, 400, { error: "No novel open.", none: true });
      let mod = {};
      try { mod = JSON.parse(read(path.join(novel, "mod.json"))); } catch (e) {}
      const engine = read(path.join(novel, "vn.js"));
      return send(res, 200, { dir: novel, name: path.basename(novel), mod,
        engine: { gallery: engine.includes("SCRIPT.gallery"), choices: engine.includes("SCRIPT.choices") },
        actors: read(path.join(novel, "actors.js")), story: read(path.join(novel, "story.js")) });
    }
    if (req.method === "GET" && p === "/api/novels")
      return send(res, 200, { current: novel, novels: novels(), canPick: !!opts.pick, canNew: !!opts.template && isNovel(opts.template), newIn: opts.newIn });
    if (req.method === "GET" && p === "/api/backups") {
      const d = novel && backupDir();
      return send(res, 200, { backups: d && fs.existsSync(d) ? fs.readdirSync(d).filter(n => BACKUP.test(n)).sort().reverse() : [] });
    }
    if (req.method === "GET" && p.startsWith("/api/backup/")) return file(res, novel && inside(backupDir(), decodeURIComponent(p.slice(12))));
    if (req.method !== "POST") return send(res, 404, { error: "not found" });

    const b = await body(req);
    if (p === "/api/draft") { draft = typeof b.story === "string" ? b.story : null; return send(res, 200, { ok: true }); }
    if (p === "/api/open") {
      let d = b.dir;
      if (d === "?pick") { d = opts.pick ? await opts.pick() : null; if (!d) return send(res, 200, { cancelled: true }); }
      d = path.resolve(String(d || ""));
      if (!isNovel(d)) return send(res, 400, { error: "That folder is not a visual novel. It needs vn.js, story.js, actors.js and game.html." });
      novel = d; draft = null;
      if (opts.onOpen) opts.onOpen(d);
      return send(res, 200, { ok: true });
    }
    if (p === "/api/new") {
      const name = String(b.name || "").trim();
      if (!/^[\w][\w .\-()]{0,63}$/.test(name)) return send(res, 400, { error: "Use letters, numbers, spaces, dots, dashes or brackets for the name." });
      if (!opts.template || !isNovel(opts.template)) return send(res, 400, { error: "The novel template is missing." });
      const d = path.join(opts.newIn, name);
      if (fs.existsSync(d)) return send(res, 400, { error: `There is already a folder called "${name}".` });
      copyDir(opts.template, d);
      // its own identity, so it never shares an id with the template or another novel
      try {
        const mp = path.join(d, "mod.json"), mod = JSON.parse(read(mp));
        mod.id = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "my_novel";
        mod.name = name; mod.label = name; mod.version = "0.1";
        if (mod.window) mod.window.title = name;
        fs.writeFileSync(mp, JSON.stringify(mod, null, 2) + "\n");
      } catch (e) {}
      novel = d; draft = null;
      if (opts.onOpen) opts.onOpen(d);
      return send(res, 200, { ok: true, dir: d });
    }
    if (p === "/api/save") {
      const text = b.story;
      if (!novel) return send(res, 400, { error: "No novel open." });
      if (typeof text !== "string" || !text.includes("SCRIPT.labels")) return send(res, 400, { error: "Refusing to save: that does not look like a story.js." });
      const src = path.join(novel, "story.js"), d = backupDir(), name = `story-${stamp()}.js`;
      fs.mkdirSync(d, { recursive: true });
      if (fs.existsSync(src)) fs.copyFileSync(src, path.join(d, name));
      for (const old of fs.readdirSync(d).filter(n => BACKUP.test(n)).sort().slice(0, -KEEP)) fs.rmSync(path.join(d, old));
      fs.writeFileSync(src + ".saving", text);
      fs.renameSync(src + ".saving", src);
      draft = null;
      return send(res, 200, { ok: true, backup: name, backups: d, dir: backupName() });
    }
    return send(res, 404, { error: "not found" });
  }

  const server = http.createServer(async (req, res) => {
    try {
      // only pages from this server: a web page pointing at 127.0.0.1 by another name gets nothing
      if (!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host || "")) return send(res, 403, "", "text/plain");
      if (req.headers["sec-fetch-site"] === "cross-site") return send(res, 403, "", "text/plain");
      const u = new URL(req.url, "http://x"), p = decodeURIComponent(u.pathname);
      if (p === "/" || p === "/index.html") return file(res, path.join(opts.web, "index.html"));
      if (p === "/favicon.ico") return send(res, 204, "");
      if (p.startsWith("/web/")) return file(res, inside(opts.web, p.slice(5)));
      if (p.startsWith("/fonts/")) return file(res, inside(opts.fonts, p.slice(7)));
      if (p.startsWith("/api/")) {
        if (!same(req.headers["x-studio-key"] || "", key)) return send(res, 403, { error: "wrong key" });
        return await api(req, res, p);
      }
      if (p.startsWith("/novel/")) {
        if (!novel) return send(res, 404, "no novel", "text/plain");
        const rel = p.slice(7) || "game.html", f = inside(novel, rel);
        if (rel === "story.js" && draft != null) return file(res, f, draft);
        if (rel === "game.html" && f && fs.existsSync(f)) {
          let html = read(f);
          const tag = '<script src="vn.js"></script>';
          html = html.includes(tag) ? html.replace(tag, PREVIEW + tag) : html.replace("</body>", PREVIEW + "</body>");
          return file(res, f, html);
        }
        return file(res, f);
      }
      send(res, 404, "not found", "text/plain");
    } catch (e) {
      send(res, 500, { error: String(e.message || e) });
    }
  });

  return new Promise((ok, no) => {
    server.on("error", no);
    server.listen(opts.port || 0, "127.0.0.1", () => {
      const port = server.address().port;
      ok({ server, port, key, url: `http://127.0.0.1:${port}/?k=${key}` });
    });
  });
}

// The usual places: Documents/Vibe City/mods (where the game reads mods), and
// next to this folder, the game's own mods-dist when run from the source.
function defaults(here, documents) {
  const vc = path.join(documents, "Vibe City");
  const roots = [{ dir: path.join(vc, "mods"), label: "installed" }];
  const mdist = path.resolve(here, "..", "mods-dist");
  if (fs.existsSync(mdist)) roots.unshift({ dir: mdist, label: "mods-dist" });
  const tmpl = path.resolve(here, "..", "templates");          // the Mod Kit repo layout
  if (fs.existsSync(tmpl)) roots.unshift({ dir: tmpl, label: "templates" });
  return { roots, newIn: path.join(vc, "mods"), backups: path.join(vc, "studio-backups") };
}

module.exports = { start, defaults, isNovel };

// ---- run on its own: node server.js [novel] [--port N] [--no-browser]
if (require.main === module) {
  const args = process.argv.slice(2);
  const flag = n => { const i = args.indexOf(n); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
  const port = +(flag("--port") || 8790);
  const browser = !args.includes("--no-browser");
  const rest = args.filter(a => a !== "--no-browser");
  const here = __dirname, d = defaults(here, path.join(os.homedir(), "Documents"));
  const guess = rest[0] ? path.resolve(rest[0]) : [path.resolve(here, "..", "templates", "visual-novel"), path.resolve(here, "..", "mods-dist", "whisker-lane")].find(isNovel);
  const template = [path.join(here, "template"), path.resolve(here, "..", "templates", "visual-novel"), path.resolve(here, "..", "mods-dist", "vb-visual-novel-template")].find(isNovel) || null;
  start({ port, web: path.join(here, "web"), fonts: [path.join(here, "fonts"), path.resolve(here, "..", "fonts")].find(f => fs.existsSync(f)) || here,
    ...d, template, novel: guess }).then(s => {
    console.log(`vc-novel-studio on ${s.url}\nCtrl+C to stop.`);
    if (browser) {
      const cmd = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
      require("child_process").spawn(cmd, [s.url], { detached: true, stdio: "ignore", shell: process.platform === "win32" }).unref();
    }
  }).catch(e => { console.error(e.code === "EADDRINUSE" ? `Port ${port} is busy. Try --port ${port + 1}.` : e); process.exit(1); });
}
