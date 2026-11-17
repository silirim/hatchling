import { expect, mock, test } from 'claude-code/testing'
import { BENCH, ID, TEXT } from '../text.js'

const ASK = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] } as any
const CORE = { id: 'intro', text: 'core', scope: 'shared' }

/** A session beneath the plugin: each request is answered over `ctx.tokens` of context. */
function world(on: any, env: Record<string, string> = {}, sections: any[] = [CORE]) {
  const ctx = { tokens: 1_000 }
  on('prompt.compose', () => ({ sections }) as any)
  on('command.register', () => ({ value: { command: 'briefox' } }))
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
// hook to answer /briefox, these tests have nothing to check. (The two plugins together are tested in hooks/register.test.ts at the root.)
const ABSENT = 'briefox is not the plugin under test'
const absent = async ($: any) => ((await $.command.run({ command: 'briefox', args: '' } as any)) as any).text === ABSENT
const kit = ($: any) => ({
  sections: async () => (await $.prompt.compose(ASK)).sections as any[],
  styled: async () => (await $.prompt.compose(ASK)).sections.some((s: any) => s.id === ID) as boolean,
  turn: async () => { for await (const _ of $.turn.step({ model: 'claude-opus-5-5' } as any)) ; },
  briefox: async (args = '') => ((await $.command.run({ command: 'briefox', args } as any)) as any).text as string,
})

test('on as installed: "Be brief." is the last section and its whole text, with nothing in the store; /briefox off and /briefox on switch it from the next prompt', async ($, on) => {
  world(on)
  const store = mock.store(on)
  const k = kit($)
  if (await absent($)) return
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(await k.sections()).toEqual([CORE, { id: 'briefox', text: 'Be brief.', scope: 'session' }])
  expect([ID, TEXT]).toEqual(['briefox', 'Be brief.'])
  expect(await k.briefox()).toBe(`Briefox on: "Be brief." is in the system prompt of every request. /briefox off takes it out. ${BENCH}. Every run: bench/RESULTS.md in the repository.`)
  expect(BENCH).toBe('In our bench "Be brief." made a long task cost 12.7% less, on one project; short tasks were not measured')
  expect(JSON.stringify(store)).not.toMatch(/"off"/) // looking writes nothing

  expect(await k.briefox('off')).toBe('Briefox off: "Be brief." leaves the system prompt from your next prompt. /briefox on puts it back.')
  expect(await k.sections()).toEqual([CORE])
  expect(await k.briefox()).toMatch(/^Briefox off/)
  expect(await k.briefox('ON')).toMatch(/^Briefox on: "Be brief\." is in the system prompt from your next prompt\./)
  expect(await k.styled()).toBe(true)
  expect(await k.briefox('maybe')).toBe('/briefox shows the state, /briefox on and /briefox off switch the sentence.')
  expect(await k.styled()).toBe(true)
})

test('a store that cannot be read is no choice: the sentence stays on', async ($, on) => {
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
  await k.turn() // the first request: where the chat starts
  ctx.tokens = 70_000
  await k.turn()
  expect(await k.briefox('off')).toBe('Briefox off: "Be brief." leaves the system prompt at the next compaction or in the next chat: this chat is already long, and switching now would re-send the whole conversation. /briefox on puts it back.')
  expect(await k.styled()).toBe(true) // still what the cache holds
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'old', toolUses: [], toolResults: [] }] } as any)
  expect(await k.styled()).toBe(false)

  await k.turn() // the first request after the compaction is the new start: big, and not long
  expect(await k.briefox('on')).toMatch(/^Briefox on: "Be brief\." is in the system prompt from your next prompt\./)
  expect(await k.styled()).toBe(true)
  expect(await k.briefox('off')).toMatch(/^Briefox off: "Be brief\." leaves the system prompt from your next prompt\./)
  expect(await k.styled()).toBe(false)
  ctx.tokens = 90_000
  await k.turn() // long again, now without the sentence
  expect(await k.briefox('on')).toMatch(/^Briefox on: "Be brief\." is in the system prompt at the next compaction or in the next chat: this chat is already long/)
  expect(await k.styled()).toBe(false)
  await $.session.end({ reason: 'clear', sessionId: 's0', resume: { id: 's0' } } as any)
  expect(await k.styled()).toBe(true)
})

test('a chat that starts big is not long: with 80k in its first request a switch applies at once, and waits only once the chat has grown', async ($, on) => {
  const ctx = world(on)
  mock.store(on)
  const k = kit($)
  if (await absent($)) return
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  ctx.tokens = 80_000 // the desktop app, or many MCP servers and skills: system prompt and tools alone
  await k.turn()
  expect(await k.briefox('off')).toBe('Briefox off: "Be brief." leaves the system prompt from your next prompt. /briefox on puts it back.')
  expect(await k.styled()).toBe(false)
  ctx.tokens = 90_000 // grown by 10k: still cheap
  await k.turn()
  expect(await k.briefox('on')).toMatch(/^Briefox on: "Be brief\." is in the system prompt from your next prompt\./)
  expect(await k.styled()).toBe(true)
  ctx.tokens = 96_000 // grown by 16k
  await k.turn()
  expect(await k.briefox('off')).toMatch(/at the next compaction or in the next chat: this chat is already long/)
  expect(await k.styled()).toBe(true)
})

test('under the bench the choice kept on this machine stays out: the sentence is on', async ($, on) => {
  world(on, { HATCHLING_BENCH: '/out/run' })
  on('store.get', () => ({ value: true })) // /briefox off, given by the person some day
  if (await absent($)) return
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: false })
  expect(await kit($).styled()).toBe(true)
})

test('a section with the same id already there (the pet, with /pet briefox on) is not sent twice, and /briefox off names the other plugin', async ($, on) => {
  const theirs = { id: ID, text: TEXT, scope: 'session' }
  world(on, {}, [CORE, theirs])
  mock.store(on)
  const k = kit($)
  if (await absent($)) return
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect(await k.sections()).toEqual([CORE, theirs])
  expect(await k.briefox('off')).toBe('Briefox off: "Be brief." leaves the system prompt from your next prompt. /briefox on puts it back. Another plugin still adds the same section: with the pet installed, /pet briefox off.')
})
