#!/usr/bin/env node
// @ts-check
// Checks one skin pack outside Claude Code, with the rules the mod uses (engine/skins.js): npm run skin:check <file>
// Says what the pack brings, or everything that is wrong with it, and ends with 1 when it would be left out.

import { readFileSync, statSync } from 'node:fs'
import { BUILTIN, LIMITS, parse } from './skins.js'
import { tidy } from './width.js'

const file = process.argv[2], shown = tidy(file) // the name of a stranger's file goes to the terminal too
if (!file) { console.error('usage: npm run skin:check <pack.json>'); process.exit(2) }
/** @type {string[]} */ let errors = []
/** @type {any} */ let pack = null
try {
  if (!statSync(file).isFile()) errors = ['file: not a regular file']
  else if (statSync(file).size > LIMITS.bytes) errors = [`file: larger than ${LIMITS.bytes / 1024} KiB`]
  else ({ pack, errors } = parse(readFileSync(file, 'utf8'), { taken: [...Object.keys(BUILTIN.species), ...Object.keys(BUILTIN.items), ...Object.keys(BUILTIN.coats)] }))
} catch (e) { errors = [`file: could not be read (${tidy(String(/** @type {any} */ (e)?.code ?? e), 80)})`] }
if (!pack) {
  console.error(`${shown}: not a sound pack, Hatchling would leave it out whole.\n${errors.map(e => `  ${tidy(e, 300)}`).join('\n')}`)
  process.exit(1)
}
const ids = (/** @type {unknown} */ group) => Object.keys(group ?? {}).join(', ') || '–'
console.log(`${shown}: sound. Pack "${tidy(pack.name)}" (${pack.id})\n  animals: ${ids(pack.animals)}\n  items:   ${ids(pack.items)}\n  coats:   ${ids(pack.coats)}${pack.credits ? `\n  credits: ${Object.entries(pack.credits).map(([k, v]) => `${k}: ${tidy(v)}`).join(', ')}` : ''}\nNames taken by another pack in your folder are only seen there: run /pet skins after installing it.`)
