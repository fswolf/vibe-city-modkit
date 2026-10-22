# vc-novel-studio

Edit the scenes of a Vibe City visual novel (any folder built on `vn.js`, like `templates/visual-novel` in this repo) and save them back to its `story.js`.

## Get it

- **Download:** prebuilt apps for Linux, Windows and macOS are on this repo's Releases page. Nothing to install.
- **From source:** you need Node.js.

```bash
cd studio
npm install            # once: Electron and electron-builder
npm start              # the app window
./studio.sh --browser  # or in your browser, at http://127.0.0.1:8790
./studio.sh ../templates/visual-novel   # open a novel folder
npm run build          # build the app yourself (Linux and Windows; npm run build:mac on a Mac)
```

- Novels are listed from `Documents/Vibe City/mods`, where the game reads mods, and from `../templates` when run from this repo.
- **New novel** (in the novel menu) copies the visual novel template into `Documents/Vibe City/mods` with its own id. **Open a folder** opens any novel folder.
- It reopens the last novel and remembers the window.
- Every save copies the old story.js into `Documents/Vibe City/studio-backups/<novel>-<id>/` first.

How it works: a web page cannot write files, so `server.js` (plain Node, no packages) serves the editor in `web/` and does the reading and saving. `main.js` starts it on a local port and shows it in a window. It only answers on 127.0.0.1, and every request needs the key it started with, so no web page can reach it.

## The screen

- **Top bar**: the novel, its size (scenes, lines, words, endings, reading time), find, undo, redo, export, backups, Save.
- **Scenes** (left): every label in story.js, in file order. A scene that does not jump away runs on into the next one, so order matters. Drag to reorder, filter by name. The gold tag is where the story starts, a star marks an ending, a red dot a scene with errors.
- **Checks** (left, under the scenes): jumps to scenes that do not exist, animations an actor does not have, unknown stages, flags never set, scenes nothing leads to, lines that can never be read, choice options with no text. Click one to go to it.
- **Lines** (middle): the open scene. Click the scene name to rename it (every jump to it follows). Each line is a card. Speech shows in the speaker's colour, click the name to change who says it. Hover a card for its tools: play from here, up, down, duplicate, code, delete. Drag by the number on the left.
- **Preview**: plays your unsaved edits in the novel's own engine. Play on a scene starts there, the play button on a line starts at that line. Set the stage and flags that point in the story expects. From the start shows the title screen exactly as a player gets it.
- **Map**: every scene and how they connect. Gold lines are choices, green ones conditions, dashed ones run on. Click a scene to open it.
- **Novel**: settings for the whole novel, saved into story.js:
  - Choice buttons: where they sit (top, middle, bottom, left, right) and how (stacked, side by side, two wide). A choice line can override it under its options.
  - Scenes menu: a Scenes button on the title screen with chosen scenes to replay, with their own stage, places, flags and picture. Locked until the player reaches them, or all open.
  - Adults only: a once only "are you 18 or older" gate before the title screen.

These need the new `vn.js` and `game.html` in the novel. The studio warns when a novel has the old ones.

## Line types

| Card | In story.js |
|---|---|
| Line | `"Kit: Hi there"`, or with an aside on the name tag, `"Mew (letter): Dear Kit"` |
| Narration | `"The city hums."` |
| Choice | `{ choice: [["Hug him", "hug"], { text: "Splash", goto: "splash", if: "fun >= 1", add: { fun: 1 } }], at: "bottom", layout: "row" }` |
| Jump | `{ goto: "walk" }` |
| If | `{ if: "trust >= 3", goto: "end_best", else: "end_friends" }` |
| Flags | `{ add: { trust: 1 }, set: { met: true } }`, typed as `trust+1 met=true` |
| Stage | `{ stage: "park", place: { a: .3, b: null } }`, place typed as `a=.3 b=off` |
| Action | any vb-animation-framework step, `{ a: "hug", b: "hug", hold: 1 }`, plus words shown while it plays. Quick add buttons fill in play, move, hold and wait. |
| End | `{ end: "Morning Light" }` |
| Note | `{ note: "..." }`, for you. The engine skips it. |

## Keys

| | |
|---|---|
| Ctrl+S | save (also while the preview has the keyboard) |
| Ctrl+Z, Ctrl+Y | undo, redo |
| Ctrl+F | find and replace in every scene |
| Ctrl+Enter | new line after the selected one (a new speech line picks the other speaker) |
| Ctrl+D | duplicate the selected line |
| Alt+Up, Alt+Down | move the selected line |

## Saving

Save writes story.js. The old one is copied to `Documents/Vibe City/studio-backups/<novel>-<id>/story-<date>-<time>.js` first, the last 50 are kept. Backups loads one back into the editor (nothing is written until you save, Undo takes it back).

Unsaved edits are also kept in the browser. If the tab closes or the computer crashes, the studio offers them back next time.

Export writes the whole story as a plain text script (speakers, choices, jumps) for proofreading or sharing with a co writer.

What a save keeps and what it rewrites:

- Kept: everything in story.js above `SCRIPT.start` (the header comment, any `const`), and `gap: HUG` stays `HUG`.
- Rewritten: the scenes, tidied, and the novel settings at the bottom. Any other `SCRIPT.something =` in story.js stops the save with a message (move it to actors.js), so nothing is dropped quietly. `//` comments inside the scenes are not kept (use Note cards). The first backup still has them.
- Not touched: actors.js (cast, stages, flags, title). Edit that by hand, then reload the studio.
