import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { mkdtempSync, mkdirSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { block, inside, emptied } from './block.mjs'

const sleep = (/** @type {number} */ ms) => new Promise(r => setTimeout(r, ms))
// a child that was just started is in its folder a moment later, not at once
const seen = async (/** @type {string} */ dir) => { for (let i = 0; i < 100 && !inside([dir]).length; i++) await sleep(10) }

test('no check starts before the last session has ended, and the checks run one at a time', async () => {
  /** @type {string[]} */ const log = []
  let running = 0, checking = 0
  await block([['slow', 60], ['fast', 5], ['mid', 30]],
    async ([arm, ms]) => { running++; await sleep(Number(ms)); running--; log.push(`end ${arm}`); return String(arm) },
    async (arm) => { assert.equal(running, 0, `the check of ${arm} ran while a session was running`); assert.equal(checking++, 0, 'two checks at once'); log.push(`check ${arm}`); await sleep(5); checking-- },
    (all) => { assert.equal(running, 0); log.push(`settle ${all.length}`) })
  assert.deepEqual(log, ['end fast', 'end mid', 'end slow', 'settle 3', 'check slow', 'check fast', 'check mid'])
})

test('a run already done has no check, and a block with none does not settle', async () => {
  /** @type {string[]} */ const log = []
  await block(['a', 'b'], async (arm) => arm === 'a' ? undefined : arm, (arm) => { log.push(arm) }, () => { log.push('settle') })
  assert.deepEqual(log, ['settle', 'b'])
  await block(['a'], async () => undefined, () => { log.push('never') }, () => { log.push('never') })
  assert.deepEqual(log, ['settle', 'b'])
})

test('a process left in a clone is found, waited for, and killed when it outlasts the wait', { skip: process.platform !== 'linux' }, async () => {
  const root = realpathSync(mkdtempSync(join(tmpdir(), 'block-'))), a = join(root, 'a'), sub = join(a, 'pkg'), b = join(root, 'ab')
  for (const d of [sub, b]) mkdirSync(d, { recursive: true })
  const short = spawn('sleep', ['1'], { cwd: sub, stdio: 'ignore' }), other = spawn('sleep', ['30'], { cwd: b, stdio: 'ignore' })
  try {
    await seen(a); await seen(b)
    assert.deepEqual(inside([a]), [short.pid]) // below the folder; `ab` is not below `a`
    assert.deepEqual(await emptied([a], 5000, 20), []) // it ended by itself within the wait: nothing killed
    assert.deepEqual(inside([a]), [])
    const long = spawn('sleep', ['30'], { cwd: a, stdio: 'ignore' })
    await seen(a)
    assert.deepEqual(await emptied([a], 100, 20), [long.pid])
    assert.deepEqual(inside([a]), [])
    assert.deepEqual(inside([b]), [other.pid]) // a process elsewhere is left alone
  } finally { other.kill('SIGKILL'); rmSync(root, { recursive: true, force: true }) }
})
