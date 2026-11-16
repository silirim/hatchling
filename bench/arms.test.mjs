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

const EIGHT = `# Working lean
- Answer first, in short plain sentences. No preamble, no recap of what you just did, no closing offer. Every fact, number, path, command and warning stays exact and complete.
- Write the least code that fully does the task: reuse what the project has, and add no option, abstraction or dependency nobody asked for. Validation, error handling, security and the tests the change needs are never the part to cut.
- Lean is about what you add, never about care: new logic gets a test that covers its edge cases, a bug is fixed at its cause after checking who calls the code, and a change reaches every caller, test and fixture it breaks.
- When you skipped something or could not verify it, say so in one line at the end.
- Send independent read-only calls (reads, searches, listings) together in one message: every message of yours re-reads the whole conversation.
- Use what is already in context instead of reading an unchanged file again. In a long file, search for the part you need and read that range.
- Prefer commands whose output is bounded (a filter, a count, a head or tail) over printing whole files and logs.
- When the same command fails twice, stop and read the error before trying anything else.`

// each arm's section: its id and its whole text. `leanonly` keeps the id the eight lines were measured under
for (const [arm, [id, text]] of Object.entries({ brief: ['bench:brief', 'Be brief.'], mini: ['bench:mini', MINI], leanonly: ['cachito:style', EIGHT] })) {
  test(`the arm \`${arm}\` adds one section, last and for the session, with its whole text`, async () => {
    // loaded by its path: the module is a plugin's, typed with the plugins (tsconfig.json), not with the bench
    const { register } = await import(join(HERE, 'arms', arm, 'hooks/register.js'))
    /** @type {Record<string, Function>} */ const hooks = {}
    register((/** @type {string} */ name, /** @type {Function} */ fn) => { hooks[name] = fn })
    assert.deepEqual(Object.keys(hooks), ['prompt.compose'])
    const core = { id: 'intro', text: 'core', scope: 'shared' }
    const r = await hooks['prompt.compose']?.({}, {}, async () => ({ sections: [core] }))
    assert.deepEqual(r, { sections: [core, { id, text, scope: 'session' }] })
  })
}

test('the arms of bench/arms are one module: they differ only in their text and their name', () => {
  const file = (/** @type {string} */ arm, /** @type {string} */ f) => readFileSync(join(HERE, 'arms', arm, f), 'utf8')
  const arms = readdirSync(join(HERE, 'arms'))
  assert.deepEqual(arms.sort(), ['brief', 'leanonly', 'mini'])
  for (const arm of arms) {
    for (const f of ['hooks/register.js', 'hooks/hooks.json']) assert.equal(file(arm, f), file('brief', f), `${arm}/${f}`)
    assert.deepEqual(readdirSync(join(HERE, 'arms', arm), { recursive: true }).sort(), ['.claude-plugin', '.claude-plugin/plugin.json', 'hooks', 'hooks/hooks.json', 'hooks/register.js', 'text.js'])
    assert.equal(JSON.parse(file(arm, '.claude-plugin/plugin.json')).name, arm)
  }
})

test('the reading lines of `mini` are those of the eight lines, word for word, and its other lines are the heading and "Be brief."', () => {
  const style = EIGHT.split('\n'), [head, brief, ...reading] = MINI.split('\n')
  assert.equal(head, style[0])
  assert.equal(brief, '- Be brief.')
  assert.deepEqual(reading, style.slice(5, 8))
  assert.match(reading.join('\n'), /^- Send independent read-only calls.*\n- Use what is already in context.*\n- Prefer commands whose output is bounded/)
})

test('run.mjs knows the arms `brief`, `mini`, `leanonly` and `style`', () => {
  // an arm it does not know stops run.mjs before it does anything, with the list of those it knows
  const r = spawnSync(process.execPath, [join(HERE, 'run.mjs'), join(tmpdir(), 'hatchling-no-run'), '--arms', 'brief,no-such-arm'], { encoding: 'utf8' })
  assert.notEqual(r.status, 0)
  const known = /no arm "no-such-arm": (.*)/.exec(r.stderr)?.[1]?.split(', ')
  for (const arm of ['brief', 'mini', 'leanonly', 'style']) assert.ok(known?.includes(arm), r.stderr)
})

test('what briefox ships is what the arm `brief` was measured with: the same text, in a section of the same shape, added the same way', async () => {
  const { ID, TEXT } = await import(join(HERE, '../briefox/text.js'))
  const arm = await import(join(HERE, 'arms/brief/text.js'))
  assert.equal(TEXT, arm.TEXT)
  assert.equal(TEXT, 'Be brief.')
  /** The sections after a module's prompt.compose hook, over a prompt of one section. @param {string} file */
  const composed = async (file) => {
    const { register } = await import(join(HERE, file))
    /** @type {Record<string, Function>} */ const hooks = {}
    register((/** @type {string} */ name, /** @type {any[]} */ ...rest) => { hooks[name] = rest.at(-1) })
    const $ = { env: { get: async () => undefined }, store: { get: async () => undefined } } // as installed: no choice saved, no bench
    return (await hooks['prompt.compose']?.($, {}, async () => ({ sections: [{ id: 'intro', text: 'core', scope: 'shared' }] }))).sections
  }
  const [ours, theirs] = [await composed('../briefox/hooks/register.js'), await composed('arms/brief/hooks/register.js')]
  assert.deepEqual(ours, [{ id: 'intro', text: 'core', scope: 'shared' }, { id: ID, text: 'Be brief.', scope: 'session' }])
  // the id is the one thing that differs: it names the section among the plugins and is not sent to the model
  assert.deepEqual(ours.map((/** @type {any} */ s) => ({ ...s, id: '' })), theirs.map((/** @type {any} */ s) => ({ ...s, id: '' })))
})

test('the eight lines are shipped by nothing: only the bench arm `leanonly` holds them', () => {
  const ROOT = join(HERE, '..')
  const files = readdirSync(ROOT, { recursive: true, encoding: 'utf8' }).filter(f => /\.(js|mjs|ts|json)$/.test(f) && !/(^|\/)(node_modules|\.git|packs-private)\//.test(f) && !f.startsWith('bench/') && !f.startsWith('.claude-plugin/types/'))
  assert.ok(files.includes('briefox/hooks/register.js') && files.includes('hooks/register.js') && files.includes('engine/catalog.js'))
  for (const f of files) assert.ok(!readFileSync(join(ROOT, f), 'utf8').includes('# Working lean'), `${f} holds the eight lines`)
})
