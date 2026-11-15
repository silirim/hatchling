import { expect, mock, test } from 'claude-code/testing'
import { STYLE, STYLE_ID } from '../style.js'

const ASK = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] } as any
const CORE = { id: 'intro', text: 'core', scope: 'shared' }

/** A session beneath the plugin: each request is answered over `ctx.tokens` of context. */
function world(on: any, env: Record<string, string> = {}, sections: any[] = [CORE]) {
  const ctx = { tokens: 1_000 }
  on('prompt.compose', () => ({ sections }) as any)
  on('command.register', () => ({ value: { command: 'lean' } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('env.get', (_: any, e: any) => ({ value: env[e.name] }))
  on('turn.step', async function* () { return { answer: '', toolUses: [], usage: { input_tokens: 10, cache_read_input_tokens: ctx.tokens, cache_creation_input_tokens: 0, output_tokens: 1 } } as any })
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'summary', toolUses: [], toolResults: [] }] }) as any)
  on('session.end', (_: any, e: any) => ({ sessionId: e.sessionId }) as any)
  on('command.run', () => ({ text: ABSENT }) as any)
  return ctx
}
// The repository's root is the pet's folder and holds this one too, so `claude plugin test .` there runs this file with the pet under
// test and this plugin not loaded. A kit cannot name the plugin under test, so each test asks: with nobody above the test's own
// hook to answer /lean, these tests have nothing to check. (The two plugins together are tested in hooks/register.test.ts at the root.)
const ABSENT = 'cachito-lean is not the plugin under test'
const absent = async ($: any) => ((await $.command.run({ command: 'lean', args: '' } as any)) as any).text === ABSENT
const kit = ($: any) => ({
  sections: async () => (await $.prompt.compose(ASK)).sections as any[],
  styled: async () => (await $.prompt.compose(ASK)).sections.some((s: any) => s.id === STYLE_ID) as boolean,
  turn: async () => { for await (const _ of $.turn.step({ model: 'claude-opus-5-5' } as any)) ; },
  lean: async (args = '') => ((await $.command.run({ command: 'lean', args } as any)) as any).text as string,
})

test('on as installed: the style is the last section, with nothing in the store; /lean off and /lean on switch it from the next prompt', async ($, on) => {
  world(on)
  const store = mock.store(on)
  const k = kit($)
  if (await absent($)) return
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(await k.sections()).toEqual([CORE, { id: STYLE_ID, text: STYLE, scope: 'session' }])
  expect(await k.lean()).toMatch(/^Lean on: the style is in the system prompt of every request\. \/lean off takes it out\. In our bench the style cost 14\.8% less on one long task .*no saving was shown/)
  expect(await k.lean()).toContain(STYLE)
  expect(JSON.stringify(store)).not.toMatch(/"off"/) // looking writes nothing

  expect(await k.lean('off')).toBe('Lean off: the style leaves the system prompt from your next prompt. /lean on puts it back.')
  expect(await k.sections()).toEqual([CORE])
  expect(await k.lean()).toMatch(/^Lean off/)
  expect(await k.lean('ON')).toMatch(/^Lean on: the style is in the system prompt from your next prompt\./)
  expect(await k.styled()).toBe(true)
  expect(await k.lean('maybe')).toBe('/lean shows the state, /lean on and /lean off switch the style.')
  expect(await k.styled()).toBe(true)
})

test('a store that cannot be read is no choice: the style stays on', async ($, on) => {
  world(on)
  on('store.get', () => { throw new Error('no store') })
  if (await absent($)) return
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: false })
  expect(await kit($).styled()).toBe(true)
})

test('in a long chat a switch waits for the next compaction or the next chat, and the reply says so', async ($, on) => {
  const ctx = world(on)
  mock.store(on)
  const k = kit($)
  if (await absent($)) return
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(await k.styled()).toBe(true)
  ctx.tokens = 70_000
  await k.turn()
  expect(await k.lean('off')).toBe('Lean off: the style leaves the system prompt at the next compaction or in the next chat: this chat is already long, and switching now would re-send the whole conversation. /lean on puts it back.')
  expect(await k.styled()).toBe(true) // still what the cache holds
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'old', toolUses: [], toolResults: [] }] } as any)
  expect(await k.styled()).toBe(false)

  await k.turn() // long again, now without the style
  expect(await k.lean('on')).toMatch(/^Lean on: the style is in the system prompt at the next compaction or in the next chat: this chat is already long/)
  expect(await k.styled()).toBe(false)
  await $.session.end({ reason: 'clear', sessionId: 's0', resume: { id: 's0' } } as any)
  expect(await k.styled()).toBe(true)
})

test('under the bench the choice kept on this machine stays out: the style is on', async ($, on) => {
  world(on, { CACHITO_BENCH: '/out/run' })
  on('store.get', () => ({ value: true })) // /lean off, given by the person some day
  if (await absent($)) return
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: false })
  expect(await kit($).styled()).toBe(true)
})

test('a section with the same id already there (the pet, with /pet lean on) is not sent twice, and /lean off names the other plugin', async ($, on) => {
  const theirs = { id: STYLE_ID, text: STYLE, scope: 'session' }
  world(on, {}, [CORE, theirs])
  mock.store(on)
  const k = kit($)
  if (await absent($)) return
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(await k.sections()).toEqual([CORE, theirs])
  expect(await k.lean('off')).toBe('Lean off: the style leaves the system prompt from your next prompt. /lean on puts it back. Another plugin still adds the same section: with the pet installed, /pet lean off.')
})
