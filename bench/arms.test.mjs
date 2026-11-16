import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const HERE = import.meta.dirname

const MINI = `# Working lean
- Be brief.
- Send independent read-only calls (reads, searches, listings) together in one message: every message of yours re-reads the whole conversation.
- Use what is already in context instead of reading an unchanged file again. In a long file, search for the part you need and read that range.
- Prefer commands whose output is bounded (a filter, a count, a head or tail) over printing whole files and logs.`

for (const [arm, text] of Object.entries({ brief: 'Be brief.', mini: MINI })) {
  test(`the arm \`${arm}\` adds one section, last and for the session, with its whole text`, async () => {
    // loaded by its path: the module is a plugin's, typed with the plugins (tsconfig.json), not with the bench
    const { register } = await import(join(HERE, 'arms', arm, 'hooks/register.js'))
    /** @type {Record<string, Function>} */ const hooks = {}
    register((/** @type {string} */ name, /** @type {Function} */ fn) => { hooks[name] = fn })
    assert.deepEqual(Object.keys(hooks), ['prompt.compose'])
    const core = { id: 'intro', text: 'core', scope: 'shared' }
    const r = await hooks['prompt.compose']?.({}, {}, async () => ({ sections: [core] }))
    assert.deepEqual(r, { sections: [core, { id: `bench:${arm}`, text, scope: 'session' }] })
  })
}

test('the arms of bench/arms are one module: they differ only in their text and their name', () => {
  const file = (/** @type {string} */ arm, /** @type {string} */ f) => readFileSync(join(HERE, 'arms', arm, f), 'utf8')
  const arms = readdirSync(join(HERE, 'arms'))
  assert.deepEqual(arms.sort(), ['brief', 'mini'])
  for (const arm of arms) {
    for (const f of ['hooks/register.js', 'hooks/hooks.json']) assert.equal(file(arm, f), file('brief', f), `${arm}/${f}`)
    assert.deepEqual(readdirSync(join(HERE, 'arms', arm), { recursive: true }).sort(), ['.claude-plugin', '.claude-plugin/plugin.json', 'hooks', 'hooks/hooks.json', 'hooks/register.js', 'text.js'])
    assert.equal(JSON.parse(file(arm, '.claude-plugin/plugin.json')).name, arm)
  }
})

test('the reading lines of `mini` are those of the style, word for word, and its other lines are the heading and "Be brief."', async () => {
  const { STYLE } = await import(join(HERE, '../lean/style.js'))
  const style = STYLE.split('\n'), [head, brief, ...reading] = MINI.split('\n')
  assert.equal(head, style[0])
  assert.equal(brief, '- Be brief.')
  assert.deepEqual(reading, style.slice(5, 8))
  assert.match(reading.join('\n'), /^- Send independent read-only calls.*\n- Use what is already in context.*\n- Prefer commands whose output is bounded/)
})

test('run.mjs knows the arms `brief` and `mini`', () => {
  // an arm it does not know stops run.mjs before it does anything, with the list of those it knows
  const r = spawnSync(process.execPath, [join(HERE, 'run.mjs'), join(tmpdir(), 'cachito-no-run'), '--arms', 'brief,no-such-arm'], { encoding: 'utf8' })
  assert.notEqual(r.status, 0)
  const known = /no arm "no-such-arm": (.*)/.exec(r.stderr)?.[1]?.split(', ')
  for (const arm of ['brief', 'mini']) assert.ok(known?.includes(arm), r.stderr)
})
