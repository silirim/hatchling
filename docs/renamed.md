# The earlier name

Until 2026-11-16 this project was called **Cachito** (the plugin `cachito`, the repository `silirim/cachito-pet`). It is now Hatchling. The command is still `/pet`, and briefox did not change. This is the one page that says the earlier name.

## Keep your pet

Claude Code keeps a store for each plugin by the plugin's name, and a plugin can read no store but its own. So Hatchling starts with an egg, and cannot fetch the pet Cachito kept. Carry it over yourself, once:

1. With the old plugin still installed, run `/pet export`. It writes `cachito-share/cachito-<name>-<date>.json` in your Claude Code config folder (`~/.claude`) and prints the path.
2. Install Hatchling and remove the old plugin: `/plugin install hatchling --marketplace silirim/hatchling`, then `/plugin uninstall cachito`.
3. Run `/pet import <that path>`, then `/pet import <that path> yes`.

A file exported under the earlier name is read as it is: stars, things, animals, name, choices and diary all come along. The egg that was there is saved first, as `/pet import` always does.

If you removed the old plugin before exporting, install it again, export, and go on from step 2: removing a plugin does not have to remove its store, but we do not promise that it stays.

## Folders and names that changed

| Earlier | Now | What to do |
|---|---|---|
| `~/.claude/cachito-skins/` | `~/.claude/hatchling-skins/` | move your skin packs: `mv ~/.claude/cachito-skins ~/.claude/hatchling-skins` |
| `~/.claude/cachito-share/` | `~/.claude/hatchling-share/` | nothing; delete the old folder when you no longer want its pictures and exports |
| `~/.claude/cachito-out/` | not used | long command outputs saved by an earlier version; they can hold secrets: delete it |
| a pack item or animal named `cachito` | `hatchling` is the reserved name | nothing |
| `CACHITO_BENCH`, `CACHITO_STYLE`, `CACHITO_PLAIN` | `HATCHLING_…` | the bench sets both, so a series run with an earlier copy of the mod runs again |

The measured history in [bench/RESULTS.md](../bench/RESULTS.md) keeps the names the plugins had when they were run.
