"use strict";
/* ---------- VC Novel Studio, in its own window ----------
 * Starts server.js on a free local port and opens the editor in a window.
 * Run from the source:  ../release/node_modules/.bin/electron .   (or ./studio.sh)
 * Packaged by tools/build-studio.js for Linux, Windows and macOS.
 */
const { app, BrowserWindow, dialog, shell, Menu, screen } = require("electron");
const path = require("path");
const fs = require("fs");
const { start, defaults, isNovel } = require("./server");

const HERE = __dirname;
const CONFIG = () => path.join(app.getPath("userData"), "studio.json");
const readConfig = () => { try { return JSON.parse(fs.readFileSync(CONFIG(), "utf8")); } catch (e) { return {}; } };
const writeConfig = c => { try { fs.mkdirSync(path.dirname(CONFIG()), { recursive: true }); fs.writeFileSync(CONFIG(), JSON.stringify(c, null, 2)); } catch (e) {} };

let win = null;
if (!app.requestSingleInstanceLock()) { app.quit(); process.exit(0); }
app.on("second-instance", () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });

app.whenReady().then(async () => {
  Menu.setApplicationMenu(null);
  const d = defaults(HERE, app.getPath("documents"));
  for (const r of d.roots) if (r.label === "installed") fs.mkdirSync(r.dir, { recursive: true });
  const cfg = readConfig();
  const argNovel = process.argv.slice(app.isPackaged ? 1 : 2).find(a => !a.startsWith("-") && isNovel(path.resolve(a)));
  const first = [argNovel && path.resolve(argNovel), cfg.last, path.resolve(HERE, "..", "templates", "visual-novel"), path.resolve(HERE, "..", "mods-dist", "whisker-lane")].find(isNovel);
  const template = [path.join(HERE, "template"), path.resolve(HERE, "..", "templates", "visual-novel"), path.resolve(HERE, "..", "mods-dist", "vb-visual-novel-template")].find(isNovel) || null;
  const fonts = [path.join(HERE, "fonts"), path.resolve(HERE, "..", "fonts")].find(f => fs.existsSync(f)) || HERE;

  // the same port every time if it is free: unsaved drafts live in the page's storage, which belongs to the port
  const run = port => start({
    port, web: path.join(HERE, "web"), fonts, template, novel: first, ...d,
    pick: async () => {
      const r = await dialog.showOpenDialog(win, { title: "Open a visual novel folder", defaultPath: d.newIn, properties: ["openDirectory"] });
      return r.canceled ? null : r.filePaths[0];
    },
    onOpen: dir => writeConfig({ ...readConfig(), last: dir }),
  });
  const s = await run(cfg.port || 0).catch(() => run(0));
  if (s.port !== cfg.port) writeConfig({ ...readConfig(), port: s.port });

  let st = cfg.window || {};
  // a window saved on a screen that is gone opens in the middle instead
  if (st.x != null && !screen.getAllDisplays().some(({ workArea: w }) =>
      st.x < w.x + w.width - 80 && st.x + (st.width || 0) > w.x + 80 && st.y >= w.y - 20 && st.y < w.y + w.height - 80))
    st = { width: st.width, height: st.height, max: st.max };
  win = new BrowserWindow({
    width: st.width || 1500, height: st.height || 920, x: st.x, y: st.y, minWidth: 1000, minHeight: 620,
    title: "VC Novel Studio", backgroundColor: "#120d0a", show: false,
    icon: path.join(HERE, "icon.png"),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  if (st.max) win.maximize();
  win.once("ready-to-show", () => win.show());
  const remember = () => { if (!win.isMinimized()) writeConfig({ ...readConfig(), window: { ...win.getNormalBounds(), max: win.isMaximized() } }); };
  win.on("close", remember);

  // links out of the editor open in the real browser; nothing else may navigate the window
  const local = u => u.startsWith(`http://127.0.0.1:${s.port}/`);
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: "deny" }; });
  win.webContents.on("will-navigate", (e, url) => { if (!local(url)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  // the unsaved changes prompt the page asks for on close
  win.webContents.on("will-prevent-unload", e => {
    const c = dialog.showMessageBoxSync(win, { type: "question", buttons: ["Leave", "Stay"], defaultId: 1, cancelId: 1,
      message: "You have unsaved changes.", detail: "They are kept and offered back next time, but they are not in story.js yet." });
    if (c === 0) e.preventDefault();
  });
  win.loadURL(s.url);
});
app.on("window-all-closed", () => app.quit());
