# Community skin packs

Each file here is one skin pack: animals, things to wear or coats for Hatchling, made by the people who use it.
A pack is data, never code. The format is in [docs/skins.md](../docs/skins.md).

| Pack | Brings | By | Licence |
| --- | --- | --- | --- |
| [`seedling.json`](seedling.json) | a sprout for the head | the Hatchling authors | MIT |

## Install a pack

1. Copy its file to `~/.claude/hatchling-skins/` (with `CLAUDE_CONFIG_DIR`, to `$CLAUDE_CONFIG_DIR/hatchling-skins/`).
2. In Claude Code run `/pet skins`. It lists what the pack brings, and it is yours at once: no stars, no restart.
3. Put it on: `/pet wear sprout` for the pack above.

To take a pack away, delete its file.

## Propose a pack

1. Make it as [docs/skins.md](../docs/skins.md) says.
2. Check it: copy it to your own folder and run `/pet skins`, or from a clone run `npm run skin:check <file>`.
3. Open a pull request that adds one file, `packs/<id>.json`, named after the pack's `id`, and one row in the table above.

## What is accepted

- **Your own work, or work whose licence allows it.** The pack says so in its `credits`: `author` and `license` are required
  here, `source` when the work comes from somewhere else.
- **No real people, and no trademarked or copyrighted characters.** Not renamed ones either.
- **Pixels and text only.** A pack holds nothing else, and the format takes nothing else.
- **One pack per file**, and one file per pull request.
- **The file passes the test.** `npm test` reads every file of this folder with the check the mod uses
  (`engine/packs.test.js`): no fault, an `id` no other pack here has, and no name Hatchling or another pack here already uses.

A pack here is kept under the licence its `credits` state. We may decline a pack, or take one out later, when a rule above
turns out not to hold.
