#!/usr/bin/env node
// @ts-check
// Writes the picture of /pet share: the mod cannot write bytes ($.fs.write takes text), so it runs this with the file's path as the
// one argument and the PNG in base64 on standard input. Nothing else is read, and nothing is printed but an error.

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const file = process.argv[2]
let text = ''
process.stdin.setEncoding('utf8').on('data', d => { text += d }).on('end', () => {
  const bytes = Buffer.from(text, 'base64')
  if (!file || bytes.subarray(1, 4).toString('latin1') !== 'PNG') { console.error('share-save: a path and a PNG in base64 are needed'); process.exit(2) }
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, bytes)
})
