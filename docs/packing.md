# Installing, packing and sharing

## Where mods go

`Documents/Vibe City/mods/` (on Linux `~/Documents/Vibe City/mods`). One folder per mod, or one packed `.asar` file. The game reads the folder each time it starts.

## Packing

Every template has `pack.sh`. It packs the mod folder into one archive, the way the game packs itself:

```bash
./pack.sh              # builds ../packed/<folder>.asar
./pack.sh --install    # and copies it into Documents/Vibe City/mods
```

Only files the game can use go in (pictures, pages, scripts, sounds, fonts, json, txt). README files and the script itself stay out. It needs Node.js; the first run fetches the `asar` tool with npx.

## Sharing

Share the `.asar` (or a zip of the folder). Before you do:

- Give `id` in mod.json a name only yours has (`yourname-bakery`). Saves remember buildings by it, so never change it once people have built yours.
- Bump `version` when you update it.
- Only include art you made or have the right to share.
