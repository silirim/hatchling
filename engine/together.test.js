// @ts-check
// The two plugins of this repository installed together: both hooks modules as they are, their prompt.compose hooks chained as the
// engine chains them, in either order. The style is written once (lean/style.js) and enters the system prompt once.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { register } from 'node:module'

// the pet's module imports the engine's own 'claude-code', which only the engine has: a stand-in holds its three functions
register('./stub/loader.js', import.meta.url)
const { register: pet } = await import('../hooks/register.js')
const { register: lean } = await import('../lean/hooks/register.js')
const { STYLE, STYLE_ID } = await import('../lean/style.js')
const catalog = await import('./catalog.js')

/** The hooks a module registers, by event. @param {(on: any) => void} register */
function hooksOf(register) {
  /** @type {Record<string, Function>} */ const hooks = {}
  register((/** @type {string} */ event, /** @type {any[]} */ ...rest) => { hooks[event] = rest.at(-1) })
  return hooks
}
/** What a plugin has of the engine here: an environment, and a store of its own. @param {Record<string, string>} env @param {Record<string, unknown>} disk */
const engine = (env, disk) => ({
  env: { get: async (/** @type {string} */ name) => env[name] },
  store: { get: async (/** @type {string} */ key) => disk[key], set: async (/** @type {string} */ key, /** @type {unknown} */ value) => { disk[key] = value }, keys: async () => Object.keys(disk), delete: async (/** @type {string} */ key) => { delete disk[key] } },
})
const CORE = { id: 'intro', text: 'core', scope: 'shared' }
const ASK = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] }

test('the style has one source: the pet sends the text and the id of lean/style.js, and neither hooks module writes them again', () => {
  assert.equal(catalog.STYLE, STYLE)
  assert.equal(catalog.STYLE_ID, STYLE_ID)
  assert.equal(STYLE.split('\n').filter(l => l.startsWith('- ')).length, 8)
  for (const file of ['../hooks/register.js', '../lean/hooks/register.js', './catalog.js']) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8')
    assert.ok(!source.includes('# Working lean') && !source.includes(STYLE_ID), `${file} writes the style or its id itself`)
  }
})

test('both installed: the style enters the system prompt once, whichever plugin is above and whichever is on', async () => {
  const petHooks = hooksOf(pet), leanHooks = hooksOf(lean)
  const petEnv = /** @type {Record<string, string>} */ ({ CACHITO_BENCH: '/out/run' }), leanDisk = /** @type {Record<string, unknown>} */ ({})
  const $pet = engine(petEnv, {}), $lean = engine({}, leanDisk) // the pet under the bench: its lever is the variable, its store is in memory
  const bottom = async () => ({ sections: [CORE] })
  for (const order of ['pet above', 'lean above']) {
    const [top, $top, low, $low] = order === 'pet above' ? [petHooks, $pet, leanHooks, $lean] : [leanHooks, $lean, petHooks, $pet]
    const composed = async () => (await /** @type {Function} */ (top['prompt.compose'])($top, ASK, () => /** @type {Function} */ (low['prompt.compose'])($low, ASK, bottom))).sections
    for (const [petOn, leanOn] of [[true, true], [true, false], [false, true], [false, false]]) {
      petEnv.CACHITO_STYLE = petOn ? '1' : ''
      leanDisk.off = !leanOn
      const sections = await composed()
      const styles = sections.filter((/** @type {any} */ s) => s.id === STYLE_ID || s.text === STYLE)
      assert.deepEqual(styles, petOn || leanOn ? [{ id: STYLE_ID, text: STYLE, scope: 'session' }] : [], `${order}, pet ${petOn}, lean ${leanOn}`)
      assert.equal(new Set(sections.map((/** @type {any} */ s) => s.id)).size, sections.length)
    }
  }
})

test('both installed, the pet with /pet lean never given: the pet asks the prompt and says lean on while cachito-lean sends the style, above it or below', async () => {
  const petHooks = hooksOf(pet), leanHooks = hooksOf(lean)
  const leanDisk = /** @type {Record<string, unknown>} */ ({})
  const $lean = engine({}, leanDisk), bottom = async () => ({ sections: [CORE] })
  // as the engine answers $.prompt.compose to the pet: through every other plugin's hook, and not through the pet's own
  const others = { prompt: { compose: async () => /** @type {Function} */ (leanHooks['prompt.compose'])($lean, ASK, bottom) } }
  const $pet = { ...engine({ CACHITO_BENCH: '/out/run', CACHITO_PLAIN: '1' }, {}), ...others, clock: { now: async () => 1_800_000_000_000 } }
  const leanSays = async () => String((await /** @type {Function} */ (petHooks['command.run'])($pet, { command: 'pet', args: 'lean' })).text)
  for (const order of ['pet above', 'lean above']) {
    const [top, $top, low, $low] = order === 'pet above' ? [petHooks, $pet, leanHooks, $lean] : [leanHooks, $lean, petHooks, $pet]
    const composed = async () => (await /** @type {Function} */ (top['prompt.compose'])($top, ASK, () => /** @type {Function} */ (low['prompt.compose'])($low, ASK, bottom))).sections
    leanDisk.off = false
    assert.equal((await composed()).filter((/** @type {any} */ s) => s.id === STYLE_ID).length, 1, order)
    assert.match(await leanSays(), /^Lean on: the cachito-lean plugin adds the style to the system prompt/, order)
    leanDisk.off = true // /lean off: from the next prompt the style is gone, and the pet says so
    assert.equal((await composed()).filter((/** @type {any} */ s) => s.id === STYLE_ID).length, 0, order)
    assert.match(await leanSays(), /^Lean off\. \/pet lean on adds the style/, order)
  }
})
