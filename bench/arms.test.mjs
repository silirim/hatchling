import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const HERE = import.meta.dirname

test('the arm `brief` adds one section, last and for the session, whose whole text is "Be brief."', async () => {
  // loaded by its path: the module is a plugin's, typed with the plugins (tsconfig.json), not with the bench
  const { register, BRIEF } = await import(join(HERE, 'arms/brief/hooks/register.js'))
  assert.equal(BRIEF, 'Be brief.')
  /** @type {Record<string, Function>} */ const hooks = {}
  register((/** @type {string} */ name, /** @type {Function} */ fn) => { hooks[name] = fn })
  assert.deepEqual(Object.keys(hooks), ['prompt.compose'])
  const core = { id: 'intro', text: 'core', scope: 'shared' }
  const r = await hooks['prompt.compose']?.({}, {}, async () => ({ sections: [core] }))
  assert.deepEqual(r, { sections: [core, { id: 'bench:brief', text: 'Be brief.', scope: 'session' }] })
})

test('run.mjs knows the arm `brief`', () => {
  // an arm it does not know stops run.mjs before it does anything, with the list of those it knows
  const r = spawnSync(process.execPath, [join(HERE, 'run.mjs'), join(tmpdir(), 'cachito-no-run'), '--arms', 'brief,no-such-arm'], { encoding: 'utf8' })
  assert.notEqual(r.status, 0)
  const known = /no arm "no-such-arm": (.*)/.exec(r.stderr)?.[1]?.split(', ')
  assert.ok(known?.includes('brief'), r.stderr)
})
