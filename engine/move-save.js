#!/usr/bin/env node
// @ts-check
// Writes the file of /pet export for the person alone (mode 0600): the mod's own $.fs.write cannot say a mode. Run with the file's
// path as the one argument and the text on standard input. Nothing else is read, and nothing is printed but an error.

import { mkdirSync, writeFileSync, chmodSync } from 'node:fs'
import { dirname } from 'node:path'

const file = process.argv[2]
let text = ''
process.stdin.setEncoding('utf8').on('data', d => { text += d }).on('end', () => {
  if (!file || !text.startsWith('{')) { console.error('move-save: a path and the JSON text are needed'); process.exit(2) }
  mkdirSync(dirname(file), { recursive: true })
  try { chmodSync(file, 0o600) } catch { /* not there yet */ } // a file that was there keeps its mode otherwise: closed before the text goes in
  writeFileSync(file, text, { mode: 0o600 })
})
