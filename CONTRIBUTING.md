# Contributing

Thanks for wanting to help. Mods, templates, tools and docs are all welcome.

## Ways to help

- **Share a mod.** Open an issue with a link and a screenshot, and it can be added to the showcase in the README.
- **Report a problem.** Say what you did, what you expected, what happened, and your OS and game version (About in the game).
- **Improve a template or the docs.** Small, focused pull requests are easiest to review.
- **Improve VC Novel Studio.** It is plain JavaScript with no framework: `studio/server.js`, `studio/main.js` and `studio/web/`.

## Guidelines

- Keep templates working as they are: someone should be able to copy one into `Documents/Vibe City/mods/` and see it run.
- No new runtime dependencies in the templates. Mod pages cannot reach the internet, so everything ships in the folder.
- Only add art you made or have the right to share, under the repo's license.
- Write docs plainly: short sentences, real examples.

## Running the Studio from source

```bash
cd studio
npm install
npm start
```
