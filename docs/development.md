# Development

```
npm test          # engine rules, and the two plugins loaded together (engine/together.test.js)
npm run test:mod  # validate and test both plugins
npm run typecheck # types: the mod, then the Node scripts (audit, skin:check, skin:import, bench) with Node's
npm run sprites   # rebuild sprites/zoo.json, zoo.js and the icon
npm run skin:check <pack.json>        # check a skin pack with the mod's own rules
npm run skin:import <Codex pet folder> # turn a Codex pet into a skin pack
```

- `npm test` needs nothing but Node 20.
- `npm run typecheck` needs `npm install` first (TypeScript and Node's types, exact versions in `package.json`), and the mod's types, which are not in the repository: Claude Code writes them into `.claude-plugin/types/` when it loads the mod. Start it once from the clone with `claude --plugin-dir .` (2.1.275 or later), close it, then run the typecheck.
- `package-lock.json` is deliberately not in the repository: Claude Code's plugin installer installs every package a lockfile lists, and an installed plugin must pull nothing from npm.
- The repository's root is the pet's folder, and `lean/` inside it is the other plugin, whole: `claude --plugin-dir .` loads the pet, `claude --plugin-dir lean` loads cachito-lean, and both flags together load both. The eight lines are written once, in `lean/style.js`, which the pet imports.
- The numbers of the pet (stars, thresholds, waits) are in `RULES` in `engine/engine.js`; its lines in `engine/catalog.js` and `engine/lang/`.
- To add a language, copy `engine/lang/en.js` to a file of its own, translate the values and list it in `engine/lang/index.js`. `npm test` checks that it has every key, no exclamation mark, and no line wider than the bubble (44 columns on screen). A key a language lacks is said in English.
- Claude Code only for now; Codex support is planned.
