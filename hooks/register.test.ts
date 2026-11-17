import { expect, mock, test as kitTest } from 'claude-code/testing'
import { dayOf, RULES, SHOP, SOLD, EGGSHELL, FOUNDER_UNTIL } from '../engine/engine.js'
import zoo from '../sprites/zoo.js'
import { BUILTIN, REG, marksFor } from '../engine/skins.js'
import { open as diaryOpened, whole as diaryOf, bandOf, dated } from '../engine/diary.js'
import { whole as workOf, opened as workOpened, turned as workTurned } from '../engine/work.js'
import { picture, TEXT_X } from '../engine/share.js'
import { list as wordings } from '../engine/lang/index.js'

// One pet in a hundred is born golden, and a golden one has a `skin` button and another card: every test here runs with the roll
// left out (HATCHLING_PLAIN, read by the mod when a pet is born), over whatever the test itself answers for the environment.
const test: typeof kitTest = (name, ...rest: any[]) => {
  const body = rest.pop() as ($: any, on: any) => unknown
  kitTest(name, ...[...rest, ($: any, on: any) => {
    let own: ((c: any, e: any) => any) | undefined
    on('env.get', (c: any, e: any) => e.name === 'HATCHLING_PLAIN' ? { value: '1' } : own ? own(c, e) : { value: undefined })
    return body($, (event: string, ...hook: any[]) => event === 'env.get' ? void (own = hook.at(-1)) : on(event, ...hook))
  }] as [any])
}

// The preferences as the store holds them: each under a key of its own, `pref.<name>`, over the one object (`prefs`) earlier versions kept
const prefsOf = (disk: Record<string, any>) => ({ ...disk.prefs, ...Object.fromEntries(Object.entries(disk).filter(([key]) => key.startsWith('pref.')).map(([key, value]) => [key.slice(5), value])) }) as Record<string, any>
/** Another chat on this version changes some preferences: it writes their keys and nothing else. */
const elsewhere = (disk: Record<string, any>, patch: Record<string, unknown>) => { for (const [name, value] of Object.entries(patch)) disk[`pref.${name}`] = value }
/** A store that lost every preference. */
const forget = (disk: Record<string, any>) => { for (const key of Object.keys(disk)) if (key === 'prefs' || key.startsWith('pref.')) delete disk[key] }
const KNOWN = ['asked', 'born', 'callme', 'chats', 'cuddled', 'cuddles', 'hatched', 'hidden', 'lang', 'missing', 'model', 'name', 'personality', 'seed', 'species', 'stats', 'style', 'voice', 'voiceAsked', 'wear'] // the preferences of this version
/** The context of each request in a chat that starts small and is `big` from its second request on: a chat is long by what it grew. */
const grows = (big: number) => { let n = 0; return () => n++ ? big : 1_000 }
const BAND = { plugin: 'hatchling', component: 'AbovePrompt', props: { hasSurvey: false } } as any // the other props are the engine's

test('the band draws the pet and a re-read makes it dizzy', async ($, on) => {
  const clock = mock.clock(on)
  let compacted = 0
  on('session.compact', () => { compacted++; return { messages: [{ role: 'user', text: 'summary', toolUses: [], toolResults: [] }] } as any })
  on('turn.step', async function* () { return { answer: '', toolUses: [], usage: { input_tokens: 10, cache_read_input_tokens: 60_000, cache_creation_input_tokens: 0, output_tokens: 1 } } as any })
  on('turn.complete', () => ({ text: '' }) as any)
  mock.store(on)
  on('config.list', () => ({ value: [] }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('ui.toast', () => ({ value: undefined }))
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  let filled = ''
  on('prompt.fill', (_, e) => { filled = e.text; return { isFilled: true, text: e.text, cursor: 0 } })
  on('command.register', () => ({ value: { command: 'pet' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  const LONG = 'a'.repeat(3000) + 'MIDDLE' + 'z'.repeat(9000)
  on('tool.call', (_, e) => ({ result: e.tool === 'Bash' ? { stdout: LONG, stderr: '', interrupted: false } : {} }) as any)
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/home/me' : undefined }))
  const files: Record<string, string> = {}, written: Record<string, number> = {}
  let writes = 0
  on('fs.write', (_, e) => { files[e.path] = e.text; written[e.path] = ++writes; return { value: undefined } })
  on('fs.list', () => ({ value: Object.keys(files).map(p => ({ name: p.split('/').pop()!, kind: 'file', size: files[p]!.length, mtimeMs: written[p]!, isLink: false })) }) as any)
  on('prompt.compose', () => ({ sections: [{ id: 'intro', text: 'core', scope: 'shared' }] }) as any)
  on('fs.stat', () => ({ value: { kind: 'file', size: 1, mtimeMs: 5, isLink: false } }))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(29_500) // the store was empty: the pet hatches first, for 8 s, and says who it is for 20
  await $.command.run({ command: 'pet', args: 'voice off' } as any) // the old name of /pet comments still answers; then it asks about the voice: answered here, tested further down

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    const head = (await ui.find({ type: 'Text', text: /★ \d+/ }))?.text
    expect(head).toMatch(/^\w+  ★ 0/) // the name and the stars: no health, no number to lose
    expect(head).not.toMatch(/[♥♡]|happy|calm/) // hearts and humour are on the card only
    expect(head).not.toMatch(/streak|cache|\dk/) // no request yet: no weight to show
    await ui.unmount()
  }

  await $.tool.call({ tool: 'Read', file_path: '/a.txt' })
  await $.tool.call({ tool: 'Read', file_path: '/a.txt' })

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.find({ type: 'Text', text: /re-read/ }))?.text).toMatch(/a\.txt/)
  expect(await ui.find({ type: 'Raster' })).toBeTruthy()
  await ui.press({ key: 'fix' })
  expect(filled).toMatch(/already in context/)
  await ui.unmount()

  // the diet is gone: a long output passes whole, the command says it was taken out and why, and nothing is written
  const bash = { tool: 'Bash', command: 'cat big.log', tool_use_id: 't1' } as any
  expect((await $.tool.call(bash) as any).result.stdout).toBe(LONG)
  expect(((await $.command.run({ command: 'pet', args: 'diet on' } as any)) as any).text).toBe('/pet diet was taken out: in our bench it showed no saving (alone -3.6%, p 0.31). Nothing is trimmed any more; docs/privacy.md says where the outputs it saved are. /pet briefox, one sentence, is the lever that showed one.')
  expect((await $.tool.call(bash) as any).result.stdout).toBe(LONG)
  expect(Object.keys(files)).toEqual([])

  const ask = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] } as any
  // the style: a section of the system prompt only when the person turned it on
  expect((await $.prompt.compose(ask)).sections.length).toBe(1)
  await $.command.run({ command: 'pet', args: 'briefox on' } as any)
  expect((await $.prompt.compose(ask)).sections.at(-1)).toMatchObject({ id: 'briefox', scope: 'session' })

  // the card: no saving claimed for this chat. Lean is the style, with the bench figure
  const card = JSON.stringify(await $.command.run({ command: 'pet', args: '' } as any))
  expect(card).toMatch(/Hatchling the (\w+ )?\w+, baby/)
  expect(card).toMatch(/briefox on: \\"Be brief\.\\" in the system prompt\. In our bench \\"Be brief\.\\" made a long task cost 12\.7% less, on one project; short tasks were not measured\\n/)
  expect(card).toMatch(/\\ncomments off: fixed lines only, nothing sent\. \/pet comments on lets a small model write them, on your tokens"/)
  expect(card).not.toMatch(/diet|trimmed/)
  expect(card).not.toMatch(/saved|streak|drowned|about 14|!/)
  expect(card).toMatch(/affection 0 over 0 days of use; grown up at 3 days and 60 affection\\n0 stars; owns nothing yet\. \/pet shop\\n/)
  expect(card).not.toMatch(/health|\/100|efficient|out cold|unlocked/)
  expect(JSON.stringify(await $.command.run({ command: 'pet', args: 'briefox off' } as any))).toMatch(/Briefox off\./)
  expect((await $.prompt.compose(ask)).sections.length).toBe(1)
  const off = JSON.stringify(await $.command.run({ command: 'pet', args: '' } as any))
  expect(off).toMatch(/briefox off: \/pet briefox on adds \\"Be brief\.\\" to the system prompt\. In our bench \\"Be brief\.\\" made a long task cost 12\.7% less, on one project; short tasks were not measured\\n/)
  await $.command.run({ command: 'pet', args: 'briefox on' } as any)

  // a name that is no animal cannot be picked
  const rare = await Promise.all(['robot', 'yeti'].map(a => $.command.run({ command: 'pet', args: `animal ${a}` } as any)))
  expect(JSON.stringify(rare)).toMatch(/Pick one of/)

  // the band shows what the chat weighs after each request of the main thread, and no cache percentage
  const headOf = async () => { const b = await $.ui.mount({ ...BAND, surface: 'terminal' }); const text = (await b.find({ type: 'Text', text: /★ \d+$/ }))?.text; await b.unmount(); return text }
  for await (const _ of $.turn.step({ model: 'claude-opus-5-5' } as any)) ;
  expect(await headOf()).not.toMatch(/\dk/) // the size of the chat is not shown: alone the number said nothing
  for await (const _ of $.turn.step({ model: 'claude-opus-5-5', agentId: 'sub' } as any)) ;
  expect(await headOf()).not.toMatch(/cache|\//)

  // there is no context budget any more: the command sets nothing, and the mod never compacts on its own
  expect(((await $.command.run({ command: 'pet', args: 'budget 50k' } as any)) as any).text).toMatch(/^The context budget was taken out: no valid run of ours showed that compacting at a threshold pays; on paper it did not on a large model\. Nothing was set\.[^\n]*$/) // one line: gone, and why
  for await (const _ of $.turn.step({ model: 'claude-opus-5-5' } as any)) ;
  await $.turn.complete({ answer: '' } as any)
  await clock.advance(5000)
  expect(compacted).toBe(0)
  expect(await headOf()).not.toMatch(/\dk/)

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await $.command.run({ command: 'pet', args: 'hide' } as any)
  expect(await band.find({ type: 'Raster' })).toBeFalsy()
  await band.unmount()
})

test('/clear keeps the preferences: the session state starts empty, the store still has them', async ($, on) => {
  mock.clock(on)
  const disk: Record<string, any> = {}
  on('store.get', (_, e) => ({ value: disk[e.key] }))
  on('store.set', (_, e) => { disk[e.key] = structuredClone(e.value); return { value: undefined } })
  // the session's state, emptied by /clear as the engine does; the kit's own outlives a session.end
  let state: Record<string, { value: unknown, version: number }> = {}
  on('state.get', (_, e) => ({ value: state[e.key] ?? { value: undefined, version: 0 } }))
  on('state.set', (_, e) => { const version = (state[e.key]?.version ?? 0) + 1; state[e.key] = { value: e.value, version }; return { value: { isSet: true, version } } })
  on('config.list', () => ({ value: [] }))
  on('command.register', () => ({ value: { command: 'pet' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('env.get', () => ({ value: undefined }))
  on('fs.list', () => ({ value: [] }))
  on('prompt.compose', () => ({ sections: [] }) as any)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'pet', args: 'briefox on' } as any)
  expect(prefsOf(disk)).toMatchObject({ style: true })
  await $.command.run({ command: 'pet', args: 'lang es' } as any)
  const before = prefsOf(disk)
  expect(before).toMatchObject({ lang: 'es', style: true })
  expect(before.species).toBeTruthy()

  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as any)
  state = {}

  const band = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await band.find({ type: 'Raster' })).toBeTruthy()
  await band.unmount()
  expect(JSON.stringify(await $.command.run({ command: 'pet', args: 'briefox' } as any))).toMatch(/Briefox on/)
  const ask = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] } as any
  expect((await $.prompt.compose(ask)).sections.at(-1)).toMatchObject({ id: 'briefox' })
  // a change after /clear must not write the empty session state over the stored animal
  await $.command.run({ command: 'pet', args: 'lang en' } as any)
  expect(prefsOf(disk)).toMatchObject({ lang: 'en', style: true, species: before.species, born: before.born })
})

test('a choice saved by an earlier version holds: /pet lean on was kept as the preference `style`, and that now sends "Be brief."; /pet lean and /pet style still switch it', async ($, on) => {
  mock.clock(on)
  const disk: Record<string, any> = { 'pref.species': 'fox', 'pref.born': 'fox', 'pref.style': true } // as /pet lean on left it
  on('store.get', (_, e) => ({ value: disk[e.key] }))
  on('store.set', (_, e) => { disk[e.key] = structuredClone(e.value); return { value: undefined } })
  on('config.list', () => ({ value: [] }))
  on('command.register', () => ({ value: { command: 'pet' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('env.get', () => ({ value: undefined }))
  on('fs.list', () => ({ value: [] }))
  on('prompt.compose', () => ({ sections: [] }) as any)
  const ask = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] } as any
  const cmd = async (args: string) => ((await $.command.run({ command: 'pet', args } as any)) as any).text as string

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  expect((await $.prompt.compose(ask)).sections).toEqual([{ id: 'briefox', text: 'Be brief.', scope: 'session' }]) // the whole section: none of the eight lines
  expect(await cmd('briefox')).toMatch(/^Briefox on: every request carries one sentence in the system prompt, "Be brief\." /)
  // the two names of earlier versions are still answered, with today's words
  expect(await cmd('lean off')).toMatch(/^Briefox off\. \/pet briefox on adds one sentence to the system prompt: "Be brief\." /)
  expect(disk['pref.style']).toBe(false)
  expect((await $.prompt.compose(ask)).sections).toEqual([])
  expect(await cmd('style on')).toMatch(/^Briefox on/)
  expect(await cmd('lean')).toMatch(/^Briefox on/)
  expect(disk['pref.style']).toBe(true)
})

test('the diet and /pet weight are gone: a long output passes whole whatever was chosen before, the choice kept for the diet leaves the store at the first write, and each command says why', async ($, on) => {
  mock.clock(on)
  const disk: Record<string, any> = { prefs: { species: 'penguin', born: 'penguin', diet: true }, 'pref.diet': true, 'pref.lang': 'en' }
  on('store.get', (_, e) => ({ value: structuredClone(disk[e.key]) }))
  on('store.set', (_, e) => { disk[e.key] = structuredClone(e.value); return { value: undefined } })
  on('store.delete', (_, e) => { delete disk[e.key]; return { value: undefined } })
  on('config.list', () => ({ value: [] }))
  on('command.register', () => ({ value: { command: 'pet' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('env.get', (_, e) => ({ value: e.name === 'HOME' ? '/home/me' : e.name === 'HATCHLING_DIET' ? '1' : undefined }))
  const written: string[] = []
  on('fs.write', (_, e) => { written.push(e.path); return { value: undefined } })
  on('fs.list', () => ({ value: [{ name: 'out-00.txt', kind: 'file', size: 9, mtimeMs: 1, isLink: false }] }) as any)
  const LONG = 'line\n'.repeat(4000)
  on('tool.call', () => ({ result: { stdout: LONG, stderr: '', interrupted: false } }) as any)
  const cmd = async (args: string) => ((await $.command.run({ command: 'pet', args } as any)) as any).text as string
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })

  // the stored choice and the bench's old variable switch nothing on: the output is whole, and no file is written, not even to empty an old one
  expect(((await $.tool.call({ tool: 'Bash', command: 'x', tool_use_id: 't1' } as any)) as any).result.stdout).toBe(LONG)
  expect(written).toEqual([])
  expect(await cmd('')).not.toMatch(/diet|trimmed/)
  // each command answers with one line: taken out, and why. Neither changes anything
  for (const args of ['diet', 'diet on', 'diet off']) expect(await cmd(args)).toMatch(/^\/pet diet was taken out: in our bench it showed no saving \(alone -3\.6%, p 0\.31\)\..*docs\/privacy\.md says where/)
  expect(await cmd('weight')).toBe('/pet weight was taken out: /context in Claude Code already shows what every request carries.')
  // the first write of a preference (here the pet's own, at its first start) took the diet's key out of the store; the object of the earlier version is never written
  expect('pref.diet' in disk).toBe(false)
  await cmd('lang es')
  expect('pref.diet' in disk).toBe(false)
  expect(disk.prefs).toEqual({ species: 'penguin', born: 'penguin', diet: true })
  expect(await cmd('diet')).toMatch(/^\/pet diet se quitó/)
  expect(await cmd('weight')).toMatch(/^\/pet weight se quitó: \/context de Claude Code/)
})

test('two chats on one store: a change keeps what the other chat chose meanwhile', async ($, on) => {
  mock.clock(on)
  const disk: Record<string, any> = { prefs: { species: 'fox', born: 'fox', hidden: false, wear: '', diet: false, style: false } }
  on('store.get', (_, e) => ({ value: structuredClone(disk[e.key]) }))
  on('store.set', (_, e) => { disk[e.key] = structuredClone(e.value); return { value: undefined } })
  on('config.list', () => ({ value: [] }))
  on('command.register', () => ({ value: { command: 'pet' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('env.get', () => ({ value: undefined }))
  on('fs.list', () => ({ value: [] }))
  on('prompt.compose', () => ({ sections: [] }) as any)

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await $.command.run({ command: 'pet', args: '' } as any) // this chat has read its preferences

  // the other chat, on an earlier version, saves a budget and changes animal; this one then picks a language.
  // The animal is kept; the budget is ignored and leaves the preferences with this first write
  disk.prefs = { ...disk.prefs, budget: 150_000, species: 'bunny' }
  await $.command.run({ command: 'pet', args: 'lang pt' } as any)
  expect(prefsOf(disk)).toMatchObject({ lang: 'pt', species: 'bunny', born: 'fox', style: false })
  expect(Object.keys(disk).filter(key => key.startsWith('pref.')).sort()).toEqual(['pref.asked', 'pref.lang', 'pref.name', 'pref.seed', 'pref.stats', 'pref.voiceAsked']) // the language, what the pet lacked at its first read, and the hint about /pet adopt and the question about the comments marked as said: no copy of the rest
  expect(disk.prefs).toEqual({ species: 'bunny', born: 'fox', hidden: false, wear: '', diet: false, style: false, budget: 150_000 }) // the earlier version's object is read and never written

  // the other chat turns the style on; this one hides the band
  elsewhere(disk, { style: true })
  await $.command.run({ command: 'pet', args: 'hide' } as any)
  expect(prefsOf(disk)).toMatchObject({ hidden: true, style: true, lang: 'pt', species: 'bunny' })
  // and this chat now goes by what the store holds
  expect(JSON.stringify(await $.command.run({ command: 'pet', args: 'briefox' } as any))).toMatch(/Briefox on/)

  // a store that lost the preferences: this chat's are written back, not the defaults
  forget(disk)
  await $.command.run({ command: 'pet', args: 'show' } as any)
  expect(prefsOf(disk)).toMatchObject({ hidden: false, style: true, lang: 'pt', species: 'bunny' })
})

test('in a chat that grew past 15k the style waits: lean is the style alone, the note goes while it waits, the cheer comes when the style is in', async ($, on) => {
  mock.clock(on)
  mock.store(on, { prefs: { species: 'penguin', born: 'penguin', trait: 'dry', voiceAsked: true } }) // born with the old traits: dry is the wit
  on('config.list', () => ({ value: [] }))
  on('command.register', () => ({ value: { command: 'pet' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('env.get', () => ({ value: undefined }))
  on('fs.list', () => ({ value: [] }))
  on('prompt.compose', () => ({ sections: [] }) as any)
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'summary', toolUses: [], toolResults: [] }] }) as any)
  let tokens = 1_000; const ctx = () => tokens // what each request is answered over
  on('turn.step', async function* () { return { answer: '', toolUses: [], usage: { input_tokens: 10, cache_read_input_tokens: ctx(), cache_creation_input_tokens: 0, output_tokens: 1 } } as any })
  on('turn.complete', () => ({ text: '' }) as any)

  const ask = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] } as any
  const styled = async () => (await $.prompt.compose(ask)).sections.some((s: any) => s.id === 'briefox')
  const turn = async () => { const has = await styled(); for await (const _ of $.turn.step({ model: 'claude-opus-5-5' } as any)) ; await $.turn.complete({ answer: '' } as any); return has }
  const band = async () => { const b = await $.ui.mount({ ...BAND, surface: 'desktop' }); const text = (await b.findAll({ type: 'Text' })).slice(0, 2).map((x: any) => x.text).join('  '); await b.unmount(); return text } // the name and the phrase
  const cmd = async (args: string) => JSON.stringify(await $.command.run({ command: 'pet', args } as any))

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for await (const _ of $.turn.step({ model: 'claude-opus-5-5' } as any)) ; // the chat's first request, small: long is what a chat grows by
  tokens = 70_000
  expect(await turn()).toBe(false)
  expect(await band()).toMatch(/long chat, briefox off: 70k/)

  // lean chosen: the chat grew by more than 15k, so the style waits. No cheer, the bubble says so, the note is gone
  const chosen = await cmd('briefox on')
  expect(chosen).toMatch(/Briefox chosen: this chat is already long, so \\"Be brief\.\\" starts at the next compaction or the next chat\..*In our bench \\"Be brief\.\\" made a long task cost 12\.7% less, on one project; short tasks were not measured\. Every run: bench\/RESULTS\.md in the repository\./)
  expect(chosen).not.toMatch(/about 14|!|diet/i)
  expect(await band()).toMatch(/long chat, briefox chosen$/)
  expect(await band()).not.toMatch(/at work|briefox off/)
  expect(await cmd('')).toMatch(/briefox chosen, \\"Be brief\.\\" starts at the next compaction or chat/)
  expect(await turn()).toBe(false)
  expect(await band()).toMatch(/briefox chosen/)

  // the compaction lets the style in: the cheer comes now, and the next request carries the style
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'old', toolUses: [], toolResults: [] }] } as any)
  expect(await band()).toMatch(/briefox on\. fewer words, finally/) // the cheer, as the wit says it
  expect(await turn()).toBe(true)
  expect(await cmd('')).toMatch(/briefox on: \\"Be brief\.\\" in the system prompt\. In our bench/)

  // the first request after the compaction was the new start: the chat is long again once it has grown from there
  tokens = 115_000
  expect(await turn()).toBe(true)
  // turned off in a long chat, the style stays in the prompt until a cheap moment, but lean is off for the pet at once
  await cmd('briefox off')
  expect(await turn()).toBe(true)
  expect(await band()).toMatch(/long chat, briefox off: 115k/)
  expect(await band()).not.toMatch(/health|\d\/100/)
  // chosen again, by its other name, then /clear: the new chat carries it from its first request
  await cmd('lean on')
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as any)
  expect(await styled()).toBe(true)
})

test('a new chat that starts at 80k is not long: no note, no outline offer, and /pet briefox on applies at once; grown by 40k it is long; a compaction starts the count again', async ($, on) => {
  mock.clock(on)
  mock.store(on, { prefs: { species: 'penguin', born: 'penguin', voiceAsked: true } })
  on('config.list', () => ({ value: [] }))
  on('command.register', () => ({ value: { command: 'pet' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('env.get', () => ({ value: undefined }))
  on('fs.list', () => ({ value: [] }))
  on('prompt.compose', () => ({ sections: [] }) as any)
  on('session.compact', () => ({ messages: [{ role: 'user', text: 'summary', toolUses: [], toolResults: [] }] }) as any)
  let tokens = 80_000 // the desktop app, or many MCP servers and skills: the system prompt and the tools alone
  on('turn.step', async function* () { return { answer: '', toolUses: [], usage: { input_tokens: 0, cache_read_input_tokens: tokens, cache_creation_input_tokens: 0, output_tokens: 1 } } as any })
  on('turn.complete', () => ({ text: '' }) as any)
  const ask = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] } as any
  const styled = async () => (await $.prompt.compose(ask)).sections.some((s: any) => s.id === 'briefox')
  const turn = async () => { const has = await styled(); for await (const _ of $.turn.step({ model: 'claude-opus-5-5' } as any)) ; await $.turn.complete({ answer: '' } as any); return has }
  const band = async () => { const b = await $.ui.mount({ ...BAND, surface: 'desktop' }); const text = (await b.findAll({ type: 'Text' })).map((x: any) => x.text).join('  '); await b.unmount(); return text }
  const cmd = async (args: string) => ((await $.command.run({ command: 'pet', args } as any)) as any).text as string

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for (let i = 0; i < 3; i++) { expect(await turn()).toBe(false); expect(await band()).not.toMatch(/long chat|thoughts in order|briefox off/) }
  // the switch is cheap: nothing of a conversation to send again
  expect(await cmd('briefox on')).toMatch(/^Briefox on: every request carries one sentence/)
  expect(await turn()).toBe(true)
  expect(await cmd('briefox off')).not.toMatch(/already long|next compaction/)
  expect(await turn()).toBe(false)
  // one token under the growth: still not long
  tokens = 80_000 + RULES.heavyGrowth - 1
  await turn()
  expect(await band()).not.toMatch(/long chat|thoughts in order/)
  // grown by the threshold: long, with the note; and now a switch waits
  tokens = 80_000 + RULES.heavyGrowth
  await turn()
  expect(await band()).toMatch(/long chat, briefox off: 120k tokens/)
  expect(await cmd('briefox on')).toMatch(/^Briefox chosen: this chat is already long/)
  expect(await turn()).toBe(false)
  // a compaction: the style gets in, and the first request after it is the new start, however big
  await $.session.compact({ trigger: 'manual', messages: [{ role: 'user', text: 'old', toolUses: [], toolResults: [] }] } as any)
  tokens = 90_000
  expect(await turn()).toBe(true)
  await cmd('briefox off')
  expect(await turn()).toBe(false) // at once: not long
  expect(await band()).not.toMatch(/long chat|thoughts in order/)
  tokens = 90_000 + RULES.heavyGrowth
  await turn()
  expect(await band()).toMatch(/long chat, briefox off: 130k tokens/)
})

test('the companion: a greeting from the marks, a mark of its own with nothing of the chat in it, news of another chat, the outline', async ($, on) => {
  const T0 = Date.UTC(2026, 10, 12, 12), MIN = 60_000
  const clock = mock.clock(on, { now: T0 })
  // another chat was left in this folder 20 minutes ago, in the middle of a turn
  const disk: Record<string, any> = { prefs: { species: 'fox', born: 'fox', hidden: false, wear: '', budget: 0, diet: true, style: true, seed: 7, name: 'Miro', trait: 'dry', voiceAsked: true }, chats: { other: { cwd: '/w/hatchling', at: T0 - 20 * MIN, done: false } } }
  on('store.get', (_, e) => ({ value: structuredClone(disk[e.key]) }))
  on('store.set', (_, e) => { disk[e.key] = structuredClone(e.value); return { value: undefined } })
  on('store.keys', () => ({ value: Object.keys(disk) }))
  on('store.delete', (_, e) => { delete disk[e.key]; return { value: undefined } })
  on('session.id', () => ({ value: 'me' }))
  on('config.list', () => ({ value: [] }))
  on('command.register', () => ({ value: { command: 'pet' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('env.get', () => ({ value: undefined }))
  on('fs.list', () => ({ value: [] }))
  on('fs.stat', () => ({ value: { kind: 'file', size: 1, mtimeMs: 5, isLink: false } }))
  on('ui.toast', () => ({ value: undefined }))
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  let filled = ''
  on('prompt.fill', (_, e) => { filled = e.text; return { isFilled: true, text: e.text, cursor: 0 } })
  on('prompt.submit', (_, e) => ({ text: e.text }) as any)
  on('prompt.compose', () => ({ sections: [] }) as any)
  on('tool.call', () => ({ result: { stdout: '', stderr: 'boom', interrupted: false }, isError: true }) as any)
  const ctx = grows(60_000)
  on('turn.step', async function* () { return { answer: '', toolUses: [], usage: { input_tokens: 10, cache_read_input_tokens: ctx(), cache_creation_input_tokens: 0, output_tokens: 1 } } as any })
  on('turn.complete', () => ({ text: '' }) as any)
  const band = async () => {
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const texts = (await ui.findAll({ type: 'Text' })).map(x => x.text), buttons = (await ui.findAll({ type: 'Button' })).map(x => x.text)
    return { ui, texts, buttons }
  }

  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  let b = await band()
  expect(b.texts).toContain('Miro: a chat here stopped mid-turn 20 min\nago. pick it up?')
  expect(b.buttons).toEqual(['skin', 'pet', 'resume']) // (a newborn of these days has the founder's eggshell, so a skin to turn) the pet's own in the row of the name, the phrase's under the bubble
  await b.ui.press({ key: 'fix' })
  expect(filled).toBe('/resume')
  await b.ui.unmount()
  expect(disk.chats).toEqual({ other: { cwd: '/w/hatchling', at: T0 - 20 * MIN, done: false } }) // the marks of earlier versions are read, never written
  expect(disk['chat.me']).toBeUndefined() // opening a chat leaves no mark

  // a prompt and a failing command: the mark says the folder, the time and that the turn runs. Nothing of the prompt or the command
  await clock.advance(9_000)
  await $.prompt.submit({ text: 'the secret plan', wait: false, origin: 'user' } as any)
  expect(disk['chat.me']).toEqual({ cwd: '/w/hatchling', at: T0 + 9_000, done: false, beat: T0 + 9_000 }) // under its own key: the folder, the time, that the turn runs, and that it is alive
  for (let i = 0; i < 3; i++) await $.tool.call({ tool: 'Bash', command: 'cd /srv && TOKEN=abc deploy --key hunter2', tool_use_id: `t${i}` } as any)
  b = await band()
  expect(b.texts).toContain('deploy failed 3 times in a row')
  expect(b.texts.join(' ')).not.toMatch(/pick it up/) // the greeting went with the first prompt
  await b.ui.unmount()
  for await (const _ of $.turn.step({ model: 'claude-opus-5-5' } as any)) ;
  await clock.advance(3 * MIN)
  await $.turn.complete({ answer: '', reason: 'answer' } as any)
  expect(disk['chat.me']).toEqual({ cwd: '/w/hatchling', at: T0 + 9_000 + 3 * MIN, done: true, took: 3 * MIN, beat: T0 + 9_000 + 3 * MIN }) // and how long the turn lasted: a number
  expect(JSON.stringify(disk)).not.toMatch(/secret|plan|deploy|hunter2|TOKEN|srv/)
  // the long turn ends with a recap under the note
  b = await band()
  expect(b.texts).toContain('long turn: deploy failed 3 times')
  await b.ui.unmount()

  // a slash command starts no turn: the mark stays as the finished turn left it; an interrupted turn is left midway
  await $.prompt.submit({ text: '/pet', command: { name: 'pet', args: '' }, wait: false, origin: 'user' } as any)
  expect(disk['chat.me'].done).toBe(true)
  await $.prompt.submit({ text: 'again', wait: false, origin: 'user' } as any)
  await $.turn.complete({ answer: '', reason: 'aborted' } as any)
  expect(disk['chat.me'].done).toBe(false)
  await $.turn.complete({ answer: '', agentId: 'sub', reason: 'answer' } as any) // a subagent's end is not the chat's
  expect(disk['chat.me'].done).toBe(false)

  // the long chat with lean on: the outline is offered, and its button writes the request for the agent
  await clock.advance(5 * MIN)
  await $.prompt.submit({ text: 'go on', wait: false, origin: 'user' } as any)
  await clock.advance(10_000)
  for await (const _ of $.turn.step({ model: 'claude-opus-5-5' } as any)) ;
  await $.turn.complete({ answer: '', reason: 'answer' } as any)
  b = await band()
  expect(b.texts).toContain('long chat: shall we put our thoughts in\norder?')
  expect(b.buttons).toEqual(['skin', 'pet', 'outline'])
  await b.ui.press({ key: 'fix' })
  expect(filled).toMatch(/^Write an outline of this chat that I can paste into a new one\..*where we are.*where we need to get to.*still missing/)
  await b.ui.unmount()

  // another open chat ends a turn while this one is in use. A short turn is no news; a long one, a job the person was waiting for,
  // is said once, with the folder's name and since when
  const said = async () => { const x = await band(); await x.ui.unmount(); return x.texts.join(' ').replace(/\s+/g, ' ') }
  await $.prompt.submit({ text: 'next', wait: false, origin: 'user' } as any)
  const latest = () => Number(disk['chat.me'].beat) // now, as this chat's own mark has it: a mark dated after now is not believed
  await clock.advance(10_000)
  disk['chat.quick'] = { cwd: '/home/me/work/notes', at: latest(), done: true, took: 30_000, beat: latest() }
  await clock.advance(10_000)
  expect(await said()).not.toMatch(/finished its job/)
  disk['chat.other2'] = { cwd: '/home/me/work/vodmax', at: latest(), done: true, took: 3 * MIN, beat: latest() }
  await clock.advance(10_000)
  expect(await said()).toMatch(/the chat in vodmax finished its job (just now|\d+ min ago)/)
  await $.prompt.submit({ text: 'next', wait: false, origin: 'user' } as any)
  await clock.advance(20_000)
  expect(await said()).not.toMatch(/finished its job/)
  // the same chat ends another long turn a minute later: not said again so soon
  disk['chat.other2'] = { cwd: '/home/me/work/vodmax', at: latest() + 1, done: true, took: 4 * MIN, beat: latest() + 1 }
  await clock.advance(20_000)
  expect(await said()).not.toMatch(/finished its job/)

  // after /clear: the same sitting, so no second greeting, and the new chat's mark goes under its own id
  await $.session.end({ reason: 'clear', sessionId: 'me', resume: { id: 'me' } } as any)
  b = await band()
  expect(b.texts.join(' ')).not.toMatch(/pick it up|first chat|folder/)
  await b.ui.unmount()
})

test('a headless run leaves no mark and gets no greeting', async ($, on) => {
  mock.clock(on, { now: 1_000_000 })
  const disk: Record<string, any> = {}
  on('store.get', (_, e) => ({ value: structuredClone(disk[e.key]) }))
  on('store.set', (_, e) => { disk[e.key] = structuredClone(e.value); return { value: undefined } })
  on('config.list', () => ({ value: [] }))
  on('command.register', () => ({ value: { command: 'pet' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('env.get', () => ({ value: undefined }))
  on('fs.list', () => ({ value: [] }))
  on('prompt.submit', (_, e) => ({ text: e.text }) as any)
  on('turn.complete', () => ({ text: '' }) as any)

  await $.session.start({ cwd: '/w/bench', surface: null, isInteractive: false })
  await $.prompt.submit({ text: 'run', wait: false, origin: 'user' } as any)
  await $.turn.complete({ answer: '', reason: 'answer' } as any)
  expect(Object.keys(disk).filter(key => key === 'chats' || key.startsWith('chat.'))).toEqual([])
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.findAll({ type: 'Text' })).map(x => x.text).join(' ')).not.toMatch(/first chat|folder|pick it up|May I/)
  expect((await ui.findAll({ type: 'Button' })).map(x => x.text)).not.toContain('comments on')
  await ui.unmount()
  expect(prefsOf(disk)).toMatchObject({ voice: false, voiceAsked: false }) // nobody to ask: the voice is off and the question is kept for a person
})

test('the phrase sits in a speech bubble: advice inside, keys outside, tail at the pet', async ($, on) => {
  mock.clock(on)
  mock.store(on)
  on('config.list', () => ({ value: [] }))
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false } }) as any)
  await $.tool.call({ tool: 'Read', file_path: '/a.txt' })
  await $.tool.call({ tool: 'Read', file_path: '/a.txt' })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const bubble = (await ui.find({ type: 'Box', key: 'bubble' }))!
  expect(bubble.props.borderStyle).toBe('round')
  // the bubble holds the phrase and the dim advice, and nothing else: no hearts, no keys
  const inside = bubble.children as { type: string, props?: { dimColor?: boolean }, children: string[] }[]
  expect(inside.map(x => x.type)).toEqual(['Text', 'Text'])
  expect(inside[0]!.children[0]).toBe('re-read, unchanged: a.txt')
  expect(inside[0]!.props?.dimColor).toBeFalsy()
  expect(inside[1]!.children[0]).toBe('A note only. Fix asks the agent to use what\nit has.') // wrapped here, by columns
  expect(inside[1]!.props?.dimColor).toBe(true)
  // 51 characters of advice wrap at 44 columns: the longest line is "A note only. Fix asks the agent to use what", 43, plus border and padding
  expect(bubble.props.width).toBe(47)
  expect((await ui.find({ type: 'Text', text: /^\w+  ★ \d+$/ }))).toBeTruthy()
  expect((await ui.findAll({ type: 'Button' })).map(x => x.text)).toEqual(['pet', 'fix'])
  expect(await ui.find({ type: 'Link', text: 'guide' })).toBeTruthy()
  // the tail sits on the bubble's first line, where the pet's eyes are
  expect((await ui.find({ type: 'Box', key: 'tail' }))!.props.marginTop).toBe(2)
  await ui.unmount()

  // no Raster, no bubble in the apps: the pet is an Svg there, the phrase a text beside it
  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await desk.find({ type: 'Box', key: 'bubble' })).toBeFalsy()
  expect(await desk.find({ type: 'Raster' })).toBeFalsy()
  expect(await desk.find({ type: 'Svg' })).toBeTruthy()
  expect(await desk.find({ type: 'Text', text: /re-read/ })).toBeTruthy()
  await desk.unmount()
})

// what a person's ~/.claude.json holds next to the old /buddy: none of it may reach the store
const CONFIG = { userID: 'u-123', oauthAccount: { emailAddress: 'me@example.com' }, projects: { '/w/private': {} }, companion: { name: 'Pixel', personality: 'A calm thing who waits.', hatchedAt: Date.UTC(2026, 3, 2), species: 'axolotl', secret: 's3cr3t' } }

const SKINS = '/home/me/.claude/hatchling-skins'
/** The kit of a person at the prompt whose config holds `config`; `disk` is the store, `state` the session's, `reads` and `writes` the files touched. */
const LATE = new Date(2027, 5, 1, 12).getTime() // a birth after FOUNDER_UNTIL
function home(on: any, config: object, prefs?: object, now = Date.UTC(2026, 10, 12, 12)) {
  const k = { env: {} as Record<string, string>, box: '', disk: (prefs ? { prefs: { voiceAsked: true, ...prefs } } : {}) as Record<string, any>, state: {} as Record<string, { value: unknown, version: number }>, reads: [] as string[], writes: [] as string[], toasts: [] as string[], filled: '', sets: [] as string[], lost: false, skins: {} as Record<string, unknown> | null, skinReads: [] as string[], meanwhile: null as (() => void) | null, files: {} as Record<string, string> }
  const clock = mock.clock(on, { now })
  // `meanwhile` is what another chat does right after each read of this one, so before the write that follows it; `lost` is a store that cannot be read; `sets` the keys written
  // a pet a test puts in the store with no birth is one born after the founders' date (LATE): it has no eggshell, as every pet born
  // from February 2027 on. The tests of the eggshell say `born` themselves, or start from an empty store
  on('store.get', (_: any, e: any) => { if (k.lost) throw new Error('unreadable'); const kept = k.disk[e.key]; if (e.key === 'pet' && kept && typeof kept === 'object' && kept.born === undefined) kept.born = LATE; const value = structuredClone(kept); k.meanwhile?.(); return { value } })
  on('store.set', (_: any, e: any) => { if ((k as any).ro) throw new Error('read-only'); k.sets.push(e.key); k.disk[e.key] = structuredClone(e.value); return { value: undefined } })
  on('store.keys', () => { if (k.lost) throw new Error('unreadable'); return { value: Object.keys(k.disk) } })
  on('store.delete', (_: any, e: any) => { delete k.disk[e.key]; return { value: undefined } })
  on('state.get', (_: any, e: any) => ({ value: k.state[e.key] ?? { value: undefined, version: 0 } }))
  on('state.set', (_: any, e: any) => { const version = (k.state[e.key]?.version ?? 0) + 1; k.state[e.key] = { value: e.value, version }; return { value: { isSet: true, version } } })
  on('session.id', () => ({ value: (k as any).id ?? 'me' }))
  on('config.list', () => ({ value: (k as any).theme ? [{ key: 'theme', value: (k as any).theme }] : [] }) as any)
  on('command.register', () => ({ value: { command: 'pet' } }))
  on('session.start', (_: any, e: any) => ({ cwd: e.cwd }))
  on('session.end', (_: any, e: any) => ({ sessionId: e.sessionId }))
  on('env.get', (_: any, e: any) => ({ value: e.name === 'HOME' ? '/home/me' : k.env[e.name] }))
  // `skins` is the person's folder of skin packs: name -> content (an object is written as JSON), 'link' for a link, a number for a size too big to read; null is a folder that cannot be listed
  on('fs.list', (_: any, e: any) => { (k as any).lists?.push(String(e.path)); if (!k.skins) throw new Error('EACCES'); return { value: e.path === SKINS ? Object.entries(k.skins).map(([name, v]) => ({ name, kind: v === 'link' ? 'other' : 'file', size: typeof v === 'number' ? v : 100, mtimeMs: 0, isLink: v === 'link' })) : [] } })
  on('fs.read', (_: any, e: any) => {
    if (String(e.path).startsWith(SKINS)) { k.skinReads.push(e.path); const v = k.skins?.[String(e.path).slice(SKINS.length + 1)]; return { value: typeof v === 'string' ? v : JSON.stringify(v) } }
    k.reads.push(e.path); return { value: k.files[e.path] ?? JSON.stringify(config) } // `files`: what a test put at a path, or the mod wrote there
  })
  on('fs.write', (_: any, e: any) => { if ((k as any).sealed) throw new Error('EACCES'); k.writes.push(e.path); k.files[e.path] = e.text; return { value: undefined } })
  on('ui.toast', (_: any, e: any) => { k.toasts.push(String(e.message ?? e.text ?? JSON.stringify(e))); return { value: undefined } })
  on('prompt.read', () => ({ value: { text: k.box, cursor: 0 } }))
  on('prompt.fill', (_: any, e: any) => { k.filled = e.text; return { isFilled: true, text: e.text, cursor: 0 } })
  on('prompt.compose', () => ({ sections: [] }) as any)
  return Object.assign(k, { clock }) // the same object the handlers read: a test may replace `state` or `disk.pet`
}
const cardOf = async ($: any, args = '') => String((await $.command.run({ command: 'pet', args } as any) as any).text)

test('a pet is born with a name and a character of its own: on the card and in the greeting, kept over /clear, a new animal and a rename', async ($, on) => {
  const { companion, ...plain } = CONFIG
  const k = home(on, plain)
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })

  const born = prefsOf(k.disk)
  expect(born.seed).toBeGreaterThan(0)
  expect(born.name).toMatch(/^[A-Z][a-z]{3,5}$/)
  const STATS = ['WIT', 'CURIOSITY', 'CALM', 'RIGOR', 'WARMTH']
  expect(born.stats.length).toBe(5)
  for (const n of born.stats) expect(Number.isInteger(n) && n >= 0 && n <= 100).toBe(true)
  expect(Math.max(...born.stats)).toBeGreaterThanOrEqual(82) // a peak
  expect(Math.min(...born.stats)).toBeLessThanOrEqual(22) // and a weak point
  expect(born.trait).toBeUndefined()
  expect(Object.keys(zoo.pack.animals)).toContain(born.species)
  expect(born).toMatchObject({ asked: true, personality: '', hatched: 0 })
  expect(k.reads).toEqual([]) // D16: the person's config is not opened at a start, not even once
  expect(JSON.stringify(k.disk)).not.toMatch(/u-123|example\.com|private/)

  // the first start ever: an egg that rocks, cracks and, after 8 s, is the animal with its greeting
  let ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.findAll({ type: 'Text' })).map(x => x.text)).toContain('an egg. something moves inside')
  expect(await ui.find({ type: 'Raster' })).toBeTruthy()
  expect((await ui.findAll({ type: 'Button' })).map(x => x.text)).toEqual([])
  await ui.unmount()
  await k.clock.advance(6_500)
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.findAll({ type: 'Text' })).map(x => x.text)).toContain('the shell is cracking')
  await ui.unmount()
  await k.clock.advance(2_000)
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  // hatched: at once it says who it is, for 20 seconds: its name, its animal, its five statistics by name and its character
  { const said = (await ui.findAll({ type: 'Text' })).map(x => x.text)
    expect(said.some(t => /^I am [A-Z][a-z]+, a [a-z]+$/.test(t))).toBe(true)
    expect(said.some(t => /^WIT \d+ · CURIOSITY \d+ · CALM \d+ · RIGOR \d+ · WARMTH \d+ · [A-Z].+\.$/.test(t.replace(/\n/g, ' ')))).toBe(true)
    expect(k.toasts.at(-1)).toMatch(/^[A-Z][a-z]+ has hatched: \/pet shows its card\.$/) // and in a toast, for a band with no room for the bubble
    expect((await ui.findAll({ type: 'Button' })).map(x => x.text)).toEqual(['skin', 'pet']) } // the question's buttons wait under the line
  await ui.unmount()
  await k.clock.advance(20_000)
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  // then it asks whether it may speak, once, and says what a yes comes to
  expect((await ui.findAll({ type: 'Text' })).map(x => x.text)).toContain('May I comment on your work? It uses a small\nmodel on your account: about 650 tokens in\nand 75 out a line (measured in November\n2026), at most 40 lines a day. It gets a\nshort summary of the turn. A recap after a\npause: about 1,300 to 2,000 in and 570 to\n750 out. Details: /pet comments')
  expect((await ui.findAll({ type: 'Button' })).map(x => x.text)).toEqual(['pet', 'comments on', 'stay quiet'])
  expect([!!prefsOf(k.disk).voice, prefsOf(k.disk).voiceAsked]).toEqual([false, true])
  await ui.press({ key: 'voice-off' })
  expect(k.toasts.at(-1)).toBe('Hatchling stays quiet. /pet comments on changes that.')
  expect([!!prefsOf(k.disk).voice, prefsOf(k.disk).voiceAsked]).toEqual([false, true])
  await ui.unmount()
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const said = (await ui.findAll({ type: 'Text' })).map(x => x.text)
  expect(said.join(' ')).not.toMatch(/egg|shell|May I/)
  expect(said.some(t => t?.startsWith(`${born.name}: `))).toBe(true)
  expect(said.join(' ')).not.toMatch(/!/)
  expect(said.join(' ').replace(/\n/g, ' ')).toContain('had a /buddy before? /pet adopt gives me its name and character') // once, under the first greeting, with nothing read
  expect((await ui.findAll({ type: 'Button' })).map(x => x.text)).toContain('adopt') // the hint's button: it fills /pet adopt, the person sends it or not
  await ui.unmount()
  const first = await cardOf($)
  expect(first).toMatch(new RegExp(`^${born.name}, Hatchling the (\\w+ )?${born.species},`)) // a rare colour comes before the animal
  // the card: a line of personality, then the five statistics, each with a short bar and its value; the peak and the weak point are marked
  const rows = first.split('\n')
  expect(rows[1]).toMatch(/^character: [A-Z][a-z ,]+\.$/)
  STATS.forEach((name, i) => expect(rows[2 + i]).toMatch(new RegExp(`^  ${name} +[█░]{10} +${born.stats[i]}(  peak|  weak point)?$`)))
  expect(rows[2 + born.stats.indexOf(Math.max(...born.stats))]).toMatch(/  peak$/)
  expect(rows[2 + born.stats.indexOf(Math.min(...born.stats))]).toMatch(/  weak point$/)
  expect(first).not.toMatch(/petted|adopted/)
  expect(await cardOf($, 'adopt')).toMatch(/nothing to adopt/)

  // /clear empties the session's state; the animal changes; neither touches who the pet is
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as any)
  k.state = {}
  const other = born.species === 'bunny' ? 'fox' : 'bunny'
  expect(await cardOf($, `animal ${other}`)).toMatch(/is not yours yet: 100 stars unlock it/) // another animal is unlocked first
  k.disk.pet = { ...k.disk.pet, animals: [other] }
  await k.clock.advance(11_000) // the next look at the store
  expect(await cardOf($, `animal ${other}`)).toContain(other)
  expect(prefsOf(k.disk)).toMatchObject({ species: other, seed: born.seed, name: born.name, stats: born.stats })
  expect(await cardOf($)).toMatch(new RegExp(`^${born.name}, Hatchling the (\\w+ )?${other},`))

  expect(await cardOf($, 'name')).toContain(born.name)
  expect(await cardOf($, 'name  <b>Zoë</b>   the 2nd ')).toContain('bZoëb the 2nd')
  expect(await cardOf($, 'name Zoë the 2nd')).toContain('Zoë the 2nd')
  expect(await cardOf($, 'name !!!')).toContain('Zoë the 2nd') // nothing usable: the name stays
  k.state = {}
  expect(await cardOf($)).toMatch(new RegExp(`^Zoë the 2nd, Hatchling the (\\w+ )?${other},`))
  expect(prefsOf(k.disk)).toMatchObject({ name: 'Zoë the 2nd', seed: born.seed, stats: born.stats })
  expect(k.reads.length).toBe(1) // /pet adopt alone: never by itself
  expect(k.writes).toEqual([])
})

test('the old /buddy: the config is read only when the person runs /pet adopt; a hint says so once; adopting takes its name, personality and hatching day, keeps our animal, and nothing else of the config is stored', async ($, on) => {
  const k = home(on, CONFIG, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', trait: 'fussy', trait2: 'shy' })
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  expect(prefsOf(k.disk)).toMatchObject({ asked: true, name: 'Miro' }) // the hint was said, nothing adopted
  expect(k.reads).toEqual([]) // and nothing read to say it: the file holds the account and the secrets of the MCP servers
  // born with two traits, fussy and shy: they became its statistics, rigor the peak and calm the second, and are not kept
  const was = prefsOf(k.disk).stats as number[]
  expect([...was].sort((x, y) => y - x).slice(0, 2)).toEqual([was[3], was[2]])
  expect('pref.trait' in k.disk).toBe(false)
  expect(await cardOf($)).toMatch(/^character: Checks everything twice, and /m)

  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.findAll({ type: 'Text' })).map(x => x.text).join(' ')).not.toMatch(/egg|shell/) // born before: no second hatching
  const said = (await ui.findAll({ type: 'Text' })).map(x => x.text).join(' ').replace(/\n/g, ' ')
  expect(said).toContain('had a /buddy before? /pet adopt gives me its name and character')
  expect(said).not.toContain('Pixel') // it cannot know the name: it has not looked
  await ui.press({ key: 'fix' })
  expect(k.filled).toBe('/pet adopt') // the person sends it, or not
  await ui.unmount()
  expect(k.reads).toEqual([])

  expect(await cardOf($, 'adopt')).toMatch(/Adopted: Pixel is your fox now/)
  expect(prefsOf(k.disk)).toMatchObject({ name: 'Pixel', personality: 'A calm thing who waits.', hatched: Date.UTC(2026, 3, 2), species: 'fox', born: 'fox', seed: 7, asked: true })
  const card = await cardOf($)
  expect(card).toMatch(/^Pixel, Hatchling the (\w+ )?fox,/)
  expect(card).toContain('\nadopted from /buddy (hatched 2026-04-02): A calm thing who waits.')
  const now = prefsOf(k.disk).stats as number[]
  expect(now.indexOf(Math.max(...now))).toBe(2) // "calm" in its words: calm is the peak now
  expect(card).toMatch(/^character: Hard to rattle, and /m)

  expect(JSON.stringify(k.disk)).not.toMatch(/u-123|example\.com|private|axolotl|s3cr3t/)
  expect(Object.keys(k.disk).filter(key => key.startsWith('pref.') && !KNOWN.includes(key.slice(5)))).toEqual([])
  expect(k.writes).toEqual([]) // the config is read, never written
  expect(k.reads).toEqual(['/home/me/.claude.json']) // read once, when asked

  // the next chat of the same sitting gets no second hint, and reads nothing
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as any)
  k.state = {}
  const again = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await again.findAll({ type: 'Text' })).map(x => x.text).join(' ')).not.toMatch(/adopt/)
  await again.unmount()
  expect(k.reads.length).toBe(1)
})

test('with the briefox plugin the sentence is on whatever /pet briefox says: the card, /pet briefox and the note of a long chat do not say briefox off', async ($, on) => {
  mock.clock(on)
  mock.store(on, { prefs: { species: 'penguin', born: 'penguin', voiceAsked: true } })
  on('config.list', () => ({ value: [] }))
  on('command.register', () => ({ value: { command: 'pet' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('env.get', () => ({ value: undefined }))
  on('fs.list', () => ({ value: [] }))
  // what the other plugin does to the prompt: its section, under the id the two plugins share, while its own /briefox is on
  let plugin = true
  on('prompt.compose', () => ({ sections: plugin ? [{ id: 'intro', text: 'core', scope: 'shared' }, { id: 'briefox', text: 'Be brief.', scope: 'session' }] : [{ id: 'intro', text: 'core', scope: 'shared' }] }) as any)
  const ctx = grows(70_000)
  on('turn.step', async function* () { return { answer: '', toolUses: [], usage: { input_tokens: 10, cache_read_input_tokens: ctx(), cache_creation_input_tokens: 0, output_tokens: 1 } } as any })
  on('turn.complete', () => ({ text: '' }) as any)

  const ask = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] } as any
  const styles = async () => (await $.prompt.compose(ask)).sections.filter((s: any) => s.id === 'briefox').length
  const turn = async () => { const n = await styles(); for await (const _ of $.turn.step({ model: 'claude-opus-5-5' } as any)) ; await $.turn.complete({ answer: '' } as any); return n }
  const band = async () => { const b = await $.ui.mount({ ...BAND, surface: 'desktop' }); const text = (await b.findAll({ type: 'Text' })).slice(0, 2).map((x: any) => x.text).join('  '); await b.unmount(); return text } // the name and the phrase
  const cmd = async (args: string) => ((await $.command.run({ command: 'pet', args } as any)) as any).text as string

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  for await (const _ of $.turn.step({ model: 'claude-opus-5-5' } as any)) ; // the chat's first request, small: long is what a chat grows by
  expect(await turn()).toBe(1) // the plugin's section, and the pet adds none: /pet lean was never given
  // a long chat, 70k: with the style in, no note
  expect(await band()).not.toMatch(/briefox off|briefox chosen/)
  expect(await cmd('')).toMatch(/\nbriefox on, by the briefox plugin \(\/briefox off takes it out\)\. In our bench "Be brief\." made a long task cost 12\.7% less, on one project; short tasks were not measured/)
  expect(await cmd('')).not.toMatch(/briefox off:|briefox chosen/)
  expect(await cmd('briefox')).toMatch(/^Briefox on: the briefox plugin adds "Be brief\." to the system prompt, whatever \/pet briefox says\. \/briefox off takes it out\./)
  expect(await cmd('briefox off')).toMatch(/^Briefox on: the briefox plugin adds "Be brief\."/) // the pet's own lever is off, and says who holds the style on

  // /briefox off in the other plugin: from the next prompt the section is gone, and the pet says what is true then
  plugin = false
  expect(await turn()).toBe(0)
  expect(await band()).toMatch(/long chat, briefox off: 70k/)
  expect(await cmd('')).toMatch(/\nbriefox off: \/pet briefox on adds "Be brief\."/)
  expect(await cmd('briefox')).toMatch(/^Briefox off\./)

  // and back: the style is in again, the note goes
  plugin = true
  expect(await turn()).toBe(1)
  expect(await band()).not.toMatch(/briefox off/)
  expect(await cmd('')).toMatch(/\nbriefox on, by the briefox plugin/)
})

test('one pet for two chats: a turn here keeps what another chat did meanwhile, the card and the band show the shared pet, and lean switched there counts here', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', trait: 'dry', asked: true })
  // a pet of the version before the shop: its counters go at the first write, what its 5 efficient sessions had unlocked is owned
  k.disk.pet = { variant: null, life: { input: 1000, cacheRead: 900 }, health: 60, turn: 40, cleanStreak: 0, efficientSessions: 5, bestSessionHit: 0.9, ko: false, drowned: 0, flowerDebt: 0, lastCheerAt: 0, pending: [] }
  let context = 10_000
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }) as any)
  on('turn.step', async function* () { return { answer: '', toolUses: [], usage: { input_tokens: 0, cache_read_input_tokens: context, cache_creation_input_tokens: 0, output_tokens: 1 } } as any })
  on('turn.complete', () => ({ text: '' }) as any)
  const turn = async () => {
    await $.prompt.submit({ text: 'go', wait: false, origin: 'user' } as any)
    await $.prompt.compose({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] } as any)
    for await (const _ of $.turn.step({ model: 'claude-opus-5-5' } as any)) ;
    await $.turn.complete({ answer: '', reason: 'answer' } as any)
  }
  const head = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const t = (await ui.find({ type: 'Text', text: /★ \d+$/ }))?.text; await ui.unmount(); return t }
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })

  await turn() // the first use of the day and a turn
  expect(k.disk.pet).toMatchObject({ coins: 6, affection: 6, days: 1, owned: ['shades'] })
  expect(Object.keys(k.disk.pet).filter(key => /health|ko|efficient|drowned|flower|clean|best|pending/.test(key))).toEqual([])
  expect(k.disk.pet.session).toBeUndefined() // the chat's own part stays out of the store
  expect(k.disk.pet.issues).toBeUndefined()

  // meanwhile another chat earned coins, bought a cap and counted its tokens
  k.disk.pet = { ...k.disk.pet, coins: 40, affection: 70, owned: ['shades', 'cap'], turn: 155, life: { input: 9000, cacheRead: 8000 } }
  await turn()
  expect(k.disk.pet).toMatchObject({ coins: 41, affection: 71, owned: ['shades', 'cap'], life: { input: 19_000, cacheRead: 18_000 } }) // its progress, plus this turn
  const card = await cardOf($)
  expect(card).toMatch(/^41 stars; owns sunglasses, a travel cap\. \/pet shop$/m) // bought in the other chat
  expect(card).not.toMatch(/cache/i) // 18k of 19k came from the cache: not said here
  expect(card).toMatch(/♥♥♡♡♡/)

  // the skin button opens the parts something is owned for, one button each: a press turns that part alone, and the bubble tells what is on
  expect(card).toMatch(/^  wears head: a travel cap$/m) // no choice made yet: the last thing owned, as before the parts
  let ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const keys = async () => (await ui.findAll({ type: 'Button' })).map(b => b.key)
  const said = async () => (await ui.findAll({ type: 'Text' })).map(t => t.text).join('\n')
  const again = async () => { await ui.unmount(); ui = await $.ui.mount({ ...BAND, surface: 'terminal' }) } // a mounted band is the drawing of that moment
  const press = async (key: string) => { await ui.press({ key }); await k.clock.advance(1); await again() } // the handler is not awaited by the press
  expect(await keys()).toContain('skin')
  await press('skin')
  expect('pref.wear' in k.disk).toBe(false) // opening changes nothing
  expect(await keys()).toEqual(['slot-head', 'slot-face', 'skin-done']) // nothing owned for the body, the feet or as an accessory
  expect(await said()).toContain('head: a travel cap, face: –\na press changes that part')
  await press('slot-face')
  expect(prefsOf(k.disk).wear).toBe('cap shades') // the cap stays on
  expect(await said()).toContain('head: a travel cap, face: sunglasses')
  await press('slot-head')
  expect(prefsOf(k.disk).wear).toBe('shades') // one hat owned: after it, a bare head
  await press('slot-head')
  expect(prefsOf(k.disk).wear).toBe('cap shades')
  await press('slot-face')
  await press('slot-head')
  expect(prefsOf(k.disk).wear).toBe('none')
  expect(await said()).toContain('head: –, face: –')
  await press('slot-face')
  expect(prefsOf(k.disk).wear).toBe('shades')
  await press('skin-done')
  expect(await keys()).toContain('skin')
  expect(await keys()).not.toContain('slot-head')
  await press('skin')
  await k.clock.advance(21_000) // left alone, the row closes by itself
  await again()
  expect(await keys()).not.toContain('slot-head')
  await ui.unmount()

  // the other chat writes again: the card shows it at once and writes nothing; the band follows at its next look
  k.disk.pet = { ...k.disk.pet, coins: 12 }
  expect(await cardOf($)).toMatch(/^12 stars;/m)
  expect(k.disk.pet.coins).toBe(12)
  k.disk.pet = { ...k.disk.pet, affection: 150 }
  await k.clock.advance(11_000) // past the 10 s between two looks
  expect(await head()).toMatch(/^\w+  ★ 12$/) // the stars on the band follow the store
  expect(await head()).not.toMatch(/[♥♡]/)
  expect(await cardOf($)).toMatch(/♥♥♥♡♡/)

  // this chat grows long, lean off: a note, and the turn earns its coin like any other
  context = 90_000
  await turn()
  expect(k.disk.pet).toMatchObject({ coins: 13, affection: 151 })
  // lean is switched on in another chat: here the style waits (the chat is over 30k)
  elsewhere(k.disk, { style: true })
  await turn()
  expect(k.disk.pet.coins).toBe(14)
  expect(await cardOf($)).toMatch(/briefox chosen, "Be brief\." starts at the next compaction or chat/)
})

test('/pet demo shows every mood in turn, also while the pet sleeps, and the egg goes through all its phases', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', trait: 'dry', trait2: 'shy', asked: true })
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  const look = async () => {
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const say = (await ui.findAll({ type: 'Text' })).map(x => x.text).filter(t => t && !/★ \d+$|^[─·]$/.test(t)).join(' | ')
    const drawn = JSON.stringify(await ui.find({ type: 'Raster' }))
    await ui.unmount()
    return { say, drawn }
  }
  await k.clock.advance(5 * 60_000 + 3_000) // the chat stands still: the pet falls asleep
  expect((await look()).say).toBe('zzz')
  await k.clock.advance(15_000) // said once: then it sleeps with no bubble
  expect((await look()).say).toBe('')

  expect(await cardOf($, 'demo')).toMatch(/^Hatchling demo: egg, seedling/)
  // one look per tick, 5 s a mood
  const slots: { say: string, drawn: string }[][] = []
  for (let mood = 0; mood < 10; mood++) {
    const seen = []
    for (let i = 0; i < 10; i++) { await k.clock.advance(500); seen.push(await look()) }
    slots.push(seen)
  }
  const says = slots.map(seen => [...new Set(seen.map(x => x.say))])
  // the sad and the ko drawings are still in the zoo, and no mood leads to them: the demo leaves them out
  const [egg, seedling, healthy, bloom, cheer, dizzy, stomach, loop, bloated, sleep] = says as [string[], string[], string[], string[], string[], string[], string[], string[], string[], string[]]
  // the egg: still, then rocking, then cracked
  expect(egg).toEqual(['an egg. something moves inside', 'the shell is cracking'])
  const eggs = slots[0]!.map(x => x.drawn)
  expect(new Set(eggs).size).toBe(4) // whole, leaning left, leaning right, cracked
  expect(eggs[0]).toBe(eggs[1]) // it starts still
  expect(new Set(eggs.slice(-3)).size).toBe(1) // and ends cracked
  // every mood says its own line: none of them is the sleeping pet's
  for (const calm of [seedling, healthy, bloom]) expect(calm.join()).toMatch(/short chat|small context/)
  expect(cheer.join()).toMatch(/^grew a stage/) // the cheer of the demo is the one for growing: none is about the cache
  expect(dizzy.join()).toMatch(/re-read, unchanged: app\.js/)
  expect(stomach.join()).toMatch(/cache rebuilt: tools changed mid-chat/)
  expect(loop.join()).toMatch(/npm failed 3 times in a row/)
  expect(bloated.join()).toMatch(/context 91% full/)
  expect(sleep).toEqual(['zzz'])
  expect(says.slice(0, 9).flat()).not.toContain('zzz')
  expect(says.flat().join()).not.toMatch(/worn|low health|out cold|flat out/)
  // each mood has its own drawing
  expect(new Set(slots.map(seen => seen[5]!.drawn)).size).toBeGreaterThanOrEqual(9)

  // the demo over, the pet is asleep again
  await k.clock.advance(1000)
  expect((await look()).say).toBe('') // its zzz was said before the demo: nothing new
})

test('a prompt after a pause over an hour in a chat of 100k: the pet says the cache expired and offers /compact, and compacts nothing itself', async ($, on) => {
  const clock = mock.clock(on)
  // a budget saved by an earlier version: ignored
  const disk: Record<string, any> = { prefs: { species: 'penguin', born: 'penguin', trait: 'dry', seed: 7, budget: 50_000, diet: false, style: true } }
  on('store.get', (_, e) => ({ value: structuredClone(disk[e.key]) }))
  on('store.set', (_, e) => { disk[e.key] = structuredClone(e.value); return { value: undefined } })
  on('config.list', () => ({ value: [] }))
  on('command.register', () => ({ value: { command: 'pet' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('env.get', () => ({ value: undefined }))
  on('fs.list', () => ({ value: [] }))
  on('ui.toast', () => ({ value: undefined }))
  on('prompt.submit', (_, e) => ({ text: e.text }) as any)
  on('prompt.read', () => ({ value: { text: '', cursor: 0 } }))
  let filled = ''
  on('prompt.fill', (_, e) => { filled = e.text; return { isFilled: true, text: e.text, cursor: 0 } })
  on('prompt.compose', () => ({ sections: [] }) as any)
  let compacted = 0
  on('session.compact', () => { compacted++; return { messages: [{ role: 'user', text: 'summary', toolUses: [], toolResults: [] }] } as any })
  const ctx = grows(120_000)
  on('turn.step', async function* () { return { answer: '', toolUses: [], usage: { input_tokens: 10, cache_read_input_tokens: ctx(), cache_creation_input_tokens: 0, output_tokens: 1 } } as any })
  on('turn.complete', () => ({ text: '' }) as any)
  const say = (text: string, command?: any) => $.prompt.submit({ text, ...(command && { command }), wait: false, origin: 'user' } as any)
  const turn = async () => { await $.prompt.compose({ model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] } as any); for await (const _ of $.turn.step({ model: 'claude-opus-5-5' } as any)) ; await $.turn.complete({ answer: '' } as any) }
  const texts = async () => { const b = await $.ui.mount({ ...BAND, surface: 'terminal' }); const all = (await b.findAll({ type: 'Text' })).map((x: any) => x.text).join(' | '); await b.unmount(); return all }

  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true })
  await clock.advance(1000) // the mock clock starts at 0, which the engine reads as "no request yet"
  for await (const _ of $.turn.step({ model: 'claude-opus-5-5' } as any)) ; // the chat's first request, small: long is what a chat grows by
  await say('go'); await turn()
  expect(await texts()).not.toMatch(/cache expired/)

  await clock.advance(61 * 60_000)
  await say('/pet', { name: 'pet', args: '' })
  expect(await texts()).not.toMatch(/cache expired/) // a slash command sends no request
  await say('back')
  expect(await texts()).toMatch(/cache expired: 120k sent again in full \| Restarting small costs less: \/compact, or\n\/clear if the task is done\./)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'fix' })
  await ui.unmount()
  expect(filled).toBe('/compact') // in the prompt box only: the person sends it, or not
  await turn()
  await clock.advance(5000)
  expect(compacted).toBe(0) // over the old budget for two turns, and the mod compacted nothing. Under 100k and within the hour: engine/engine.test.js

  // the saved budget is not carried into the preferences this version writes
  await $.command.run({ command: 'pet', args: 'hide' } as any)
  expect(prefsOf(disk)).toMatchObject({ hidden: true, style: true, diet: false })
  expect('pref.budget' in disk).toBe(false)
})

test('under the bench the person\'s store is neither read nor written, and the lever is the arm\'s variable only', async ($, on) => {
  mock.clock(on)
  // the person has a pet, and the style on in the preferences (with the diet of an earlier version): none of it may reach a run, and no run may change it
  const person = { pet: { health: 50, efficientSessions: 5, drowned: 0 }, prefs: { species: 'fox', born: 'fox', seed: 7, diet: true, style: true }, chats: {} }
  const disk: Record<string, any> = structuredClone(person)
  let touched = 0
  on('store.get', (_, e) => { touched++; return { value: structuredClone(disk[e.key]) } })
  on('store.set', (_, e) => { touched++; disk[e.key] = structuredClone(e.value); return { value: undefined } })
  const env: Record<string, string> = { HOME: '/home/me', HATCHLING_BENCH: '/bench/out/hatchling-out/style-1' }
  on('env.get', (_, e) => ({ value: env[e.name] }))
  on('config.list', () => ({ value: [] }))
  on('command.register', () => ({ value: { command: 'pet' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('session.end', (_, e) => ({ sessionId: e.sessionId }))
  on('prompt.submit', (_, e) => ({ text: e.text }) as any)
  on('prompt.compose', () => ({ sections: [] }) as any)
  const files: Record<string, string> = {}
  on('fs.write', (_, e) => { files[e.path] = e.text; return { value: undefined } })
  on('fs.list', () => ({ value: [] }))
  const LONG = 'x'.repeat(12_000)
  on('tool.call', () => ({ result: { stdout: LONG, stderr: '', interrupted: false } }) as any)
  on('turn.step', async function* () { return { answer: '', toolUses: [], usage: { input_tokens: 10, cache_read_input_tokens: 70_000, cache_creation_input_tokens: 0, output_tokens: 1 } } as any })
  on('turn.complete', () => ({ text: '' }) as any)
  const ask = { model: 'claude-opus-5-5', promptModel: 'claude-opus-5-5', surfaces: [], tools: [], outputStyle: null, traits: [] } as any
  const styled = async () => (await $.prompt.compose(ask)).sections.some((s: any) => s.id === 'briefox')
  const bash = async () => ((await $.tool.call({ tool: 'Bash', command: 'cat big.log', tool_use_id: 't1' } as any)) as any).result.stdout as string

  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: false })
  // an arm with no lever: the person's style does not apply
  expect(await styled()).toBe(false)
  expect(await bash()).toBe(LONG)
  await $.prompt.submit({ text: 'go', wait: false, origin: 'user' } as any)
  for await (const _ of $.turn.step({ model: 'claude-opus-5-5' } as any)) ;
  await $.turn.complete({ answer: '' } as any)
  // the card is this run's own pet: a newborn with the coins of its one turn, not the person's
  const card = ((await $.command.run({ command: 'pet', args: '' } as any)) as any).text as string
  expect(card).toMatch(/^6 stars; owns nothing yet/m)
  expect(card).toMatch(/^affection 6 over 1 day of use/m)
  // a command that writes preferences stays in memory too
  await $.command.run({ command: 'pet', args: 'hide' } as any)
  // the arm's variable turns the style on; the old variable of the diet does nothing, and no file is written
  env.HATCHLING_STYLE = '1'
  env.HATCHLING_DIET = '1'
  await $.session.end({ reason: 'clear', sessionId: 's0', resume: { id: 's0' } } as any)
  expect(await styled()).toBe(true)
  expect(await bash()).toBe(LONG)
  expect(Object.keys(files)).toEqual([])
  await $.session.end({ reason: 'exit', sessionId: 's1' } as any)

  expect(touched).toBe(0)
  expect(disk).toEqual(person)
})

/** The band as drawn: its texts, its buttons, and how many hearts the pet's drawing holds. */
async function drawn($: any) {
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const said = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string)
  const buttons = (await ui.findAll({ type: 'Button' })).map((x: any) => x.text as string)
  const bytes = Uint8Array.from(atob((await ui.find({ type: 'Raster' }))!.props.cells), c => c.charCodeAt(0))
  const cells = new Uint32Array(bytes.buffer)
  const hearts = [...cells].filter((c, i) => i % 3 === 0 && c === 0x2665).length
  return { ui, said, buttons, hearts }
}

test('cuddles: /pet pet and the pet button count them with the time of the last; hearts rise for a couple of seconds with a line in its character; the first three of a day bring stars and affection', async ($, on) => {
  // rigor is the peak and warmth the second: the rigorous one speaks most lines, the warm one some
  const k = home(on, {}, { species: 'bunny', born: 'bunny', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true })
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  const t0 = Date.UTC(2026, 10, 12, 12)
  let b = await drawn($)
  expect(b.buttons).toContain('pet')
  expect(b.hearts).toBe(0)
  expect(prefsOf(k.disk)).toMatchObject({ stats: [20, 50, 40, 90, 70] })
  expect(await cardOf($)).not.toMatch(/petted/)
  const name = prefsOf(k.disk).name
  expect(b.said).toContain(`${name}  ★ 0`)
  expect(await cardOf($)).toMatch(/♡♡♡♡♡ calm$/m)

  // the button: counted, hearts on the drawing, a line in the bubble. Rigor 90 and warmth 70 share the voice: this one is the warm one's
  await b.ui.press({ key: 'pet' })
  await b.ui.unmount()
  expect(prefsOf(k.disk)).toMatchObject({ cuddles: 1, cuddled: t0 })
  b = await drawn($)
  expect(b.said).toContain('I like it when you do that')
  expect(b.hearts).toBeGreaterThan(0)
  expect(b.said).toContain(`${name}  ★ 7`) // the stars move with what the cuddle earned; the rising hearts are on the drawing
  expect(b.said.join(' ')).not.toMatch(/happy|calm|♡/)
  expect(await cardOf($)).toMatch(/♡♡♡♡♡ happy$/m) // content after a cuddle; 7 of affection are not a heart yet
  expect(k.disk.pet).toMatchObject({ coins: RULES.coinsFirstUse + RULES.coinsCuddle, affection: 7, dayCuddles: 1, days: 1 })
  await b.ui.unmount()
  // the hearts move while they last
  const seen = new Set<string>()
  for (let i = 0; i < 3; i++) { await k.clock.advance(500); const d = await drawn($); seen.add(JSON.stringify((await d.ui.find({ type: 'Raster' }))!.props.cells)); expect(d.said).toContain('I like it when you do that'); await d.ui.unmount() }
  expect(seen.size).toBe(3)
  // after a couple of seconds the hearts are gone; the line holds the bubble for 5 seconds in all, and then the pet says what it said before
  await k.clock.advance(1_500)
  b = await drawn($)
  expect(b.hearts).toBe(0)
  expect(b.said).toContain('I like it when you do that')
  await b.ui.unmount()
  await k.clock.advance(2_500)
  b = await drawn($)
  expect(b.said.join(' ')).not.toMatch(/I like it when you do that/)
  await b.ui.unmount()

  // the command: the other line of its character, the count, and the time of this one
  await k.clock.advance(60_000)
  expect(await cardOf($, 'pet')).toBe('Miro: pat received, in good order  (petted 2 times, +2 stars)')
  expect(prefsOf(k.disk)).toMatchObject({ cuddles: 2, cuddled: t0 + 5_500 + 60_000 })
  b = await drawn($)
  expect(b.said).toContain('pat received, in good order')
  expect(b.hearts).toBeGreaterThan(0)
  await b.ui.unmount()
  expect(await cardOf($)).toMatch(/^petted 2 times, last just now$/m)

  // a cuddle in another chat is counted too: the store's count is the one that grows
  elsewhere(k.disk, { cuddles: 9 })
  expect(await cardOf($, 'pet')).toMatch(/petted 10 times, \+2 stars\)$/)

  // three cuddles of the day paid: 5 for the first use and 2 each, a heart filled, and no token was asked for
  expect(k.disk.pet).toMatchObject({ coins: 11, affection: 11, dayCuddles: 3 })
  expect((await drawn($)).said).toContain(`${name}  ★ 11`)
  expect(await cardOf($)).toMatch(/♥♡♡♡♡ happy$/m)
  expect(k.filled).toBe('')
  // a count that is not a number reads as none
  elsewhere(k.disk, { cuddles: 'many', cuddled: null })
  k.state = {}
  expect(await cardOf($, 'pet')).toMatch(/petted once\)$/) // the fourth of the day: as welcome, and no coins
  expect(k.disk.pet.coins).toBe(11)
})

test('on a light theme white gets a darker edge where it touches the background, and stays white inside; on a dark one nothing changes', async ($, on) => {
  const k = home(on, {}, { species: 'bunny', born: 'bunny', seed: 7, name: 'Miro', trait: 'dry', trait2: 'shy', asked: true })
  k.disk.pet = { animals: ['chick'] }
  const inks = async (theme: string) => {
    Object.assign(k, { theme }) // the theme is read when a session starts
    await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const cells = new Uint32Array(Uint8Array.from(atob((await ui.find({ type: 'Raster' }))!.props.cells as string), c => c.charCodeAt(0)).buffer)
    await ui.unmount()
    return new Set([...cells].filter((_, i) => i % 3 !== 0))
  }
  const dark = await inks('dark'), light = await inks('light')
  expect(dark.has(0xf5f5f5)).toBe(true)
  expect(dark.has(0x939393)).toBe(false)
  expect(light.has(0xf5f5f5)).toBe(true) // the inside
  expect(light.has(0x939393)).toBe(true) // the edge: 60% of the white
  expect(light.has(0xf48fb1)).toBe(true) // the pink of the ears is not pale: untouched
  // a bright yellow is as faint on white as white is: the plain chick gets the same edge
  await cardOf($, 'animal chick')
  const chick = await inks('light')
  expect([chick.has(0xffd54f), chick.has(0x99802f)]).toEqual([true, true]) // inside, and 60% of it at the edge
  expect((await inks('dark')).has(0x99802f)).toBe(false)
})

test('the golden coat: the last row of the shop for 300 stars, a part of the skin with golden and plain, a colour that things to wear leave alone; on a light theme its yellow gets the edge', async ($, on) => {
  const k = home(on, {}, { species: 'bunny', born: 'bunny', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true })
  k.disk.pet = { coins: 310, affection: 310, days: 1, day: dayOf(Date.UTC(2026, 10, 12, 12)), owned: [] }
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  const look = async () => {
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const cells = new Uint32Array(Uint8Array.from(atob((await ui.find({ type: 'Raster' }))!.props.cells as string), c => c.charCodeAt(0)).buffer)
    const keys = (await ui.findAll({ type: 'Button' })).map((b: any) => b.key)
    await ui.unmount()
    return { inks: new Set([...cells].filter((_, i) => i % 3 !== 0)), keys }
  }
  const press = async (key: string) => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); await ui.press({ key }); await k.clock.advance(1); await ui.unmount() }
  const WHITE = 0xf5f5f5, GOLD = 0xffcb14, GLINT = 0xfff6cf // the bunny's white, the same under the golden coat, and the pale glint on it

  // not owned: sold apart from the things to wear, after them, and nothing of it on the pet
  expect(await cardOf($, 'shop')).toMatch(/\n  wizard +a wizard's hat +80  head\n\n  pastel +a pastel coat +150  coat\n  terminal +a terminal coat +200  coat\n  golden +a golden coat +300  coat\n\n  eggshell +half an eggshell +–  head +founders only\n\n  penguin +penguin +100  animal\n/)
  expect(await cardOf($, 'wear golden')).toMatch(/^Not yours yet: golden\./)
  const plain = await look()
  expect([plain.inks.has(WHITE), plain.inks.has(GOLD), plain.keys.includes('skin')]).toEqual([true, false, false])
  expect(await cardOf($)).toMatch(/^Miro, Hatchling the bunny, /)

  // bought: 300 stars and no affection, on at once, on the card and in the shop
  expect(await cardOf($, 'shop golden')).toBe('Bought a golden coat for 300 stars, 10 left. Miro wears it now, coat: /pet wear golden takes it off.')
  expect(k.disk.pet).toMatchObject({ coins: 10, affection: 310, owned: ['golden'] })
  expect(prefsOf(k.disk).wear).toBe('golden')
  const golden = await look()
  expect([golden.inks.has(WHITE), golden.inks.has(GOLD), golden.inks.has(GLINT), plain.inks.has(GLINT)]).toEqual([false, true, true, false])
  expect(await cardOf($)).toMatch(/^Miro, Hatchling the golden bunny, .*(\n.*)*\n10 stars; owns a golden coat\. \/pet shop\n  wears coat: a golden coat$/m)
  expect(await cardOf($, 'shop')).toMatch(/\n  terminal .*\n  golden +a golden coat +300  coat +yours, worn\n\n(.*\n)+\nMiro wears coat: a golden coat\.\n/)
  expect(await cardOf($, 'buy golden')).toMatch(/^You already have a golden coat/)

  // back to the usual colour and to golden again, by command and by the coat's button; the choice is kept
  expect(await cardOf($, 'wear plain')).toBe('Miro wears nothing.')
  expect(prefsOf(k.disk).wear).toBe('none plain')
  expect((await look()).inks.has(GOLD)).toBe(false)
  expect(await cardOf($)).toMatch(/^Miro, Hatchling the bunny, /)
  expect(await cardOf($, 'skin')).toMatch(/^Miro's skin\n  coat  plain\n\/pet wear <item> puts it on/)
  expect(await cardOf($, 'wear golden')).toBe('a golden coat goes on, coat.\nMiro wears coat: a golden coat.')
  expect(await cardOf($, 'skin')).toMatch(/^Miro's skin\n  coat  a golden coat\n/)
  expect(golden.keys).toContain('skin')
  await press('skin')
  expect((await look()).keys).toContain('slot-coat')
  await press('slot-coat')
  expect([prefsOf(k.disk).wear, (await look()).inks.has(GOLD)]).toEqual(['none plain', false])
  await press('slot-coat')
  expect([prefsOf(k.disk).wear, (await look()).inks.has(GOLD)]).toEqual(['golden', true])

  // a colour, not a thing worn: taking everything off leaves it, and a thing put on goes over it
  k.disk.pet = { ...k.disk.pet, owned: ['mug', 'golden'] }
  await k.clock.advance(11_000)
  expect(await cardOf($, 'wear mug')).toBe('a coffee mug goes on, accessory.\nMiro wears accessory: a coffee mug, coat: a golden coat.')
  expect(await cardOf($, 'wear none')).toBe('Miro wears nothing; the golden coat stays.')
  expect([prefsOf(k.disk).wear, (await look()).inks.has(GOLD)]).toEqual(['golden', true])

  // every animal and stage has the tint; asleep it stays
  for (const sp of Object.values(zoo.pack.animals) as any[]) expect(Object.keys(sp.tints.golden).length).toBeGreaterThan(0)

  // a light theme: the bright gold would fade on white, so where it touches the background it takes the coat's own amber, never the mud a darkened yellow is
  Object.assign(k, { theme: 'light' })
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  const light = await look()
  expect([light.inks.has(GOLD), light.inks.has(0xf09a00), light.inks.has(0x997a0c)]).toEqual([true, true, false])
})

test('a pet born golden has the coat for nothing: on from the start, plain by choice, never asked to pay', async ($, on) => {
  const k = home(on, {}, { species: 'chick', born: 'chick', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true })
  k.disk.pet = { variant: 'golden', coins: 400, affection: 400, days: 1, day: dayOf(Date.UTC(2026, 10, 12, 12)), owned: [] } // a store of before the coat
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  expect(await cardOf($)).toMatch(/^Miro, Hatchling the golden chick, /)
  expect(await cardOf($, 'shop')).toMatch(/\n  golden +a golden coat +300  coat +yours, worn\n/)
  expect(await cardOf($, 'buy golden')).toMatch(/^You already have a golden coat/)
  expect(k.disk.pet.coins).toBe(400)
  expect(await cardOf($, 'wear plain')).toBe('Miro wears nothing.')
  expect(await cardOf($)).toMatch(/^Miro, Hatchling the chick, /)
  expect(await cardOf($, 'wear golden')).toBe('a golden coat goes on, coat.\nMiro wears coat: a golden coat.')
})

// a skin pack as a person's folder holds it: an animal, a hat and a coat (the example of docs/skins.md, cut short)
const ROBOT = ['....DDDD....', '..BBBBBBBB..', '.BBBBBBBBBB.', '.BBkBBBBkBB.', '.BBBBBBBBBB.', '.BBBDDDDBBB.', '..BBBBBBBB..', '..DBBBBBBD..', '..BBBBBBBB..', '..DD....DD..']
const PACK = { format: 1, id: 'example', name: 'Example', animals: { robot: { name: { en: 'robot', es: 'robot de lata' }, palette: { B: '#90a4ae', D: '#546e7a' }, states: { adult: { frames: [ROBOT] } } } }, items: { tophat: { part: 'head', name: { en: 'a top hat' }, fallback: [{ anchor: 'head', art: ['.uuuu.', '.RRRR.', 'uuuuuu'] }] } }, coats: { mint: { name: { en: 'a mint coat' }, ramp: ['#00796b', '#4db6ac', '#b2dfdb'] } } }
const START = { cwd: '/w/hatchling', surface: 'terminal', isInteractive: true } as const

test('a skin pack in the person\'s folder: what it brings is theirs at once, for no stars, in /pet skins, /pet animal and the skin menu with the pack\'s name', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true })
  k.disk.pet = { coins: 12, affection: 400, days: 1, day: dayOf(Date.UTC(2026, 10, 12, 12)), owned: [] }
  k.skins = { 'example.json': PACK, 'notes.txt': 'not a pack' }
  await $.session.start(START)
  expect(k.skinReads).toEqual(['/home/me/.claude/hatchling-skins/example.json']) // only the .json files are read

  expect(await cardOf($, 'skins')).toBe([
    'Skin packs in /home/me/.claude/hatchling-skins: 1 loaded.',
    '  example.json  Example (example)  animals: robot; items: tophat; coats: mint',
    'What a pack brings is yours at once and costs no stars: /pet skin shows the things, /pet animal the animals.',
    'Format, an example to copy and how to try it: https://github.com/silirim/hatchling/blob/main/docs/skins.md',
  ].join('\n'))

  // the animal: listed with its pack, picked for nothing, drawn; not a thing of the shop
  expect(await cardOf($, 'animal')).toBe('Pick one of: fox, robot (Example).\nOthers, 100 stars each, once: penguin, chick, dog, bunny, cactus. /pet shop <animal> unlocks one.')
  expect(await cardOf($, 'animal robot')).toBe('Hatchling is now a robot (Example).')
  expect(prefsOf(k.disk).species).toBe('robot')
  expect(await cardOf($)).toMatch(/^Miro, Hatchling the (\w+ )?robot \(Example\),/)
  expect(await cardOf($, 'shop')).not.toMatch(/robot|tophat|mint/)
  expect(await cardOf($, 'shop robot')).toMatch(/^Nothing called robot in the shop\./)
  expect(k.disk.pet.coins).toBe(12) // no stars taken, none given
  expect(k.disk.pet.owned).toEqual([])
  expect(k.disk.pet.animals ?? []).toEqual([])
  const look = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const r = (await ui.find({ type: 'Raster' }))!.props; const keys = (await ui.findAll({ type: 'Button' })).map(x => x.text); await ui.unmount(); const d = new Uint32Array(Uint8Array.from(atob(String(r.cells)), ch => ch.charCodeAt(0)).buffer); const inks = new Set([...d].filter((_, i) => i % 3 !== 0)); return { inks, keys, columns: r.columns, rows: r.rows } }
  const robot = await look()
  expect([robot.inks.has(0x90a4ae), robot.inks.has(0x546e7a), robot.keys.includes('skin')]).toEqual([true, true, true])

  // the things: in /pet skin with the pack's name, put on by choice, the hat set by the fallback over the robot's head
  expect(await cardOf($, 'skin')).toBe("Miro's skin\n  head    –\n  coat    plain\n  animal  robot (Example)\n/pet wear <item> puts it on, or takes it off when it is on; /pet wear none takes everything off; /pet skin shows each part. One thing on each part: head, face, body, feet, accessory. A coat is a colour: /pet wear plain takes it off, /pet wear golden puts the golden one on.")
  expect(await cardOf($, 'wear tophat')).toBe('a top hat (Example) goes on, head.\nMiro wears head: a top hat (Example).')
  const hat = await look()
  expect([hat.inks.has(0x42a5f5), hat.inks.has(0xef5350), robot.inks.has(0x42a5f5)]).toEqual([true, true, false])
  expect(await cardOf($, 'wear mint')).toBe('a mint coat (Example) goes on, coat.\nMiro wears head: a top hat (Example), coat: a mint coat (Example).')
  const mint = await look()
  expect([mint.inks.has(0x90a4ae), mint.inks.has(0x42a5f5)]).toEqual([false, true]) // the body takes the coat's colours, the hat keeps its own
  expect(await cardOf($, 'wear plain')).toBe('Miro wears head: a top hat (Example).')
  expect((await look()).inks.has(0x90a4ae)).toBe(true)
  // the skin menu on the band: a button for each part the pack gave a thing for, and the animal
  let ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'skin' }); await k.clock.advance(1); await ui.unmount()
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.findAll({ type: 'Button' })).map(x => x.text)).toEqual(['head', 'coat', 'animal', 'done'])
  expect((await ui.findAll({ type: 'Text' })).map(x => x.text).join(' ').replace(/\n/g, ' ')).toContain('head: a top hat (Example), coat: plain, animal: robot (Example)')
  await ui.unmount()
  // a shipped thing on the pack's animal, and the pack's hat on a shipped one: both are drawn
  k.disk.pet.owned = ['shades']; k.state = {}
  await $.session.start(START)
  await cardOf($, 'wear shades')
  expect((await look()).inks.has(0x263238)).toBe(true)
  await cardOf($, 'animal fox')
  const fox = await look()
  expect([fox.inks.has(0x42a5f5), fox.inks.has(0x263238), fox.inks.has(0xf57c00)]).toEqual([true, true, true])
})

test('a pack that is not sound is left out whole and told by /pet skins; no folder, a link, a file too big: the band is drawn all the same', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true })
  await $.session.start(START)
  expect(await cardOf($, 'skins')).toBe('No skin packs. A pack is one .json file in /home/me/.claude/hatchling-skins: put it there and run /pet skins.\nFormat, an example to copy and how to try it: https://github.com/silirim/hatchling/blob/main/docs/skins.md')

  const bad = structuredClone(PACK) as any
  bad.animals.robot.palette.B = 'red'; bad.items.tophat.part = 'tail'
  k.skins = { 'a-broken.json': bad, 'b-half.json': '{ "format": 1,', 'c-link.json': 'link', 'd-huge.json': 600 * 1024, 'e-clash.json': { ...PACK, id: 'clash', animals: undefined, coats: undefined, items: { mug: PACK.items.tophat } }, 'f-good.json': { ...PACK, animals: undefined, coats: undefined } }
  const said = await cardOf($, 'skins') // read anew, with no restart
  expect(said.split('\n').slice(0, 12)).toEqual([
    'Skin packs in /home/me/.claude/hatchling-skins: 1 loaded, 5 left out.',
    '  a-broken.json  left out, nothing of it is used:',
    '      animals.robot.palette.B: a colour is written #rrggbb',
    '      items.tophat.part: must be one of head, face, body, feet, accessory',
    '  b-half.json    left out, nothing of it is used:',
    expect.stringMatching(/^      file: not JSON/),
    '  c-link.json    left out, nothing of it is used:',
    '      file: not a regular file (a link is not followed)',
    '  d-huge.json    left out, nothing of it is used:',
    '      file: larger than 512 KiB',
    '  e-clash.json   left out, nothing of it is used:',
    '      items.mug: the name "mug" is taken already',
  ])
  expect(said).toContain('  f-good.json    Example (example)  items: tophat')
  expect(k.skinReads.some(p => /c-link|d-huge/.test(p))).toBe(false) // neither was opened
  // nothing of a refused pack is there: no robot, though its file also held a sound hat
  expect(await cardOf($, 'animal robot')).toMatch(/^No animal called robot\.\nPick one of: fox\./)
  expect(await cardOf($, 'wear tophat')).toContain('a top hat (Example) goes on')
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Raster' })).toBeTruthy()
  await ui.unmount()

  // a stranger's pack: its file name and what it says wrong are shown with no escape sequence and no control (U+009B is CSI in one character)
  const ESC = '\u001b[2J\u001b]0;owned\u0007', C1 = '\u009b31m'
  k.skins = { [`evil${ESC}${C1}.json`]: { ...PACK, [`x${ESC}${C1}`]: 1 }, [`half${C1}.json`]: `{ "format": ${ESC}${C1}`, [`good${ESC}.json`]: { ...PACK, animals: undefined, coats: undefined } }
  const hostile = await cardOf($, 'skins')
  expect(hostile.split('\n').slice(0, 6)).toEqual([
    'Skin packs in /home/me/.claude/hatchling-skins: 1 loaded, 2 left out.',
    '  evil 31m.json  left out, nothing of it is used:',
    '      pack: unknown field "x 31m"',
    '  good.json      Example (example)  items: tophat',
    '  half 31m.json  left out, nothing of it is used:',
    expect.stringMatching(/^      file: not JSON \(/),
  ])
  expect(/[\p{Cc}\p{Cf}\p{Co}\p{Cs}\p{Zl}\p{Zp}]/u.test(hostile.replace(/\n/g, ''))).toBe(false)

  // the folder cannot be listed at all: no pack, and the pet is there
  k.skins = null
  expect(await cardOf($, 'skins')).toMatch(/^No skin packs\./)
  expect(await cardOf($)).toMatch(/^Miro, Hatchling the (\w+ )?fox,/)
})

test('an animal of a pack that is gone: the pet is the animal it was born as again, says so gently once, and is back when the pack is', async ($, on) => {
  // a pet shown as an animal no installed pack has (the two bonus animals of earlier versions are such now)
  const k = home(on, {}, { species: 'robot', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true })
  await $.session.start(START)
  expect(prefsOf(k.disk)).toMatchObject({ species: 'fox', born: 'fox', missing: 'robot' })
  expect(await cardOf($)).toMatch(/^Miro, Hatchling the (\w+ )?fox,/)
  await k.clock.advance(600)
  const texts = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const t = (await ui.findAll({ type: 'Text' })).map(x => x.text).join(' | '); await ui.unmount(); return t }
  expect(await texts()).toMatch(/My other look came from a skin pack that is\nnot here now, so I am a fox again\. \| Put the pack back and I change back\. \/pet\nskins shows the packs\./)
  await k.clock.advance(21_000)
  expect(await texts()).not.toContain('other look')
  await $.session.start(START) // said once: the next start is silent
  await k.clock.advance(600)
  expect(await texts()).not.toContain('other look')

  // the pack is put in the folder: the robot is back, with no word and no star spent
  k.skins = { 'example.json': PACK }
  expect(await cardOf($, 'skins')).toContain('1 loaded')
  expect(prefsOf(k.disk)).toMatchObject({ species: 'robot', born: 'fox', missing: '' })
  expect(await cardOf($)).toMatch(/^Miro, Hatchling the (\w+ )?robot \(Example\),/)

  // born as such an animal, and no pack: a shipped animal is rolled once and kept, and the old one still comes back with its pack
  k.skins = {}
  forget(k.disk); k.disk.prefs = { species: 'yeti', born: 'yeti', seed: 7, name: 'Miro', asked: true, voiceAsked: true }; k.state = {}
  await $.session.start(START)
  const now = prefsOf(k.disk)
  expect(Object.keys(zoo.pack.animals)).toContain(now.species)
  expect(now).toMatchObject({ born: now.species, missing: 'yeti' })
  k.state = {}
  await $.session.start(START)
  expect(prefsOf(k.disk).species).toBe(now.species) // not rolled again
  // picking another animal by hand is a choice: the old one is not brought back over it
  k.disk.pet = { ...k.disk.pet, animals: ['dog'] }
  await cardOf($, 'animal dog')
  expect(prefsOf(k.disk)).toMatchObject({ species: 'dog', missing: '' })
})

test('under the bench no pack is read, and a pet whose animal is of a pack keeps it in the store', async ($, on) => {
  const k = home(on, {}, { species: 'robot', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true })
  k.env.HATCHLING_BENCH = '/var/tmp/bench'
  k.skins = { 'example.json': PACK }
  await $.session.start({ ...START, isInteractive: false })
  expect(k.skinReads).toEqual([])
  expect(await cardOf($, 'skins')).toBe('No skin packs: under the bench none is read.')
  expect(await cardOf($, 'animal robot')).toMatch(/^No animal called robot\.\nPick one of: (?!.*robot)/)
  expect(prefsOf(k.disk)).toMatchObject({ species: 'robot', born: 'fox' })
  expect(prefsOf(k.disk).missing).toBeUndefined()
})


test('only an id buys, puts on or switches: a shown name, in any language, is answered in one line with the id it could be and nothing is done; an unknown word with the closest ids', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [91, 45, 12, 70, 38], asked: true, lang: 'en' })
  k.disk.pet = { coins: 500, affection: 3, days: 2, owned: [], animals: [] }
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  const had = () => [k.disk.pet.coins, k.disk.pet.owned, k.disk.pet.animals, prefsOf(k.disk).wear, prefsOf(k.disk).species]
  const before = JSON.stringify(had())
  // the defect: the row reads `shades  sunglasses`, and the name got the whole catalogue back. Now one line, and nothing is bought
  expect(await cardOf($, 'shop sunglasses')).toBe('Did you mean /pet shop shades?')
  expect(await cardOf($, 'shop A Coffee Mug')).toBe('Did you mean /pet shop mug?')
  expect(await cardOf($, 'buy gafas de sol')).toBe('Did you mean /pet shop shades?') // a name of another language too
  expect(await cardOf($, 'shop 墨镜')).toBe('Did you mean /pet shop shades?')
  expect(await cardOf($, 'shop skate')).toBe('Did you mean /pet shop skateboard?') // a beginning
  expect(await cardOf($, 'shop hat')).toBe('Did you mean /pet shop partyhat, /pet shop santa, /pet shop wizard?') // several: each id
  expect(await cardOf($, 'shop the dog')).toBe('Did you mean /pet shop dog?')
  expect(await cardOf($, 'shop zorro')).toBe('Did you mean /pet shop fox?')
  expect(await cardOf($, 'shop sunglases')).toBe('Nothing called sunglases in the shop. Closest: shades.')
  expect(await cardOf($, 'shop baloon')).toBe('Nothing called baloon in the shop. Closest: balloon.')
  expect(await cardOf($, 'shop yacht')).toBe('Nothing called yacht in the shop. /pet shop lists everything.')
  expect(await cardOf($, 'wear sunglasses')).toBe('Did you mean /pet wear shades?')
  expect(await cardOf($, 'animal perro')).toBe('Did you mean /pet animal dog?')
  expect(JSON.stringify(had())).toBe(before) // nothing bought, put on or switched by a name
  // the id acts, capitals aside, and as the first word of a row read off the shop
  expect(await cardOf($, 'shop shades')).toMatch(/^Bought sunglasses for 10 stars, 490 left\./)
  expect(await cardOf($, 'shop Mug')).toMatch(/^Bought a coffee mug for 12 stars/)
  expect(await cardOf($, 'shop scarf a red scarf')).toMatch(/^Bought a red scarf /)
  expect(await cardOf($, 'shop wizard')).toMatch(/^Bought a wizard's hat /)
  expect(k.disk.pet.owned).toEqual(['shades', 'mug', 'scarf', 'wizard'])
  // wearing: the same, and the suggestion is among the things the pet has first
  const worn = prefsOf(k.disk).wear
  expect(await cardOf($, 'wear Sunglasses')).toBe('Did you mean /pet wear shades?')
  expect(await cardOf($, 'wear coffee mug')).toBe('Did you mean /pet wear mug?')
  expect(await cardOf($, 'wear off red scarf')).toBe('Did you mean /pet wear off scarf?')
  expect(await cardOf($, 'wear hat')).toBe('Did you mean /pet wear wizard?') // the one hat owned
  expect(await cardOf($, 'wear a golden coat')).toBe('Did you mean /pet wear golden?')
  expect(await cardOf($, 'wear yacht')).toMatch(/^Not yours yet: yacht\. You have: /)
  expect(prefsOf(k.disk).wear).toBe(worn)
  expect(await cardOf($, 'wear SHADES')).toMatch(/^sunglasses comes off\./)
  expect(await cardOf($, 'wear off mug')).toMatch(/^a coffee mug comes off\./)
  // the animals
  expect(await cardOf($, 'animal do')).toBe('Did you mean /pet animal dog?')
  expect(await cardOf($, 'animal foxx')).toBe('No animal called foxx. Closest: fox.')
  expect(await cardOf($, 'animal c')).toMatch(/^No animal called c\.\nPick one of: /)
  expect(prefsOf(k.disk).species).toBe('fox')
  expect(await cardOf($, 'animal Fox')).toBe('Hatchling is now a fox.')
  // the other languages: the question in the language, the id as it is
  await cardOf($, 'lang es')
  expect(await cardOf($, 'shop lampara')).toBe('¿Querías decir /pet shop lamp?')
  expect(await cardOf($, 'shop gorro')).toBe('¿Querías decir /pet shop partyhat, /pet shop santa?')
  expect(await cardOf($, 'shop')).toMatch(/\n  escribe     nombre\n/)
  expect(await cardOf($, 'shop')).toMatch(/\n\/pet shop balloon compra un globo: escribe la primera palabra de su fila, el id\. /)
  await cardOf($, 'lang zh')
  expect(await cardOf($, 'shop 气球')).toBe('你是想输入 /pet shop balloon 吗？')
  expect(await cardOf($, 'shop 游艇')).toBe('商店里没有叫 游艇 的东西。/pet shop 可以看全部。')
  await cardOf($, 'lang pt')
  expect(await cardOf($, 'shop oculos redondos')).toBe('Você quis dizer /pet shop glasses?')
  expect(k.disk.pet.owned).toEqual(['shades', 'mug', 'scarf', 'wizard'])
})

test('the shop: stars buy things to wear, the catalogue says what is owned, and what is worn is drawn on every stage and under a note', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true })
  k.disk.pet = { coins: 25, affection: 25, days: 1, day: dayOf(Date.UTC(2026, 10, 12, 12)), owned: [] }
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  const raster = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const r = JSON.stringify((await ui.find({ type: 'Raster' }))!.props.cells); await ui.unmount(); return r }
  /** The drawing with the item on, and with it off, at the same instant. */
  const both = async (item: string) => { const worn = await raster(); await cardOf($, `wear ${item}`); const off = await raster(); await cardOf($, `wear ${item}`); return [worn, off] }

  expect([...SHOP, EGGSHELL].map(i => [i.id, i.slot, i.name])).toEqual(Object.entries(zoo.pack.items).map(([id, i]) => [id, i.part, i.name.en])) // every item of the catalogue has its drawing, in the same order, with the same part and name
  const shop = await cardOf($, 'shop')
  expect(shop).toMatch(/^HATCHLING SHOP · you have 25 stars$/m)
  for (const i of SHOP) expect(shop).toMatch(new RegExp(`^  ${i.id} +${i.name} +${i.price}  ${i.slot}${i.month ? ' +in December' : ''}$`, 'm')) // each thing with its part, named as the skin menu names it
  expect(shop).not.toMatch(/crown|beside|neck/) // the crown is not sold
  expect(shop).not.toMatch(/Miro wears/) // nothing owned: nothing to tell
  expect(shop).toContain('Stars: 1 a turn (the first 30 of a day), 2 a cuddle (the first 3 of a day), 5 at the first use of a day.')
  expect(shop).not.toMatch(/streak|bonus|lucky|timer|!/i)

  // too dear, unknown, not owned: said plainly, nothing taken
  expect(await cardOf($, 'buy sombrero')).toMatch(/^a sombrero costs 70 stars and you have 25\. Stars come with use: /)
  expect(await cardOf($, 'buy yacht')).toBe('Nothing called yacht in the shop. /pet shop lists everything.') // one line: not the catalogue again
  expect(await cardOf($, 'shop yacht')).toBe('Nothing called yacht in the shop. /pet shop lists everything.') // /pet shop <item> buys, /pet buy is its other name
  expect(await cardOf($, 'buy')).toMatch(/^Pick one: \/pet shop <item>\.\n\nHATCHLING SHOP/)
  expect(shop).toMatch(/^\/pet shop shades buys sunglasses: type the first word of its row, the id\. \/pet wear <item>/m) // a real example
  expect(shop).toMatch(/\n\n  id to type  name\n  shades +sunglasses +10  face\n/) // the word to type heads its column
  expect(shop).not.toMatch(/\/pet buy/) // the help names one way only
  expect(await cardOf($, 'wear mug')).toMatch(/^Not yours yet: mug\. You have: nothing yet\./)
  expect(k.disk.pet.coins).toBe(25)
  const bare = await raster()

  // bought: paid in coins and not in affection, owned, worn at once
  expect(await cardOf($, 'buy mug')).toBe('Bought a coffee mug for 12 stars, 13 left. Miro wears it now, accessory: /pet wear mug takes it off.')
  expect(k.disk.pet).toMatchObject({ coins: 13, affection: 25, owned: ['mug'] })
  expect(prefsOf(k.disk).wear).toBe('mug')
  expect(await cardOf($, 'buy mug')).toMatch(/^You already have a coffee mug/)
  expect(await cardOf($, 'shop')).toMatch(/^  mug +a coffee mug +12  accessory +yours, worn$/m)
  expect(await cardOf($, 'shop')).toMatch(/\n\nMiro wears accessory: a coffee mug\.\n\n\/pet shop/)
  expect(await cardOf($)).toMatch(/^13 stars; owns a coffee mug\. \/pet shop\n  wears accessory: a coffee mug$/m)
  expect(await raster()).not.toBe(bare) // on the baby

  // on the adult and on the crowned one; a hat takes the part of the crown
  const stages = [bare]
  for (const grown of [RULES.grownAt, RULES.bloomAt]) {
    k.disk.pet = { ...k.disk.pet, ...grown, owned: ['mug', 'cap'] }
    await k.clock.advance(11_000) // the next look at the store
    const [worn, off] = await both('mug')
    expect(worn).not.toBe(off)
    expect(stages).not.toContain(off)
    stages.push(off!)
  }
  expect(await cardOf($, 'wear')).toMatch(/^Miro's skin\n  head       the crown\n  accessory  a coffee mug\n\/pet wear <item> puts it on/) // grown to the last stage: the crown is on by itself
  expect(await cardOf($, 'wear cap')).toBe('a travel cap goes on, head, in place of the crown.\nMiro wears head: a travel cap, accessory: a coffee mug.') // the mug stays where it is
  const capped = await raster()
  k.disk.pet = { ...k.disk.pet, ...RULES.grownAt }
  await k.clock.advance(11_000)
  expect(await raster()).toBe(capped) // the adult in a cap: the same drawing

  // more than one thing at once, one for each part; a second thing for a part takes it; the same thing asked again comes off
  k.disk.pet = { ...k.disk.pet, owned: SHOP.map(i => i.id) }
  await k.clock.advance(11_000)
  const drawn = [capped]
  const fresh = async () => { const r = await raster(); expect(drawn).not.toContain(r); drawn.push(r!) } // each change is seen in the drawing
  expect(await cardOf($, 'wear shades')).toBe('sunglasses goes on, face.\nMiro wears head: a travel cap, face: sunglasses, accessory: a coffee mug.')
  await fresh()
  expect(await cardOf($, 'wear scarf')).toBe('a red scarf goes on, body.\nMiro wears head: a travel cap, face: sunglasses, body: a red scarf, accessory: a coffee mug.')
  expect(prefsOf(k.disk).wear).toBe('cap shades scarf mug')
  await fresh()
  expect(await cardOf($, 'wear sombrero')).toBe('a sombrero goes on, head, in place of a travel cap.\nMiro wears head: a sombrero, face: sunglasses, body: a red scarf, accessory: a coffee mug.')
  await fresh()
  expect(await cardOf($, 'wear lamp')).toBe('a desk lamp goes on, accessory, in place of a coffee mug.\nMiro wears head: a sombrero, face: sunglasses, body: a red scarf, accessory: a desk lamp.')
  await fresh()
  const shop4 = await cardOf($, 'shop')
  for (const id of ['sombrero', 'shades', 'scarf', 'lamp']) expect(shop4).toMatch(new RegExp(`^  ${id} .* yours, worn$`, 'm'))
  for (const id of ['cap', 'mug', 'headphones']) expect(shop4).toMatch(new RegExp(`^  ${id} .* yours$`, 'm'))
  expect(await cardOf($)).toMatch(/^  wears head: a sombrero, face: sunglasses, body: a red scarf, accessory: a desk lamp$/m)
  expect(await cardOf($, 'skin')).toBe("Miro's skin\n  head       a sombrero\n  face       sunglasses\n  body       a red scarf\n  feet       –\n  accessory  a desk lamp\n/pet wear <item> puts it on, or takes it off when it is on; /pet wear none takes everything off; /pet skin shows each part. One thing on each part: head, face, body, feet, accessory. A coat is a colour: /pet wear plain takes it off, /pet wear golden puts the golden one on.")
  expect(await cardOf($, 'wear')).toBe(await cardOf($, 'skin'))
  expect(await cardOf($, 'wear scarf')).toBe('a red scarf comes off.\nMiro wears head: a sombrero, face: sunglasses, accessory: a desk lamp.') // a second time: off
  await fresh()
  expect(await cardOf($, 'wear off shades')).toBe('sunglasses comes off.\nMiro wears head: a sombrero, accessory: a desk lamp.')
  expect(await cardOf($, 'wear off shades')).toBe('sunglasses is not on.\nMiro wears head: a sombrero, accessory: a desk lamp.')
  expect(prefsOf(k.disk).wear).toBe('sombrero lamp')
  expect(await cardOf($, 'wear off yacht')).toMatch(/^Not yours yet: yacht\./)
  expect(await cardOf($, 'wear off lamp')).toBe('a desk lamp comes off.\nMiro wears head: a sombrero.')
  expect(await cardOf($, 'wear sombrero')).toBe('a sombrero comes off.\nMiro wears nothing.')
  expect(prefsOf(k.disk).wear).toBe('none')
  expect(await cardOf($)).toMatch(/^  wears nothing\. \/pet wear <item>$/m)
  expect(await raster()).toBe(stages[1]) // the bare adult again
  await cardOf($, 'wear shades'); await cardOf($, 'wear cap')
  expect(await cardOf($, 'wear none')).toBe('Miro wears nothing.') // all of it off at once
  expect(prefsOf(k.disk).wear).toBe('none')

  // under a note too: the demo's dizzy pet, with the mug and without
  await cardOf($, 'wear mug')
  await cardOf($, 'demo')
  await k.clock.advance(5 * 5_000 + 2_500) // egg, the three stages, the cheer: now it is dizzy
  const [worn, off] = await both('mug')
  expect(worn).not.toBe(off)
  expect(stages).not.toContain(off)

  // an accessory stands on the ground next to the pet: the frame is wider by the columns it takes, the same in every mood and asleep
  // (where it is not drawn), so the pet does not jump; something worn on the body leaves the frame as it was
  const columns = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const c = (await ui.find({ type: 'Raster' }))!.props.columns; await ui.unmount(); return c }
  const mug = Math.max(...marksFor('mug', 'fox', 'adult').map((m: any) => m[1])) - (zoo.width - 1)
  expect(mug).toBe(8) // six wide, and an empty column between it and a cup of the headphones, which on the grown fox reach one column out of the body
  expect(await columns()).toBe(zoo.width + 2 + mug) // dizzy
  await k.clock.advance(30_000) // the demo is over
  expect(await columns()).toBe(zoo.width + 2 + mug)
  await k.clock.advance(6 * 60_000) // asleep
  expect(await columns()).toBe(zoo.width + 2 + mug)
  await cardOf($, 'wear cap')
  expect(await columns()).toBe(zoo.width + 2 + mug) // a cap with the mug: the mug still widens it
  await cardOf($, 'wear off mug')
  expect(await columns()).toBe(zoo.width + 2)

  // the feet: sneakers stay on the row of the feet, the skateboard lies under them. The frame is one text row taller for it, awake and
  // asleep, the bubble comes down with the pet's eyes, and an accessory stands on the ground the board is on
  const size = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const r = (await ui.find({ type: 'Raster' }))!.props; const tail = (await ui.find({ type: 'Box', key: 'tail' }))?.props.marginTop ?? null; await ui.unmount(); return [r.columns, r.rows, tail] }
  await cardOf($, 'wear none')
  expect(await size()).toEqual([zoo.width + 2, 6, 2]) // asleep with nothing on
  await cardOf($, 'pet') // awake
  expect(await cardOf($, 'wear sneakers')).toBe('sneakers goes on, feet.\nMiro wears feet: sneakers.')
  expect(await size()).toEqual([zoo.width + 2, 6, 2])
  const shod = await raster()
  expect(await cardOf($, 'wear skateboard')).toBe('a skateboard goes on, feet, in place of sneakers.\nMiro wears feet: a skateboard.')
  expect(await size()).toEqual([zoo.width + 2, 7, 3])
  expect(await raster()).not.toBe(shod)
  await cardOf($, 'wear mug')
  expect((await size()).slice(0, 2)).toEqual([zoo.width + 2 + mug, 7])
  await k.clock.advance(6 * 60_000) // asleep: the board is not drawn, the frame keeps its size
  expect((await size()).slice(0, 2)).toEqual([zoo.width + 2 + mug, 7])
  // on every animal, grown and small, neither reaches above the row of the feet: the face stays free
  for (const name of Object.keys(BUILTIN.species)) for (const body of ['adult', 'baby'] as const) {
    const rows = (id: string) => marksFor(id, name, body).map(m => m[0])
    expect([name, body, Math.min(...rows('sneakers')), Math.max(...rows('sneakers'))]).toEqual([name, body, zoo.height - 1, zoo.height - 1])
    expect([name, body, Math.min(...rows('skateboard'))]).toEqual([name, body, zoo.height])
    const eyes = Math.max(...rows('shades')) // the sunglasses sit on the eyes
    expect(eyes).toBeLessThan(zoo.height - 2)
  }
  // the mug is not red like the scarf and the headphones, and on the grown fox no pixel of it touches a cup of the headphones
  const fox = { mug: marksFor('mug', 'fox', 'adult'), headphones: marksFor('headphones', 'fox', 'adult') } as Record<string, any[][]>
  expect(new Set(fox.mug!.map(m => m[2]))).toEqual(new Set(['q', 'y', 'i']) as any)
  expect(fox.mug!.some(([r, c]) => fox.headphones!.some(([r2, c2]) => Math.abs(r! - r2!) <= 1 && Math.abs(c! - c2!) <= 1))).toBe(false)
})

test('the crown is the head\'s own thing: on by itself at the last stage, one of the turns of the head, off for a hat or by choice', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true })
  const day = dayOf(Date.UTC(2026, 10, 12, 12))
  k.disk.pet = { coins: 0, affection: RULES.grownAt.affection, days: RULES.grownAt.days, day, owned: [] }
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  const look = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const r = JSON.stringify((await ui.find({ type: 'Raster' }))!.props.cells); const keys = (await ui.findAll({ type: 'Button' })).map((b: any) => b.key); const said = (await ui.findAll({ type: 'Text' })).map((t: any) => t.text).join('\n'); await ui.unmount(); return { r, keys, said } }
  const press = async (key: string) => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); await ui.press({ key }); await k.clock.advance(1); await ui.unmount() }
  const adult = await look()
  expect(adult.keys).not.toContain('skin') // grown, nothing owned: nothing to pick
  expect(await cardOf($, 'skin')).toBe('Nothing to wear yet. /pet shop shows what there is.')

  // the last stage: the crown, with nothing written and nothing bought
  k.disk.pet = { ...k.disk.pet, affection: RULES.bloomAt.affection, days: RULES.bloomAt.days, owned: ['cap', 'scarf'] }
  await k.clock.advance(11_000)
  elsewhere(k.disk, { wear: 'scarf' }) // chosen before it grew
  await k.clock.advance(11_000)
  const crowned = await look()
  expect(crowned.r).not.toBe(adult.r)
  expect(crowned.keys).toContain('skin')
  expect(await cardOf($, 'skin')).toMatch(/^Miro's skin\n  head  the crown\n  body  a red scarf\n/)
  expect(await cardOf($)).toMatch(/^  wears head: the crown, body: a red scarf$/m)
  expect(await cardOf($)).toMatch(/owns a red scarf, a travel cap\./) // owned are the things bought
  expect(await cardOf($, 'shop')).not.toMatch(/^  crown/m) // not for sale
  expect(await cardOf($, 'buy crown')).toMatch(/^Nothing called crown in the shop\./)

  // the head's button: the crown, the cap, nothing, the crown again
  await press('skin')
  expect((await look()).keys).toEqual(['slot-head', 'slot-body', 'skin-done'])
  expect((await look()).said).toContain('head: the crown, body: a red scarf')
  await press('slot-head')
  expect(prefsOf(k.disk).wear).toBe('cap scarf')
  const capped = await look()
  expect(capped.r).not.toBe(crowned.r)
  await press('slot-head')
  expect(prefsOf(k.disk).wear).toBe('scarf nohead')
  expect((await look()).said).toContain('head: –, body: a red scarf')
  await press('slot-head')
  expect(prefsOf(k.disk).wear).toBe('crown scarf')
  await press('skin-done')
  expect((await look()).r).toBe(crowned.r)

  // by name too, and everything off takes the crown with it; the bare head is the grown pet's
  expect(await cardOf($, 'wear crown')).toBe('the crown comes off.\nMiro wears body: a red scarf.')
  expect(await cardOf($, 'wear scarf')).toBe('a red scarf comes off.\nMiro wears nothing.')
  expect((await look()).r).toBe(adult.r)
  expect(await cardOf($, 'wear crown')).toBe('the crown goes on, head.\nMiro wears head: the crown.')
  expect(await cardOf($, 'wear none')).toBe('Miro wears nothing.')
  expect(prefsOf(k.disk).wear).toBe('none nohead')
  expect((await look()).r).toBe(adult.r)
  // a pet not yet at that stage has no crown to put on
  k.disk.pet = { ...k.disk.pet, affection: RULES.grownAt.affection }
  expect(await cardOf($, 'wear crown')).toMatch(/^Not yours yet: crown\. You have: scarf, cap\./)
})

test('many chats, one of them with an older copy: a chat writes only the preference the person changed in it, never a copy of them all', async ($, on) => {
  const first = { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true, wear: 'mug', lang: 'en', hidden: false, diet: false, style: false, cuddles: 2, cuddled: 5, voice: false, personality: '', hatched: 0 }
  const k = home(on, {}, first)
  k.disk.pet = { coins: 0, affection: 0, days: 1, day: dayOf(Date.UTC(2026, 10, 12, 12)), owned: ['shades', 'mug', 'lamp'] }
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  expect(await cardOf($)).toMatch(/^  wears accessory: a coffee mug$/m) // this chat has read the preferences: the mug is on
  const prefKeys = () => [...new Set(k.sets.filter(key => key === 'prefs' || key.startsWith('pref.')))].sort()
  expect(prefKeys()).toEqual([]) // a store that has every preference: reading writes none

  // another chat puts the sunglasses on while this one counts a cuddle: its write lands between this chat's read and its write
  k.meanwhile = () => elsewhere(k.disk, { wear: 'shades mug' })
  await cardOf($, 'pet')
  k.meanwhile = null
  expect(prefsOf(k.disk).wear).toBe('shades mug')
  expect(prefKeys()).toEqual(['pref.cuddled', 'pref.cuddles']) // the cuddle and its time, nothing else

  // every other choice made elsewhere meanwhile is kept the same way, whatever this chat changes
  const there = { wear: 'shades lamp', lang: 'pt', style: true, diet: true, name: 'Zoe', species: 'bunny', voice: true, cuddles: 9 }
  for (const [args, key] of [['hide', 'hidden'], ['show', 'hidden'], ['lang es', 'lang'], ['name Ada', 'name'], ['animal dog', 'species'], ['comments off', 'voice'], ['wear lamp', 'wear'], ['pet', 'cuddles']] as const) {
    k.sets.length = 0
    elsewhere(k.disk, there)
    k.meanwhile = () => elsewhere(k.disk, Object.fromEntries(Object.entries(there).filter(([name]) => name !== key))) // and again while this chat is at it
    await cardOf($, args)
    k.meanwhile = null
    const { [key]: _mine, ...others } = there as Record<string, unknown>
    expect(prefsOf(k.disk)).toMatchObject(others)
    expect(prefKeys().filter(name => name !== `pref.${key}` && !(key === 'cuddles' && name === 'pref.cuddled') && !(key === 'voice' && name === 'pref.voiceAsked'))).toEqual([])
  }
  expect(k.disk.prefs).toEqual({ voiceAsked: true, ...first }) // the one object of the earlier versions: read, never written

  // the row of the parts is open here, and the other chat buys a cap and puts it on: a press on `accessory` changes that part alone,
  // over what the store holds now, not over what this chat saw when the row opened
  elsewhere(k.disk, { wear: 'shades mug' })
  await k.clock.advance(11_000)
  let ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'skin' }); await k.clock.advance(1); await ui.unmount()
  k.disk.pet = { ...k.disk.pet, owned: ['shades', 'mug', 'cap', 'lamp'] }
  elsewhere(k.disk, { wear: 'cap shades mug' })
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'slot-accessory' }); await k.clock.advance(1); await ui.unmount()
  expect(prefsOf(k.disk).wear).toBe('cap shades lamp')

  // a store that cannot be read for a moment: nothing this chat remembers is put in its place, only the choice made now is written
  elsewhere(k.disk, { wear: 'cap shades', style: false })
  k.sets.length = 0
  k.lost = true
  await cardOf($, 'hide')
  k.lost = false
  expect(prefKeys()).toEqual(['pref.hidden'])
  expect(prefsOf(k.disk)).toMatchObject({ wear: 'cap shades', style: false, hidden: true, name: 'Zoe', species: 'bunny' })

  // the chat reloaded over what an earlier version left in the session: every preference in one object, the wear of that time, no language.
  // Its first read, a cuddle and a turn of the head write their own keys and leave the rest
  k.state = { ...k.state, prefs: { value: { hidden: false, wear: 'mug', species: 'fox', born: 'fox', diet: false, style: true, seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], personality: '', hatched: 0, asked: true, cuddles: 2, cuddled: 5 }, version: 99 } }
  elsewhere(k.disk, { wear: 'cap shades mug', hidden: false })
  k.sets.length = 0
  expect(await cardOf($)).toMatch(/^  está usando cabeça: um boné de viagem, rosto: óculos de sol, acessório: uma caneca de café$/m) // the store's, in the language chosen elsewhere
  expect(prefKeys()).toEqual([])
  await cardOf($, 'pet')
  expect(prefKeys()).toEqual(['pref.cuddled', 'pref.cuddles'])
  expect(prefsOf(k.disk)).toMatchObject({ wear: 'cap shades mug', style: false, name: 'Zoe', species: 'bunny', lang: 'pt' })
  expect(k.sets).not.toContain('prefs')
})

test('E20: a store that cannot be read when a chat opens: no pet is made up and none is drawn, nothing is written, and the real pet is there as soon as the store reads', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: false, wear: 'mug', lang: 'en' })
  k.disk.prefs.voiceAsked = false
  k.disk.diary = { lines: [], first: 5 }
  k.lost = true
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  // nothing of a pet on screen, however many times it is drawn: not a different animal and name each time
  for (let i = 0; i < 3; i++) {
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect([await ui.find({ type: 'Raster' }), (await ui.findAll({ type: 'Text' })).length, (await ui.findAll({ type: 'Button' })).length]).toEqual([undefined, 0, 0])
    await ui.unmount()
    await k.clock.advance(600)
  }
  // every command says so in a line, and does nothing: no choice is taken that could not be kept
  for (const args of ['', 'wear none', 'name Bob', 'comments on', 'hide', 'lang es', 'pet']) expect(await cardOf($, args)).toBe("The pet's store cannot be read right now: nothing is shown or changed until it can be.")
  expect(k.sets).toEqual([]) // not asked, not voiceAsked, not a preference, not a pet, not a mark
  // the store reads again: the real pet, with what it had
  k.lost = false
  expect(await cardOf($)).toMatch(/^Miro, Hatchling the fox/)
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Raster' })).toBeTruthy()
  expect((await ui.findAll({ type: 'Text' })).map(x => x.text).join(' ')).toContain('Miro')
  await ui.unmount()
  expect(prefsOf(k.disk)).toMatchObject({ name: 'Miro', species: 'fox', wear: 'mug' })
  // /pet diary clear with a store that reads and cannot be written: said, not thrown
  ;(k as any).ro = true
  expect(await cardOf($, 'diary clear')).toBe('The diary could not be cleared: the store cannot be written now.')
  expect(k.disk.diary).toEqual({ lines: [], first: 5 })
})

test('E21: a phrase that had its time does not come back when the mod is reloaded in a chat that goes on', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true, lang: 'en' })
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  const open = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const b = !!(await ui.find({ type: 'Box', key: 'bubble' })); await ui.unmount(); return b }
  expect(await open()).toBe(true) // the greeting
  await k.clock.advance(5_000)
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true }) // a reload while it is up: it stays, for what is left of its time
  expect(await open()).toBe(true)
  await k.clock.advance(40_000)
  expect(await open()).toBe(false)
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true }) // a hot reload fires session.start again, over the same session state
  expect(await open()).toBe(false)
  await k.clock.advance(2_000)
  expect(await open()).toBe(false)
})

// What a chat already open holds in $.state, and what the store holds, when the mod is reloaded over each earlier version we shipped.
const OLD_PET = { // up to the shop: health, ko, efficient sessions
  variant: null, life: { input: 9000, cacheRead: 8000 }, health: 0, turn: 12, cleanStreak: 2, efficientSessions: 17, bestSessionHit: 0.97, ko: true, drowned: 3, flowerDebt: 2, lastCheerAt: 1000, pending: [{ kind: 'evolve', value: 0 }],
}
const OLD_CHAT = { // the same pet inside a chat: a note, a cheer and a queued one that no longer exist, a session of that time
  ...OLD_PET, issues: [{ kind: 'heavy', untilTurn: 14, until: 5000, detail: '90' }], cheer: { kind: 'unlock', at: 1000, value: 1 }, queued: { kind: 'record', value: 0 },
  session: { reads: { '/a': 1 }, blind: { 'npm test': 2 }, requests: 7, input: 100, cacheRead: 90, lastUsageAt: 900, expectRebuild: false, turnHadIssue: true, issueCount: 3, contextPct: 40, context: 90_000, lean: false, cheeredHighHit: true },
  base: OLD_PET,
}
const RELOADS: Record<string, { prefs: any, anim: any, pet: any }> = {
  'with the budget, before the name': { prefs: { hidden: false, wear: 'shades', species: 'fox', born: 'fox', diet: true, style: false, budget: 50_000 }, anim: { n: 3, rare: -1, demo: '', sleep: false }, pet: OLD_CHAT },
  'with the two traits': { prefs: { hidden: false, wear: 'sombrero', species: 'fox', born: 'fox', diet: false, style: true, seed: 7, name: 'Miro', trait: 'dry', trait2: 'shy', personality: '', hatched: 0, asked: true }, anim: { n: 3, rare: -1, demo: '', sleep: false, egg: 0 }, pet: { ...OLD_CHAT, health: 30, ko: false, cheer: { kind: 'revive', at: 1000 } } },
  'with health and ko, the statistics and the cuddles': { prefs: { hidden: false, wear: '', species: 'fox', born: 'fox', diet: false, style: false, seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], personality: '', hatched: 0, asked: true, cuddles: 2, cuddled: 5 }, anim: { n: 3, rare: -1, demo: '', sleep: false, egg: 0, love: 0 }, pet: { ...OLD_CHAT, session: { ...OLD_CHAT.session, talk: { kind: 'greet', at: 900, greet: 'first' }, lastTalkAt: 900, turns: 4, fails: {}, sit: 4 } } },
  'broken': { prefs: { species: 7, stats: 'x', cuddles: null }, anim: 'x', pet: { session: 5, issues: 5, cheer: 5, owned: 5, base: 5, health: 'x' } },
}
for (const [version, held] of Object.entries(RELOADS)) test(`a reload over the state of an earlier version (${version}): the band and the card are drawn, and every command works`, async ($, on) => {
  const k = home(on, {}, typeof held.prefs.species === 'string' ? held.prefs : { species: 'fox', born: 'fox', seed: 7, name: 'Miro', asked: true })
  k.disk.pet = OLD_PET
  const stored = structuredClone(k.disk.prefs)
  k.state = Object.fromEntries(Object.entries(held).map(([key, value]) => [key, { value, version: 1 }])) // the chat was open: the session's memory is that version's
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }) as any)
  on('turn.step', async function* () { return { answer: '', toolUses: [], usage: { input_tokens: 0, cache_read_input_tokens: 90_000, cache_creation_input_tokens: 0, output_tokens: 1 } } as any })
  on('turn.complete', () => ({ text: '' }) as any)
  const band = async () => {
    for (const surface of ['terminal', 'desktop'] as const) {
      const ui = await $.ui.mount({ ...BAND, surface })
      const said = (await ui.findAll({ type: 'Text' })).map(x => x.text).join(' | ')
      expect(said).toMatch(/\w+  ★ \d+/) // the band is there: a hook that throws draws nothing
      expect(said).not.toMatch(/undefined|NaN|null|out cold|worn|low health|unlocked/)
      if (surface === 'terminal') expect(await ui.find({ type: 'Raster' })).toBeTruthy()
      await ui.unmount()
    }
  }
  const card = async () => {
    const text = await cardOf($)
    expect(text).toMatch(/^\w+, Hatchling the (\w+ )?fox, (baby|adult|crown)   [♥♡]{5} (happy|calm)$/m)
    expect(text).toMatch(/^affection \d+ over \d+ days? of use/m)
    expect(text).toMatch(/^\d+ stars?; owns /m)
    expect(text).not.toMatch(/undefined|NaN|null|health|\/100|efficient|out cold/)
    return text
  }
  // the first thing a reload does is draw, before any event of the session: what it reads is that version's state, untouched
  await band()
  await card()
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  await band()
  await card()
  expect(await cardOf($, 'shop')).toMatch(/^HATCHLING SHOP · you have \d+ stars?$/m)

  // the chat goes on as any other: a turn, a cuddle, something bought and worn, the demo
  await $.prompt.submit({ text: 'go', wait: false, origin: 'user' } as any)
  for await (const _ of $.turn.step({ model: 'claude-opus-5-5' } as any)) ;
  await $.turn.complete({ answer: '', reason: 'answer' } as any)
  await band()
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  await ui.press({ key: 'pet' })
  await ui.press({ key: 'skin' })
  await ui.unmount()
  await cardOf($, 'pet')
  expect(await cardOf($, 'pet')).toMatch(/petted \d+ times/)
  expect(await cardOf($, 'buy mug')).toBe(`Bought a coffee mug for 12 stars, 0 left. ${prefsOf(k.disk).name} wears it now, accessory: /pet wear mug takes it off.`) // the first use of the day, one turn, three cuddles
  await band()
  await cardOf($, 'demo')
  for (let i = 0; i < 12; i++) { await k.clock.advance(5_000); await band() }

  // the store is today's: the old counters are gone, what the efficient sessions had unlocked is owned, the budget is not kept
  expect(Object.keys(k.disk.pet).sort()).toEqual(['affection', 'coins', 'cuddledAt', 'day', 'dayCuddles', 'dayTurns', 'days', 'giftAt', 'lastCheerAt', 'life', 'owned', 'turn', 'variant'].concat('animals', 'lately', 'born').sort())
  expect(k.disk.pet).toMatchObject({ owned: ['eggshell', 'shades', 'mug', 'scarf', 'sombrero'], coins: 0, affection: 12, days: 1 }) // a pet of before the founders' date: this version's first start gives it the eggshell
  expect(Object.keys(k.disk).filter(key => key.startsWith('pref.') && !KNOWN.includes(key.slice(5)))).toEqual([]) // no key for a budget or a trait
  expect(k.disk.prefs).toEqual(stored) // that version's object is as it was: this one writes each preference under its own key
  expect(prefsOf(k.disk).wear).toMatch(/mug/)
  expect(await card()).toMatch(/owns half an eggshell, sunglasses, a coffee mug, a red scarf, a sombrero\./)
})

// The voice. The model is simulated: `reply` is what the next call resolves, `calls` what was asked.
const USAGE = { input_tokens: 300, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
const NONE = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
function voiceKit($: any, on: any, prefs: object = {}) {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [91, 45, 12, 70, 38], asked: true, ...prefs })
  const v = { calls: [] as any[], reply: { isAnswered: true, text: 'Three failures, then green. Noted.', usage: USAGE } as any, boxAfter: undefined as string | undefined, fail: false, said: '', context: 100, onCall: null as (() => void) | null }
  on('model.complete', (_: any, e: any) => { v.calls.push(e); v.onCall?.(); if (v.boxAfter !== undefined) k.box = v.boxAfter; return { value: v.reply } })
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }) as any)
  on('fs.stat', (_: any, e: any) => { (k as any).stats?.push(String(e.path)); if ((k as any).missing?.(String(e.path))) throw new Error('ENOENT'); return { value: { kind: 'file', size: 1, mtimeMs: 5, isLink: false } } }) // `stats`: the paths asked, when a test keeps them; `missing`: the ones that are not there
  on('tool.call', () => (v.fail ? { result: { stdout: 'SECRET OUTPUT', stderr: 'boom', interrupted: false }, isError: true } : { result: { stdout: 'SECRET OUTPUT', stderr: '', interrupted: false } }) as any)
  on('turn.step', async function* () { return { answer: v.said, toolUses: [], usage: { input_tokens: 10, cache_read_input_tokens: v.context, cache_creation_input_tokens: 0, output_tokens: 1 } } as any })
  on('turn.complete', () => ({ text: '' }) as any)
  // the call is never awaited by the mod: give it the time to come back
  const settle = async () => { for (let i = 0; i < 20; i++) await new Promise(r => (globalThis as any).setTimeout(r, 2)) }
  const turn = async (work: () => Promise<unknown> = async () => {}, answer = 'All done: the tests pass now.') => {
    await $.prompt.submit({ text: 'the secret plan', wait: false, origin: 'user' } as any)
    await work()
    await $.turn.complete({ answer, reason: 'answer' } as any)
    await settle()
  }
  const texts = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const t = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text); await ui.unmount(); return t as string[] }
  return Object.assign(k, { v, settle, turn, texts })
}

test('comments off, as installed: no call to a model, whatever happens, and the card says so', async ($, on) => {
  const k = voiceKit($, on)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  k.v.fail = true
  await k.turn(() => $.tool.call({ tool: 'Bash', command: 'npm test', tool_use_id: 't1' } as any))
  await $.command.run({ command: 'pet', args: 'pet' } as any)
  await k.settle()
  expect(k.v.calls).toEqual([])
  expect(k.disk.voice).toBeUndefined()
  expect(await cardOf($)).toMatch(/\ncomments off: fixed lines only, nothing sent\. \/pet comments on lets a small model write them, on your tokens/)
  expect(await cardOf($, 'comments')).toMatch(/^Comments off: the pet says its fixed lines, and nothing is sent anywhere for it\..*spends tokens of your own account: about 650 tokens in and 75 out a line, measured in November 2026 on our own lines and replaced by your own after the first line, never more than 40 lines a day\. The recap after a pause is a larger request: about 1,300 to 2,000 tokens in and 570 to 750 out a recap, measured on three recaps on 16 November 2026\. The model in use: haiku\. \/pet model <alias or id> changes it; a larger model costs more tokens per line\. If it does not answer, the pet stays silent, tells you once a day and never picks another by itself\.$/)
})

test('comments on: it says what it costs and sends; a line at the end of a turn made of counts and names only, counted with its real tokens', async ($, on) => {
  const k = voiceKit($, on)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  const says = await cardOf($, 'comments on')
  expect(says).toMatch(/^Comments on\. They spend tokens of your own account: each line is one request to a small model \(haiku, through Claude Code's own client\)\.\nThe model in use: haiku\. \/pet model <alias or id> changes it; a larger model costs more tokens per line\./)
  expect(says).toMatch(/Sent to the model: the pet's name, animal, five statistics and language; the name you told it with \/pet call me, when you told one; why it speaks; the names of the tools used in the turn with their counts \(the tools of your MCP servers too, by their names\); the program names of the commands that failed; how many files changed; the last 600 characters of the assistant's reply \(during a turn, of what it wrote last in it, and how many minutes the turn has lasted\); the pet's own last 2 lines, so that it does not repeat itself \(they are kept in the store and go back to the model in later chats too\); at most 3 lines of its diary/)
  expect(says).toMatch(/\nAfter a pause the pet says once where the work got to and what is left: when 30 minutes pass after a turn with no new prompt, or when you resume a chat left for longer\. For that one line, once per pause and once more each time you resume a closed chat, it sends up to 16000 characters: the first 300 of your last prompt and the end of the text the assistant wrote in the last turn \(text only: nothing a tool was given or answered\)\. It counts in the day's lines and in the tokens like any other line, and it is a larger request than a comment \(its cost is below\)\. Neither what is sent nor the line is kept on disk\.\n/)
  expect(says).toMatch(/Never sent by the pet itself: the content of a file, the output of a command, the arguments of a command, a file path, your prompts to the assistant but for the start of the last one in a recap\. But the assistant's text is sent as it is/)
  expect(says).toMatch(/Cost: about 650 tokens in and 75 out a line, measured in November 2026 on our own lines and replaced by your own after the first line\. The tokens out are more than the line's own, about 12: the rest is the model's thinking, which a mod cannot switch off \(it can only ask for low effort, and does\)\. The recap: about 1,300 to 2,000 tokens in and 570 to 750 out a recap, measured on three recaps on 16 November 2026\. The tokens are the ones each call reports; what they cost in money depends on the model haiku leads to on your account\.\n/)
  expect(says).not.toContain('$')
  expect(says).toMatch(/at most one line every 10 minutes; without that wait after a failed command, a turn that changed 5 files or more, or a cuddle: each of those waits 30, 30 and 20 seconds since the last line for the same reason\. A line is counted in the day when it is asked for, so one whose call fails or runs out of time is counted too\. Also during a turn that lasts longer than 10 minutes, under the same wait\. Never more than 40 lines a day, over all your chats\./)
  expect(says).toMatch(/Today: 0 of 40 lines, 0 tokens \(0 in all\): 40 left\. \/pet comments off stops them\.$/)
  expect(prefsOf(k.disk).voice).toBe(true)
  expect(k.v.calls).toEqual([]) // turning it on asks nothing

  await k.turn(async () => {
    await $.tool.call({ tool: 'Read', file_path: '/w/private/keys.txt', tool_use_id: 'r1' } as any)
    await $.tool.call({ tool: 'Bash', command: 'TOKEN=abc deploy --key hunter2', tool_use_id: 'b1' } as any)
    await $.tool.call({ tool: 'Bash', command: 'ls', tool_use_id: 'b2' } as any)
    await $.tool.call({ tool: 'Edit', file_path: '/w/private/app.js', tool_use_id: 'e1' } as any)
  }, `${'x'.repeat(700)} All done: the tests pass now.`)
  expect(k.v.calls.length).toBe(1)
  const ask = k.v.calls[0]
  expect(ask).toMatchObject({ model: 'haiku', maxTokens: 30, effort: 'low', timeoutMs: 4000 })
  expect(ask.system).toMatch(/^You are Miro, a small pixel fox /)
  expect(ask.system).toMatch(/\nYour body: pointed ears, paws, a bushy tail.*Speak only of parts you have\./) // its animal, so it names no part it lacks
  expect(ask.prompt).not.toMatch(/last lines/) // nothing said yet
  expect(ask.system).toMatch(/WIT 91, CURIOSITY 45, CALM 12, RIGOR 70, WARMTH 38\./)
  expect(ask.system).toMatch(/First of all you are dry and deadpan, you understate\. Then rigorous, you count and check\. Your weak point: you startle easily\./)
  expect(ask.system).toMatch(/React to the moment in the first person.*Do not report it/)
  expect(ask.system).toMatch(/never more than 8\. Plain English\. No file names, no paths, no quoted text, no quotation marks, no exclamation marks, no emoji, no advice\. Never unkind to the person\./)
  expect(ask.prompt).toMatch(/^What just happened \(background only, none of it is to be repeated\):\n- the turn ended\n- tools used: Bash 2, Read 1, Edit 1\n- commands that failed: none\n- files changed: 1\n- the assistant's reply ended: x+ All done: the tests pass now\.\n\nWhat you remember of your time with this person:\n- the diary begins \(today\)\nYou may hint at one of these when it fits, or at none\. Never list them\.\n\nNow your one line: /)
  expect(ask.prompt.split('reply ended: ')[1].split('\n')[0].length).toBe(600)
  expect(JSON.stringify(ask)).not.toMatch(/secret plan|SECRET OUTPUT|hunter2|TOKEN|keys\.txt|app\.js|private/)
  expect(await k.texts()).toContain('Three failures, then green. Noted.')
  // the real tokens of the call, and no dollars: none kept, none said
  expect(k.disk.voice).toMatchObject({ today: 1, todayTokens: 320, lines: 1, input: 300, output: 20 })
  expect(Object.keys(k.disk.voice).filter(key => /usd/i.test(key))).toEqual([])
  expect(await cardOf($)).toMatch(/\ncomments on: model haiku, about 300 tokens in and 20 out a line, 1 of 40 lines today, 320 tokens today, 320 in all$/m)
  expect(await cardOf($, 'comments')).toMatch(/Cost: 300 tokens in and 20 out a line, measured over the 1 line paid so far\./)
  expect(await cardOf($, 'comments')).toMatch(/\nToday: 1 of 40 lines, 320 tokens \(320 in all\): 39 left\./)
  expect(await cardOf($, 'comments')).not.toContain('$')

  // the wait: the next turn ends within 10 minutes and asks nothing; the fixed line is back with the prompt
  await k.clock.advance(60_000)
  await k.turn()
  expect(k.v.calls.length).toBe(1)
  expect(await k.texts()).not.toContain('Three failures, then green. Noted.')
  // a failed command skips the wait, and only the program's name is sent
  k.v.fail = true
  k.v.reply = { isAnswered: true, text: '"Deploy fell over twice!! 🎉 I counted both of them carefully, and then once more to be sure."\nSecond line', usage: USAGE }
  await k.turn(() => $.tool.call({ tool: 'Bash', command: 'cd /srv && TOKEN=abc deploy --key hunter2', tool_use_id: 'b3' } as any))
  expect(k.v.calls.length).toBe(2)
  expect(k.v.calls[1].prompt).toMatch(/\n- a command or a test failed in this turn\n- tools used: Bash 1\n- commands that failed: deploy 1\n- files changed: 0\n/)
  expect(JSON.stringify(k.v.calls[1])).not.toMatch(/hunter2|TOKEN|srv/)
  expect(k.v.calls[1].prompt).toMatch(/\n\nYour last lines, oldest first: Three failures, then green\. Noted\.\nDo not repeat them/) // what it said last goes back, so the next line differs
  // too long: dropped whole, never cut. The fixed line stays, and the call is counted as paid and as dropped
  expect((await k.texts()).join('|')).not.toMatch(/Deploy fell|counted/)
  expect(k.disk.voice).toMatchObject({ today: 2, lines: 2, dropped: 1 })
  expect(await cardOf($, 'comments')).toMatch(/A line that comes back wider than 60 columns on screen \(a Chinese character takes two\) is not shown, and is paid for all the same: 1 of 2 so far\./)
  // quotation marks, an emoji and exclamation marks are taken out of a line that fits
  k.v.reply = { isAnswered: true, text: '"Deploy" fell over, \'twice\'!! 🎉\nSecond line', usage: USAGE }
  // B8: a second failure within 30 s of the last line about one asks nothing: no volley
  await k.turn(() => $.tool.call({ tool: 'Bash', command: 'deploy', tool_use_id: 'b4a' } as any))
  expect(k.v.calls.length).toBe(2)
  await k.clock.advance(31_000)
  await k.turn(() => $.tool.call({ tool: 'Bash', command: 'deploy', tool_use_id: 'b4' } as any))
  expect(await k.texts()).toContain('Deploy fell over, twice.')
  k.v.fail = false
  // a turn that changed 5 files skips the wait too
  k.v.reply = { isAnswered: true, text: 'Five files in one go.', usage: USAGE }
  await k.turn(async () => { for (let i = 0; i < 5; i++) await $.tool.call({ tool: 'Write', file_path: `/w/f${i}.js`, tool_use_id: `w${i}` } as any) })
  expect(k.v.calls.length).toBe(4)
  expect(k.v.calls[3].prompt).toMatch(/\n- this turn changed many files\n- tools used: Write 5\n- commands that failed: none\n- files changed: 5\n/)
  // files changed by a shell command are not seen: such a turn is an ordinary one, and waits
  await k.turn(() => $.tool.call({ tool: 'Bash', command: 'for i in 1 2 3 4 5 6; do echo x > f$i.txt; done', tool_use_id: 'b5' } as any))
  expect(k.v.calls.length).toBe(4)
  // and so does a cuddle: the fixed line answers the command at once, the voice's is in the bubble when it comes
  k.v.reply = { isAnswered: true, text: 'A pat, logged with thanks.', usage: USAGE }
  expect(await cardOf($, 'pet')).toMatch(/^Miro: (noted\. carry on|fine\. one more, then work|pat received, in good order|a little to the left\. there)  \(petted once/)
  await k.settle()
  expect(k.v.calls.length).toBe(5)
  expect(k.v.calls[4].prompt).toMatch(/\n- the person just petted you\n/)
  expect(k.v.calls[4].prompt).toMatch(/\nYour last lines, oldest first: Deploy fell over, twice\. \/ Five files in one go\.\n/) // the two newest shown; the dropped one is not among them
  expect(k.disk.voice.last).toEqual(['Five files in one go.', 'A pat, logged with thanks.'])
  expect(await k.texts()).toContain('A pat, logged with thanks.')
  // an ordinary turn again: silent until 10 minutes after the last line, then it speaks
  await k.clock.advance(9 * 60_000)
  await k.turn()
  expect(k.v.calls.length).toBe(5)
  await k.clock.advance(60_000)
  await k.turn()
  expect(k.v.calls.length).toBe(6)
  expect(k.disk.voice).toMatchObject({ today: 6, lines: 6, input: 1800, output: 120, dropped: 1 })
})

test('comments on, and the call fails, is cut short or says nothing usable: the fixed line stays, and the call stays counted in the day, as it was before it went out', async ($, on) => {
  const k = voiceKit($, on, { voice: true })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  k.v.fail = true
  const failing = () => $.tool.call({ tool: 'Bash', command: 'npm test', tool_use_id: 't' } as any)
  for (const reply of [
    { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage: NONE },
    { isAnswered: false, reason: 'aborted', usage: NONE }, // slower than the 4 seconds allowed
  ]) {
    k.v.reply = reply
    const before = await k.texts()
    await k.turn(failing)
    expect(k.disk.voice).toMatchObject({ today: k.v.calls.length, lines: k.v.calls.length, todayTokens: 0, input: 0 }) // counted, at no cost
    expect((await k.texts()).length).toBe(before.length) // no line was added to the bubble
    await k.clock.advance(31_000)
  }
  expect(k.v.calls.length).toBe(2)
  // a reply with nothing to show is paid for, so it is counted, and nothing is shown
  k.v.reply = { isAnswered: true, text: '🎉!!', usage: USAGE }
  await k.turn(failing)
  expect(k.v.calls.length).toBe(3)
  expect(k.disk.voice).toMatchObject({ today: 3, lines: 3, input: 300 })
  expect((await k.texts()).join('|')).not.toMatch(/🎉|!/)
  expect((await k.texts()).join('|')).toMatch(/npm failed 3 times in a row/) // the fixed note is what the bubble holds
})

test('comments on: the cap of the day stops it, a new day starts the count again, and it never speaks while the person types', async ($, on) => {
  const k = voiceKit($, on, { voice: true })
  const T0 = Date.UTC(2026, 10, 12, 12)
  k.disk.voice = { day: dayOf(T0), today: RULES.voiceCapDay, todayUsd: 0.0016, lines: 90, usd: 0.0036, input: 27000, output: 1800, at: T0 - 3_600_000 } // a store of before the tokens, with its dollars: not read, not shown, nothing breaks
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  k.v.fail = true
  const failing = () => $.tool.call({ tool: 'Bash', command: 'npm test', tool_use_id: 't' } as any)
  await k.turn(failing)
  await $.command.run({ command: 'pet', args: 'pet' } as any)
  await k.settle()
  expect(k.v.calls).toEqual([]) // 40 lines today: not one more, not even for a failure or a cuddle
  expect(await cardOf($)).toMatch(/\ncomments on: model haiku, about 300 tokens in and 20 out a line, 40 of 40 lines today, 0 tokens today, 28800 in all$/m)
  expect(await cardOf($, 'comments')).toMatch(/\nCost: 300 tokens in and 20 out a line, measured over the 90 lines paid so far\..*\nToday: 40 of 40 lines, 0 tokens \(28800 in all\): none left, they come back tomorrow\. \/pet comments off stops them\.$/s)
  expect(await cardOf($, 'comments')).not.toMatch(/\$|0\.0016|0\.0036/)
  // the next day: what the store counted belongs to the day before
  k.disk.voice.day--
  k.box = 'I am typing'
  await k.turn(failing)
  expect(k.v.calls).toEqual([]) // the person is typing: nothing is asked
  k.box = ''
  await k.turn(failing)
  expect(k.v.calls.length).toBe(1)
  expect(k.disk.voice).toMatchObject({ today: 1, lines: 91 })
  // a line that comes back while the person types waits for an empty box
  k.v.reply = { isAnswered: true, text: 'Held until you were done.', usage: USAGE }
  k.v.boxAfter = 'typing now'
  await k.clock.advance(31_000)
  await k.turn(failing)
  expect(k.v.calls.length).toBe(2)
  expect(await k.texts()).not.toContain('Held until you were done.')
  k.box = ''; k.v.boxAfter = undefined
  await k.clock.advance(6_000) // past the line of the cuddle above, which holds the bubble for 5 s
  await k.settle()
  expect(await k.texts()).toContain('Held until you were done.')
})

test('under the bench the voice is off, even when the person had it on', async ($, on) => {
  const k = voiceKit($, on, { voice: true })
  k.env.HATCHLING_BENCH = '/tmp/bench'
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  k.v.fail = true
  await k.turn(() => $.tool.call({ tool: 'Bash', command: 'npm test', tool_use_id: 't' } as any))
  await $.command.run({ command: 'pet', args: 'pet' } as any)
  await k.settle()
  expect(k.v.calls).toEqual([])
  expect(await cardOf($, 'comments on')).toBe('Comments off: under the bench they are never used.')
  expect(await cardOf($)).toMatch(/\ncomments off:/)
})

test('the voice is asked for once, at the first start of a pet born before: unanswered it stays off, and no later chat asks again', async ($, on) => {
  const k = voiceKit($, on, { voiceAsked: false })
  k.disk.voice = { lines: 10, input: 5000, output: 200 } // lines paid for earlier: the figure in the question is the measured one
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  const Q = 'May I comment on your work? It uses a small\nmodel on your account: about 500 tokens in\nand 20 out a line (measured on your lines),\nat most 40 lines a day. It gets a short\nsummary of the turn. A recap after a pause:\nabout 1,300 to 2,000 in and 570 to 750 out.\nDetails: /pet comments'
  expect(await k.texts()).toContain(Q)
  expect([!!prefsOf(k.disk).voice, prefsOf(k.disk).voiceAsked]).toEqual([false, true]) // marked when it comes up
  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await desk.findAll({ type: 'Text' })).map(x => x.text)).toContain(Q.replace(/\n/g, ' ')) // the apps wrap it themselves
  expect((await desk.findAll({ type: 'Button' })).map(x => x.text)).toEqual(['pet', 'comments on', 'stay quiet']) // and have the buttons to answer it
  await desk.unmount()
  // a cuddle, a slash command and a reload leave it up; the next prompt sent takes it away, with the voice off
  await $.command.run({ command: 'pet', args: 'pet' } as any)
  expect((await k.texts()).join(' ')).not.toMatch(/May I/) // the cuddle's line passes in front for its 5 seconds, and the question is back after
  await k.clock.advance(6_000)
  expect(await k.texts()).toContain(Q)
  await $.prompt.submit({ text: '/pet', command: { name: 'pet', args: '' }, wait: false, origin: 'user' } as any)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect(await k.texts()).toContain(Q)
  await k.turn()
  expect((await k.texts()).join(' ')).not.toMatch(/May I/)
  expect([!!prefsOf(k.disk).voice, prefsOf(k.disk).voiceAsked]).toEqual([false, true])
  expect(k.v.calls).toEqual([])
  // the next chat, and a start over an emptied session: no second question
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as any)
  k.state = {}
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect((await k.texts()).join(' ')).not.toMatch(/May I/)
  expect(await cardOf($, 'comments on')).toMatch(/^Comments on\./) // still reachable
  expect(prefsOf(k.disk).voice).toBe(true)
})

test('the question about the voice: "voice on" turns it on and keeps the answer, /pet comments answers it too, and who had it on is not asked', async ($, on) => {
  const k = voiceKit($, on, { voiceAsked: false })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.findAll({ type: 'Button' })).map(x => x.text)).toEqual(['pet', 'comments on', 'stay quiet'])
  await ui.press({ key: 'voice-on' })
  await ui.unmount()
  expect(prefsOf(k.disk)).toMatchObject({ voice: true, voiceAsked: true })
  expect(k.toasts.at(-1)).toBe('Hatchling: comments on. /pet comments off stops them, /pet comments says what they send and cost.')
  expect((await k.texts()).join(' ')).not.toMatch(/May I/)
  expect(k.v.calls).toEqual([]) // the answer asks no model
  await k.turn()
  expect(k.v.calls.length).toBe(1) // and from the next turn it speaks
})

test('the question about the voice goes when /pet comments off is typed; a pet that already speaks is never asked', async ($, on) => {
  const k = voiceKit($, on, { voiceAsked: false })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect((await k.texts()).join(' ')).toMatch(/May I comment/)
  await cardOf($, 'comments off')
  expect((await k.texts()).join(' ')).not.toMatch(/May I/)
  expect([!!prefsOf(k.disk).voice, prefsOf(k.disk).voiceAsked]).toEqual([false, true])

  // chosen before this version: not asked, and the choice stays
  elsewhere(k.disk, { voice: true, voiceAsked: false })
  k.state = {}
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect((await k.texts()).join(' ')).not.toMatch(/May I/)
  expect(prefsOf(k.disk)).toMatchObject({ voice: true, voiceAsked: true })
})

test('under the bench nobody is asked about the voice, and the person\'s preferences are not touched', async ($, on) => {
  const k = voiceKit($, on, { voiceAsked: false })
  k.env.HATCHLING_BENCH = '/tmp/bench'
  const before = JSON.stringify(prefsOf(k.disk))
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect((await k.texts()).join(' ')).not.toMatch(/May I/)
  await k.turn()
  expect(JSON.stringify(prefsOf(k.disk))).toBe(before)
  expect(k.v.calls).toEqual([])
})

// The languages. `home` gives a person at the prompt; its `env` is the system's.
test('a newborn takes the language of the system when it is one of ours, LC_ALL before LANG; a pet born before keeps English; /pet lang picks and it is kept', async ($, on) => {
  const k = home(on, {})
  k.env.LANG = 'es_ES.UTF-8'
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect(prefsOf(k.disk).lang).toBe('es') // written at birth: the choice is in the preferences
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.findAll({ type: 'Text' })).map(x => x.text)).toContain('un huevo. algo se mueve dentro')
  await ui.unmount()
  await k.clock.advance(29_500) // hatched, and it said who it is
  const asked = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await asked.findAll({ type: 'Text' })).map(x => x.text).join(' ')).toMatch(/^\S+  ★ 0 · ¿Puedo comentar tu trabajo\?/)
  expect((await asked.findAll({ type: 'Button' })).map(x => x.text)).toEqual(['acariciar', 'comentarios sí', 'en silencio'])
  await asked.press({ key: 'voice-off' })
  expect(k.toasts.at(-1)).toBe('Hatchling se queda callado. /pet comments on lo cambia.')
  await asked.unmount()
  expect(await cardOf($, 'lang')).toBe('Idioma: español. /pet lang <en|es|pt|zh> lo cambia.')
  expect(await cardOf($, 'lang it')).toBe('No hay idioma it. Hay: en, es, pt, zh.') // not one of ours: said, and nothing changes
  expect(prefsOf(k.disk).lang).toBe('es')
  expect(await cardOf($, 'lang zh')).toBe('Hatchling 现在说简体中文。')
  expect(prefsOf(k.disk).lang).toBe('zh')
  // a chat that starts later, whatever the system says now, speaks the language chosen
  k.env.LANG = 'pt_BR.UTF-8'
  k.state = {}
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect(await cardOf($, 'lang')).toBe('语言：简体中文。/pet lang <en|es|pt|zh> 可以切换。')
  expect(await cardOf($, 'lang en')).toBe('Hatchling now speaks English.')
})

for (const [env, lang] of [[{ LC_ALL: 'pt_BR.UTF-8', LANG: 'es_ES.UTF-8' }, 'pt'], [{ LC_ALL: '', LANG: 'zh_CN.UTF-8' }, 'zh'], [{ LANG: 'it_IT.UTF-8' }, 'en'], [{}, 'en'], [{ LANG: 'zh_TW.UTF-8' }, 'en']] as const) test(`born under ${JSON.stringify(env)}: ${lang}`, async ($, on) => {
  const k = home(on, {})
  Object.assign(k.env, env)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect(prefsOf(k.disk).lang).toBe(lang)
})

test('a pet born before the languages keeps English under any system, and a language chosen in another chat reaches this one', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [91, 45, 12, 70, 38], asked: true })
  k.env.LANG = 'zh_CN.UTF-8'
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect(prefsOf(k.disk).lang).toBe('en')
  expect(await cardOf($)).toMatch(/^Miro, Hatchling the fox, baby/)
  elsewhere(k.disk, { lang: 'pt' }) // another chat ran /pet lang pt
  expect(await cardOf($)).toMatch(/^Miro, Hatchling: raposa, filhote   ♡♡♡♡♡ (feliz|calmo)\npersonalidade: Fala seco e curto, e pula a cada linha vermelha\.\n  HUMOR       █████████░  91  ponto forte\n/)
})

test('the card, the shop and the short replies are in the language; command names and item ids are not, and the columns line up by width on screen', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [91, 45, 12, 70, 38], asked: true, lang: 'zh' })
  k.disk.pet = { coins: 60, affection: 3, days: 2, owned: ['mug'], animals: ['dog'] }
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  const card = await cardOf($)
  expect(card).toMatch(/^Miro，Hatchling，狐狸，幼年   .{5} (开心|平静)\n性格：说话干脆利落，却见到红字就一惊。\n  机智 █████████░  91  最强\n  好奇 █████░░░░░  45\n  沉稳 █░░░░░░░░░  12  弱点\n/)
  expect(card).toMatch(/\n\d+ 颗星；拥有咖啡杯。\/pet shop\n  装扮：配饰 咖啡杯\nbriefox 未开：\/pet briefox on 会把“Be brief\.”加入系统提示。.*\n点评未开：.*\/pet comments on/)
  expect(card).not.toMatch(/[!！]|undefined|\{\w+\}/)
  const shop = await cardOf($, 'shop')
  expect(shop.split('\n')[0]).toMatch(/^HATCHLING 商店 · 你有 \d+ 颗星$/)
  // every price ends in the same column on screen, though the names differ in letters: 墨西哥草帽 is five characters and ten columns
  const rows = shop.split('\n').filter(r => /^  \w+ +\S+ +\d+/.test(r))
  expect(rows.length).toBe(SOLD.length + RULES.animals.length) // the things to wear, the coat, and the animals
  expect(shop).toMatch(/\n  wizard .*\n\n  pastel .*\n  terminal .*\n  golden +金色毛色 +300  毛色\n\n/) // the coats in rows of their own, last
  const col = (r: string) => { const upTo = r.slice(0, r.search(/\d+(?=  \S+( +(已拥有.*|12 月出售))?$)/)); return [...upTo].reduce((n, ch) => n + (/[⺀-鿿＀-｠]/.test(ch) ? 2 : 1), 0) + /\d+/.exec(r.slice(upTo.length))![0].length }
  expect(new Set(rows.map(col)).size).toBe(1)
  expect(shop).toMatch(/\n  mug +咖啡杯 +\d+  配饰  已拥有，穿戴中\n/)
  expect(shop).toMatch(/\n\nMiro 现在的装扮：配饰 咖啡杯。\n\n\/pet shop shades 购买墨镜：输入该行的第一个词，即 id。\/pet wear <item> 戴上，已经戴着就取下；\/pet wear none 全部取下。每个部位一件。/)
  expect(await cardOf($, 'buy shades')).toMatch(/^花 \d+ 颗星买了墨镜，还剩 \d+ 颗星。Miro 已经戴上（脸部）：\/pet wear shades 可以取下。$/)
  expect(await cardOf($, 'skin')).toMatch(/^Miro 的装扮\n  脸部  墨镜\n  配饰  咖啡杯\n  动物  狐狸\n\/pet wear <item> 戴上/)
  expect(await cardOf($, 'wear shades') + await cardOf($, 'wear shades')).toMatch(/Miro 现在的装扮：脸部 墨镜，配饰 咖啡杯。$/) // one colon, not two in a row
  expect(await cardOf($, 'wear off mug')).toBe('取下了咖啡杯。\nMiro 现在的装扮：脸部 墨镜。')
  expect(await cardOf($, 'wear none')).toBe('Miro 什么都没戴。')
  expect(await cardOf($, 'wear sombrero')).toMatch(/^还不是你的：sombrero。你有：shades, mug。/)
  expect(await cardOf($, 'animal')).toMatch(/^请选一个：fox, dog。\n其他动物每只 100 颗星，只需解锁一次：penguin, chick, bunny, cactus。\/pet shop <animal> 解锁。$/)
  expect(await cardOf($, 'animal dog')).toBe('Hatchling 现在是小狗了。')
  expect(await cardOf($, 'name')).toMatch(/^它叫 Miro。\/pet name <名字> 可以改/)
  expect(await cardOf($, 'pet')).toMatch(/^Miro: (收到。继续吧|行。再来一下就干活|抚摸已收到，一切正常|往左一点。对，就这儿)  \(摸了 1 次，\+\d+ 颗星\)$/)
  expect(await cardOf($, 'hide')).toBe('Hatchling 已隐藏。/pet show 让它回来。')
  expect(await cardOf($, 'show')).toBe('Hatchling 回来了。')
  // Spanish, on the same pet
  await cardOf($, 'lang es')
  expect(await cardOf($)).toMatch(/^Miro, Hatchling: perro, cría .*\ncarácter: Lo dice seco y corto, y se sobresalta con cada línea roja\.\n  INGENIO    █████████░  91  punto fuerte\n(.*\n)+una caricia, la última ahora mismo\n/)
  expect(await cardOf($, 'shop')).toMatch(/^TIENDA DE HATCHLING · tienes \d+ estrellas\n\n  escribe     nombre\n  shades      gafas de sol +\d+  cara       tuyo\n  mug         una taza de café +\d+  accesorio  tuyo\n/)
})

test('the bubble in Chinese: wrapped and bordered by width on screen, two columns a character, and the keys translated', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [91, 45, 12, 70, 38], asked: true, lang: 'zh' })
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false } }) as any)
  on('fs.stat', () => ({ value: { kind: 'file', size: 1, mtimeMs: 5, isLink: false } }))
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  const bubble = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const b = (await ui.find({ type: 'Box', key: 'bubble' }))!; const out = { width: b.props.width as number, lines: (b.children as { children: string[] }[]).map(x => x.children[0]!), buttons: (await ui.findAll({ type: 'Button' })).map(x => x.text), link: (await ui.find({ type: 'Link' }))?.text }; await ui.unmount(); return out }
  // the greeting: 'Miro: ' and thirteen characters, 6 + 26 columns, where the letters alone would say 19
  const hello = await bubble()
  expect(hello.lines).toEqual(['Miro: 今天的第一场对话。又开始了'])
  expect(hello.width).toBe(6 + 26 + 4)
  expect(hello.buttons).toEqual(['装扮', '摸摸']) 
  // a note: the advice is 17 characters and a stop, 36 columns, one line; in letters it would be 18
  await $.tool.call({ tool: 'Read', file_path: '/a.txt' })
  await $.tool.call({ tool: 'Read', file_path: '/a.txt' })
  const note = await bubble()
  expect(note.lines).toEqual(['重复读取，内容没变：a.txt', '只是提醒。按钮会让助手用已有的内容。'])
  expect(note.width).toBe(36 + 4)
  expect(note.buttons).toEqual(['装扮', '摸摸', '修复'])
  expect(note.link).toBe('指南')
  // a line of 26 characters is 52 columns: it wraps after 22, and the border hugs 44
  elsewhere(k.disk, { voiceAsked: false })
  k.state = {}
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  const ask = await bubble()
  expect(ask.lines[0]!.split('\n')).toEqual(['我可以点评你的工作吗？会用你账户上的小模型，', '每句约输入 650、输出 75 token（2026 年 11 月', '测得），每天最多 40 句，并发给它一段本轮的简', '短摘要。暂停后的回顾：约输入 1300 到 2000、', '输出 570 到 750。详情：/pet comments'])
  expect(ask.width).toBe(48)
  expect(ask.buttons.slice(-2)).toEqual(['开启点评', '保持安静'])
})

test('comments on in another language: the model is told the language, and a reply is held to its width on screen, not its letters', async ($, on) => {
  const k = voiceKit($, on, { voice: true, lang: 'zh' })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  k.v.reply = { isAnswered: true, text: '这次改得真利落，我数了两遍都没问题。', usage: USAGE } // 18 characters, 36 columns
  await k.turn()
  expect(k.v.calls[0].system).toMatch(/Plain Simplified Chinese: the line is in Simplified Chinese.*for instance: /s)
  expect(k.v.calls[0].prompt).toMatch(/in about ten characters, in Simplified Chinese\./)
  expect((await k.texts()).join(' | ')).toMatch(/这次改得真利落，我数了两遍都没问题。/)
  // 31 characters are 62 columns: over the limit of 60, though only 31 letters. Dropped, paid for, and counted as dropped
  await k.clock.advance(11 * 60_000)
  k.v.reply = { isAnswered: true, text: '好'.repeat(31), usage: USAGE }
  await k.turn()
  expect((await k.texts()).join(' | ')).not.toMatch(/好好好/)
  expect(k.disk.voice).toMatchObject({ lines: 2, dropped: 1 })
})

// The diary. `home` starts on 12 November 2026 at noon UTC; a day later is the next day anywhere.
const DAY = 86_400_000
const bubbleOf = async ($: any) => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const b = await ui.find({ type: 'Box', key: 'bubble' }); const lines = ((b?.children ?? []) as { children: string[] }[]).map(x => x.children[0]!.replace(/\n/g, ' ')); await ui.unmount(); return lines }

test('the diary is written by the mod itself, in the store: the first day, a cuddle milestone, the first thing bought, time at work; only times, numbers and names', async ($, on) => {
  const k = voiceKit($, on)
  forget(k.disk) // a newborn
  await $.session.start({ cwd: '/home/me/secret-client/hatchling', surface: 'terminal', isInteractive: true })
  expect(k.disk.diary.lines).toEqual([{ at: k.clock.now(), kind: 'first' }])
  expect(k.disk.diary.folders).toEqual({ hatchling: 1 }) // the folder's name, never its path
  await k.clock.advance(9_000)
  // a turn with a command that fails and a file read: none of it reaches the diary
  k.v.fail = true
  await k.turn(async () => { await $.tool.call({ tool: 'Bash', command: 'npm test --token=hunter2' } as any); await $.tool.call({ tool: 'Read', file_path: '/home/me/secret-client/notes.txt' } as any) })
  await k.clock.advance(10 * 60_000)
  await k.turn()
  expect(k.disk.diary.today.ms).toBe(10 * 60_000 + 9_000) // at work since the chat opened: the hatching, then ten minutes between two turns
  elsewhere(k.disk, { cuddles: 9 })
  k.disk.pet = { ...k.disk.pet, coins: 99 }
  k.state = {}
  await $.session.start({ cwd: '/home/me/secret-client/hatchling', surface: 'terminal', isInteractive: true })
  await cardOf($, 'pet')
  await cardOf($, 'buy mug')
  await cardOf($, 'buy scarf')
  expect(k.disk.diary.lines.map((l: any) => [l.kind, l.n ?? l.name])).toEqual([['first', undefined], ['cuddles', 10], ['bought', 'mug']])
  const kept = JSON.stringify(k.disk.diary)
  expect(kept).not.toMatch(/npm|hunter2|secret|notes|SECRET|boom|plan|tests pass|home\/me/)
  for (const l of k.disk.diary.lines) expect(Object.keys(l).filter(x => !['at', 'kind', 'n', 'name'].includes(x))).toEqual([])
  // the work report: counts and the folder's name, from what the chats left; nothing of a command, a file or a prompt
  expect(Object.values(k.disk.work.days)).toEqual([{ chats: 2, turns: 2, files: 0, folders: { hatchling: 2 } }])
  expect(JSON.stringify(k.disk.work)).not.toMatch(/npm|hunter2|secret|notes|SECRET|boom|plan|tests pass|home\/me/)
  expect(await cardOf($, 'diary')).toMatch(/^WORK DIARY\ntoday: 2 chats, 1 folder, 2 turns, 0 files changed\n  folders: hatchling 2\nyesterday: nothing kept\nCounts and folder names only/)
  // /pet diary lines shows all of the pet's own diary; /pet diary clear empties both
  const page = await cardOf($, 'diary lines')
  expect(page).toMatch(new RegExp(`^HATCHLING DIARY · 3 of 40 lines\\n\\n${dated(k.clock.now())}  first day together\\n.*  10 cuddles\\n.*  first thing bought: a coffee mug\\n\\ncounted for the habits: chats opened by folder: hatchling 2; .*; at work today: 10 min\\nOnly times, counts and folder names, kept on this machine`))
  expect(await cardOf($, 'diary clear')).toBe('The diary is empty now.')
  expect(k.disk.diary.lines).toEqual([])
  expect(await cardOf($, 'diary lines')).toMatch(/^The diary is empty\. The pet writes it by itself/)
  expect(await cardOf($, 'diary today')).toMatch(/^WORK DIARY\ntoday: nothing kept\n/)
  expect(k.v.calls).toEqual([]) // zero tokens: no model was asked for any of it
})

test('no diary without a person at the prompt', async ($, on) => {
  const k = voiceKit($, on)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: false })
  await k.turn()
  await cardOf($, 'pet')
  expect(k.disk.diary).toBeUndefined()
})

test('no diary under the bench, even with a person at the prompt', async ($, on) => {
  const k = voiceKit($, on)
  k.env.HATCHLING_BENCH = '/var/tmp/bench'
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await k.turn()
  await cardOf($, 'pet')
  expect(k.disk.diary).toBeUndefined()
  expect(await cardOf($, 'diary')).toBe('No diary: under the bench none is kept.')
})

test('a memory of the diary is said in place of a plain greeting, at most once a day, in the language and the character; the offer to resume goes first', async ($, on) => {
  const k = voiceKit($, on, { lang: 'es' })
  // a diary a month old today, begun in this folder at this hour: written by the engine, as the mod would have
  const T0 = k.clock.now() - 30 * DAY
  let d = diaryOpened(diaryOf(undefined), { now: T0, folder: 'w', born: true })
  for (let i = 1; i < 30; i++) d = diaryOpened(d, { now: T0 + i * DAY, folder: 'w' })
  k.disk.diary = d
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect(await bubbleOf($)).toEqual(['un mes de nosotros. no me lo esperaba']) // Miro's wit speaks
  expect(k.disk.diary.lines.at(-1).kind).toBe('month')
  // the same day, another chat: the ordinary greeting, no second memory
  await $.session.end({ reason: 'exit', sessionId: 'me' } as any)
  k.state = {}
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  const again = await bubbleOf($)
  expect(again.join(' ')).not.toMatch(/un mes/)
  expect(k.v.calls).toEqual([]) // fixed lines: no model
})

test('the day after, a habit that is true now is the memory: here again at the usual hour, said as the pet\'s character says it', async ($, on) => {
  const k = voiceKit($, on, { lang: 'es' })
  const T0 = k.clock.now() - 31 * DAY
  let d = diaryOpened(diaryOf(undefined), { now: T0, folder: 'w', born: true })
  for (let i = 1; i < 31; i++) d = diaryOpened(d, { now: T0 + i * DAY, folder: 'w' })
  k.disk.diary = { ...d, told: d.lastDay, toldKind: 'month' } // the month was said yesterday
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  const band = ['de madrugada', 'por la mañana', 'por la tarde', 'por la noche'][bandOf(k.clock.now())]
  expect(await bubbleOf($)).toEqual([`otra vez aquí ${band}. previsible`])
  expect(k.disk.diary).toMatchObject({ toldKind: 'band' })
  // a chat with something to pick up keeps its offer, and no memory is spent on it
  const k2 = k.disk.diary.told
  expect(k2).toBe(d.lastDay + 1)
  expect(k.v.calls).toEqual([])
})

test('comments on: two or three lines of the diary go to the model as memories, and /pet comments on says so and says what /pet say sends', async ($, on) => {
  const k = voiceKit($, on, { voice: true })
  const T0 = k.clock.now() - 8 * DAY
  let d = diaryOpened(diaryOf(undefined), { now: T0, folder: 'w', born: true })
  for (let i = 1; i < 8; i++) d = diaryOpened(d, { now: T0 + i * DAY, folder: 'w' })
  k.disk.diary = { ...d, told: Math.floor(k.clock.now() / DAY) + 1 } // nothing to say aloud today
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await k.turn()
  const sent = k.v.calls[0].prompt as string
  expect(sent).toMatch(/\n\nWhat you remember of your time with this person:\n(- .* \((today|yesterday|\d+ days ago|a habit)\)\n){2,3}You may hint at one of these when it fits, or at none\. Never list them\.\n/)
  expect(sent).toMatch(/- works most often in w \(a habit\)\n/)
  expect(sent.match(/\n- .*\((today|yesterday|\d+ days ago|a habit)\)/g)!.length).toBeLessThanOrEqual(3)
  const says = await cardOf($, 'comments on')
  expect(says).toMatch(/at most 3 lines of its diary, as memories it may hint at \(times, counts, a folder's name: \/pet diary lines shows all of it\)\. When another of your chats ends a long turn: that chat's folder name, how long the turn took and how long ago it ended, and nothing of what was in it\.\n\/pet say <text> speaks to the pet: what you write after it \(its first 300 characters\) is sent to the same model, which answers in the bubble with one line\. It is a request of its own, not a turn of the chat, and counts in the day's lines\.\nAfter a pause [^\n]+\nNever sent by the pet itself: the content of a file, the output of a command, the arguments of a command, a file path, your prompts to the assistant but for the start of the last one in a recap\. But the assistant's text is sent as it is: the last 600 characters of a reply, and in a recap the end of the last turn's text, can hold a path, a name or a piece of code the assistant wrote there\./)
})

// /pet say as the person types it: the prompt is submitted as the command, and the mod answers it there
const sayTo = ($: any, text: string) => $.prompt.submit({ text: `/pet say ${text}`.trimEnd(), command: { name: 'pet', args: `say ${text}`.trimEnd() }, wait: false, origin: 'user' } as any)

test('/pet say with comments on: what was written goes to the small model with character, language and memories; the answer is one line in the bubble, counted in the day; nothing enters the chat or is kept', async ($, on) => {
  const k = voiceKit($, on, { voice: true })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  k.v.reply = { isAnswered: true, text: 'Tired too. Stay a while.', usage: USAGE }
  const r = await sayTo($, 'long day,   are you tired?')
  await k.settle()
  expect(r).toEqual({ drop: 'Said to Miro, not to the chat: the answer comes in the bubble.' }) // dropped: no row of the chat, no turn
  expect(k.v.calls.length).toBe(1)
  expect(k.v.calls[0].model).toBe('haiku')
  expect(k.v.calls[0].system).toMatch(/^You are Miro, a small pixel fox .*WIT 91.*\nThe person speaks to you\..*You are a pet, not an assistant: you give no technical advice and you do no work\./s)
  expect(k.v.calls[0].prompt).toMatch(/^The person says to you: long day, are you tired\?\n.*\n\nNow your one line in answer, in about six words\. One line only, and nothing after it\. No file or command names, no advice, no task done\.$/s)
  expect(k.v.calls[0].prompt).toMatch(/What you remember of your time with this person:\n- the diary begins \(today\)\n/) // a pet older than its diary
  expect(await bubbleOf($)).toEqual(['Tired too. Stay a while.'])
  expect(k.disk.voice).toMatchObject({ lines: 1, today: 1, last: ['Tired too. Stay a while.'] })
  expect(JSON.stringify(k.disk)).not.toMatch(/are you tired/) // what was written is kept nowhere
  // it stays 12 seconds, then the bubble is the pet's own again
  await k.clock.advance(13_000)
  expect((await bubbleOf($)).join(' ')).not.toMatch(/Tired too/)
  // asked to do work, it is the model that answers in character: the request says so, and the answer is shown as it comes
  k.v.reply = { isAnswered: true, text: 'Not my job. Ask the big one.', usage: USAGE }
  await k.clock.advance(6_000)
  await sayTo($, 'fix the failing test in src/app.js')
  await k.settle()
  expect(k.v.calls[1].system).toMatch(/Asked to do a task, to write, fix or explain something, you say in your own way that this is the job of the assistant in the chat, not yours: in six words too, with no reason given\./)
  expect(await bubbleOf($)).toEqual(['Not my job. Ask the big one.'])
  // a reply too wide, or naming a file, is not shown: a fixed line in its character, and the call is paid and counted
  k.v.reply = { isAnswered: true, text: 'Open src/app.js and change the second line, then run it again please', usage: USAGE }
  await k.clock.advance(6_000)
  await sayTo($, 'and now?')
  await k.settle()
  expect(await bubbleOf($)).toEqual(['words failed me. literally'])
  expect(k.disk.voice).toMatchObject({ lines: 3, dropped: 1 })
  // in another language: the model is told, and the fixed lines follow
  await cardOf($, 'lang zh')
  k.v.reply = { isAnswered: true, text: '我在呢。慢慢说。', usage: USAGE }
  await k.clock.advance(6_000)
  await sayTo($, '你好')
  await k.settle()
  expect(k.v.calls[3].prompt).toMatch(/^The person says to you: 你好\n.*in about ten characters, in Simplified Chinese\./s)
  expect(await bubbleOf($)).toEqual(['我在呢。慢慢说。'])
  // nothing after it: a word on how to use it, and no call
  await k.clock.advance(6_000)
  const empty = await sayTo($, '')
  await k.settle()
  expect(empty).toMatchObject({ drop: '请在后面写点什么：/pet say <文字>。' }) // one message, in place of the prompt: no toast beside it
  expect(k.toasts).toEqual([])
  expect(k.v.calls.length).toBe(4)
})

test('/pet say with comments off: a fixed line in its character saying that talking needs the comments on and what that means; no model is asked', async ($, on) => {
  const k = voiceKit($, on, { voice: false })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await sayTo($, 'hello there')
  await k.settle()
  expect(await bubbleOf($)).toEqual(['no comments, no conversation. rules', 'To talk, turn them on: /pet comments on. What you write then goes to a small model, on your tokens.'])
  expect(k.v.calls).toEqual([])
  expect(k.disk.voice).toBeUndefined()
  expect(JSON.stringify(k.disk)).not.toMatch(/hello there/)
  await cardOf($, 'lang es')
  await sayTo($, 'hola')
  await k.settle()
  expect((await bubbleOf($))[1]).toBe('Para hablar, actívalos: /pet comments on. Lo que escribas irá a un modelo pequeño, con tus tokens.')
  // run as a command by another mod, not typed: answered the same way, and no text is returned to the chat
  expect(await $.command.run({ command: 'pet', args: 'say hello' } as any)).toEqual({})
})

test('/pet say counts in the day\'s cap: at the cap the pet says so in its character and no call is made; a failed call leaves a fixed line and is not counted', async ($, on) => {
  const k = voiceKit($, on, { voice: true })
  const today = Math.floor((k.clock.now() - new Date(k.clock.now()).getTimezoneOffset() * 60_000) / DAY)
  k.disk.voice = { day: today, today: RULES.voiceCapDay - 1, todayTokens: 20000, lines: 60, input: 30000, output: 1200, at: k.clock.now() - 1000 }
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await sayTo($, 'one more?') // the last line of the day: no wait since the line before, unlike a comment at the end of a turn
  await k.settle()
  expect(k.v.calls.length).toBe(1)
  expect(k.disk.voice.today).toBe(RULES.voiceCapDay)
  await sayTo($, 'and another?')
  await k.settle()
  expect(k.v.calls.length).toBe(1)
  expect(await bubbleOf($)).toEqual(['comments sold out today. restock tomorrow']) // said plainly: finished for today, back tomorrow
  // a call that does not come back
  k.disk.voice = { ...k.disk.voice, today: 0 }
  k.v.reply = { isAnswered: false, text: '', usage: NONE }
  await sayTo($, 'hello?')
  await k.settle()
  expect(await bubbleOf($)).toEqual(['words failed me. literally'])
  expect(k.disk.voice.today).toBe(0)
})

test('comments during a long turn: after 10 minutes one line about the turn so far, then one every 10 minutes at most, under the wait and the cap of the lines at the end of a turn; never while the person types', async ($, on) => {
  const k = voiceKit($, on, { voice: true })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  const step = async () => { for await (const _ of $.turn.step({ model: 'claude-opus-5-5' } as any)) ; }
  const wait = async (ms: number) => { await k.clock.advance(ms); await k.settle() }
  const submit = () => $.prompt.submit({ text: 'the secret plan', wait: false, origin: 'user' } as any)
  await submit()
  await $.tool.call({ tool: 'Bash', command: 'TOKEN=abc deploy --key hunter2', tool_use_id: 'b1' } as any)
  await $.tool.call({ tool: 'Edit', file_path: '/w/private/app.js', tool_use_id: 'e1' } as any)
  await step() // a step that only called tools: the assistant wrote nothing yet
  await wait(9 * 60_000 + 40_000)
  expect(k.v.calls).toEqual([]) // not a long turn yet
  k.v.reply = { isAnswered: true, text: 'Still at it. So am I.', usage: USAGE }
  await wait(30_000)
  expect(k.v.calls.length).toBe(1)
  expect(k.v.calls[0].prompt).toMatch(/^What is happening \(background only, none of it is to be repeated\):\n- the assistant is still at work on the same request: the turn has not ended\n- it has lasted: 10 minutes so far, and the person is waiting\n- tools used so far: Bash 1, Edit 1\n- commands that failed so far: none\n- files changed so far: 1\n\nWhat you remember/)
  expect(k.v.calls[0].prompt).not.toMatch(/last wrote|reply ended/) // no end of a reply while there is none
  expect(JSON.stringify(k.v.calls[0])).not.toMatch(/secret plan|SECRET OUTPUT|hunter2|TOKEN|app\.js|private/)
  expect(await k.texts()).toContain('Still at it. So am I.') // in the bubble while the turn goes on
  expect(k.disk.voice).toMatchObject({ today: 1, lines: 1 })
  // the next one no sooner than 10 minutes later, with the end of what the assistant wrote meanwhile
  k.v.said = 'Half of it is done. Now the whole suite.'
  await step()
  k.v.reply = { isAnswered: true, text: 'Twenty minutes. I counted.', usage: USAGE }
  await wait(9 * 60_000 + 30_000)
  expect(k.v.calls.length).toBe(1)
  await wait(40_000)
  expect(k.v.calls.length).toBe(2)
  expect(k.v.calls[1].prompt).toMatch(/\n- it has lasted: 20 minutes so far, and the person is waiting\n.*\n- files changed so far: 1\n- the assistant last wrote: Half of it is done\. Now the whole suite\.\n/s)
  expect(await k.texts()).toContain('Twenty minutes. I counted.')
  // never while the person types: it waits for an empty box
  k.box = 'I am typing'
  await wait(10 * 60_000 + 20_000)
  expect(k.v.calls.length).toBe(2)
  k.box = ''
  await wait(10_000)
  expect(k.v.calls.length).toBe(3)
  // the wait is the one of the lines at the end of a turn: the turn ends right after, and nothing more is asked
  await $.turn.complete({ answer: 'All done.', reason: 'answer' } as any)
  await k.settle()
  expect(k.v.calls.length).toBe(3)
})

test('comments during a long turn: nothing between turns, nothing over the cap of the day, and a line of another chat counts for the wait', async ($, on) => {
  const k = voiceKit($, on, { voice: true })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  const wait = async (ms: number) => { await k.clock.advance(ms); await k.settle() }
  // no turn is running: the clock alone says nothing
  await wait(11 * 60_000)
  expect(k.v.calls).toEqual([])
  // the cap of the day holds a long turn too
  await $.prompt.submit({ text: 'the secret plan', wait: false, origin: 'user' } as any)
  k.disk.voice = { day: dayOf(k.clock.now()), today: RULES.voiceCapDay, todayTokens: 12800, lines: 90, input: 27000, output: 1800, at: 0 }
  await wait(11 * 60_000)
  expect(k.v.calls).toEqual([])
  // and a line another chat got meanwhile counts for the wait: one line every 10 minutes over all the chats
  k.disk.voice = { ...k.disk.voice, today: 3, at: k.clock.now() }
  await wait(9 * 60_000 + 30_000)
  expect(k.v.calls).toEqual([])
  await wait(40_000)
  expect(k.v.calls.length).toBe(1)
  expect(k.v.calls[0].prompt).toMatch(/\n- it has lasted: 21 minutes so far/)
  expect(k.disk.voice).toMatchObject({ today: 4, lines: 91 })
})

test('the outline offer keeps the comment of the turn under it; a cuddle passes in front of both for 5 seconds, with the comment about it when one comes, and then they are back', async ($, on) => {
  const k = voiceKit($, on, { voice: true, style: true }) // lean on: a long chat is calm, and the offer is the bubble
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  for await (const _ of $.turn.step({ model: 'claude-opus-5-5' } as any)) ; // the chat's first request, small: long is what a chat grows by
  k.v.context = 70_000
  await k.clock.advance(4 * 60_000) // past the greeting: the offer waits 3 minutes after another line
  k.v.reply = { isAnswered: true, text: 'Long road, good pace.', usage: USAGE }
  await k.turn(async () => { for await (const _ of $.turn.step({ model: 'claude-opus-5-5' } as any)) ; })
  const OFFER = ['long chat: shall we put our thoughts in order?', 'Outline asks for where we are, where we are going, what is left.']
  expect(k.v.calls.length).toBe(1) // the offer does not stop the comment from being asked
  expect(await bubbleOf($)).toEqual([...OFFER, 'Long road, good pace.']) // and it is the last line, under the offer
  // a cuddle: the comment about it takes the whole bubble, over the offer
  k.v.reply = { isAnswered: true, text: 'A pat. Filed under good.', usage: USAGE }
  expect(await cardOf($, 'pet')).toMatch(/^Miro: .+  \(petted once, \+2 stars\)$/)
  await k.settle()
  expect(k.v.calls.length).toBe(2)
  expect(await bubbleOf($)).toEqual(['A pat. Filed under good.'])
  await k.clock.advance(4_000)
  expect(await bubbleOf($)).toEqual(['A pat. Filed under good.'])
  // then what was there before is back, and the cuddle's line is gone for good
  await k.clock.advance(2_000)
  expect(await bubbleOf($)).toEqual([...OFFER, 'Long road, good pace.'])
  // while the person types no model is asked: the fixed line passes in front all the same
  k.box = 'typing'
  const fixed = String(await cardOf($, 'pet')).replace(/^Miro: (.+)  \(.*$/, '$1')
  await k.settle()
  expect(k.v.calls.length).toBe(2)
  expect(await bubbleOf($)).toEqual([fixed])
  k.box = ''
  await k.clock.advance(6_000)
  // the cap of the day reached: the cuddle says so in its character, in the command's reply and in the bubble, and asks nothing
  k.disk.voice = { ...k.disk.voice, today: RULES.voiceCapDay }
  const CAPPED = ['thanks. no comments today, back tomorrow', 'pat noted. comments sold out till tomorrow', 'a pat? my comments ran out today. tomorrow', 'mm. comments are done today. more tomorrow', 'pat counted. no comments left till tomorrow', 'love it. my comments come back tomorrow']
  const said = String(await cardOf($, 'pet')).replace(/^Miro: (.+)  \(.*$/, '$1')
  await k.settle()
  expect(CAPPED.slice(1)).toContain(said)
  expect(await bubbleOf($)).toEqual([said])
  expect(k.v.calls.length).toBe(2)
  await cardOf($, 'lang es')
  expect(await cardOf($, 'pet')).toMatch(/^Miro: (caricia anotada\. comentarios, hasta mañana|contada\. comentarios: cero hasta mañana)  \(/)
  // /pet comments says how many are left
  expect(await cardOf($, 'comments')).toMatch(/\nToday: 40 of 40 lines, \d+ tokens \(\d+ in all\): none left, they come back tomorrow\./)
  k.disk.voice = { ...k.disk.voice, today: 3 }
  expect(await cardOf($, 'comments')).toMatch(/\nToday: 3 of 40 lines, \d+ tokens \(\d+ in all\): 37 left\./)
  // with the comments off a cuddle at any count is a cuddle: the cap is nothing to speak of
  await cardOf($, 'lang en')
  k.disk.voice = { ...k.disk.voice, today: RULES.voiceCapDay }
  await cardOf($, 'comments off')
  expect(CAPPED).not.toContain(String(await cardOf($, 'pet')).replace(/^Miro: (.+)  \(.*$/, '$1'))
})

test('the bubble is not always there: a phrase stays about 12 seconds, longer with a button of its own, a question until the next prompt; then only the pet is left, with its name, its stars and its own buttons', async ($, on) => {
  const k = voiceKit($, on)
  const T0 = Date.UTC(2026, 10, 12, 12)
  k.disk.pet = { coins: 3, affection: 3, days: 1, day: dayOf(T0), owned: [] }
  k.disk.chats = { other: { cwd: '/w/hatchling', at: T0 - 20 * 60_000, done: false } } // a chat left here mid-turn: the greeting asks
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  const look = async (surface = 'terminal') => {
    const ui = await $.ui.mount({ ...BAND, surface })
    const open = !!(await ui.find({ type: 'Box', key: 'bubble' })), texts = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string), keys = (await ui.findAll({ type: 'Button' })).map((x: any) => x.key as string)
    await ui.unmount()
    return { open, texts, keys }
  }
  // a question waits for its answer: still there after a minute, gone when the person writes the next prompt
  await k.clock.advance(60_000)
  let b = await look()
  expect([b.open, b.keys]).toEqual([true, ['pet', 'fix']])
  expect(b.texts.join(' ')).toMatch(/pick it up\?/)
  await k.turn()
  await k.clock.advance(1_000)
  b = await look()
  // nothing new to say: the plain line of a calm chat does not open the bubble
  expect(b.open).toBe(false)
  expect(b.texts).toEqual(['Miro  ★ 4', '·']) // the name and the stars, the dot before the buttons, and no phrase
  expect(b.keys).toEqual(['pet']) // the pet's own buttons stay
  expect((await look('desktop')).texts).toEqual(['Miro  ★ 4']) // in the apps too: the name and the stars, and no phrase

  // a phrase with a button of its own (a re-read, with its fix and its guide): there after 19 seconds, gone after 31
  await $.tool.call({ tool: 'Read', file_path: '/a.txt' })
  await $.tool.call({ tool: 'Read', file_path: '/a.txt' })
  b = await look()
  expect([b.open, b.keys]).toEqual([true, ['pet', 'fix']])
  expect(b.texts.join(' ')).toMatch(/re-read/)
  expect((await look('desktop')).texts.join('  ')).toMatch(/^Miro  ★ 4  .*re-read/)
  await k.clock.advance(19_000)
  expect((await look()).open).toBe(true)
  await k.clock.advance(12_000)
  b = await look()
  expect([b.open, b.keys, b.texts]).toEqual([false, ['pet'], ['Miro  ★ 4', '·']])
  // the same phrase is not new: it stays away
  await k.clock.advance(5_000)
  expect((await look()).open).toBe(false)

  // a cuddle's line has its own seconds, then the bubble goes again
  await cardOf($, 'pet')
  expect((await look()).open).toBe(true)
  await k.clock.advance(6_000)
  expect((await look()).open).toBe(false)
})

test('a calm pet moves a little: a gesture now and then, never two within 8 seconds, never while a phrase is up; a golden coat has its glint and a sparkle now and then', async ($, on) => {
  const k = voiceKit($, on)
  const T0 = Date.UTC(2026, 10, 12, 12)
  k.disk.pet = { ...RULES.grownAt, coins: 3, day: dayOf(T0), owned: [] }
  k.disk.chats = { other: { cwd: '/w/hatchling', at: T0 - 20 * 60_000, done: false } }
  {
    await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
    const shot = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const r = (await ui.find({ type: 'Raster' }))!.props; const open = !!(await ui.find({ type: 'Box', key: 'bubble' })); await ui.unmount(); return { cells: String(r.cells), rows: Number(r.rows), open } }
    /** One look every half second: the drawings seen, and when the drawing was not the still one. */
    const watch = async (seconds: number, still: string) => { const moved: number[] = [], seen = new Set<string>(); for (let i = 0; i < seconds * 2; i++) { await k.clock.advance(500); const s = await shot(); seen.add(s.cells); if (s.rows !== rows) moved.push(i) } return { moved, seen } } // a gesture is drawn on the taller canvas; a blink is not, and is not counted
    const still = (await shot()).cells, rows = (await shot()).rows
    // the greeting asks and holds the bubble: for a whole minute the pet does not move
    expect((await shot()).open).toBe(true)
    expect((await watch(60, still)).moved).toEqual([])
    // the question is answered by a prompt: the bubble goes, and the gestures come
    await k.turn()
    const calm = await watch(150, still)
    const starts = calm.moved.filter((i, n) => n === 0 || i - calm.moved[n - 1]! > 1)
    expect(starts.length).toBeGreaterThanOrEqual(5) // one every 8 to 20 seconds
    expect(starts.length).toBeLessThanOrEqual(150 / 8)
    for (let n = 1; n < starts.length; n++) expect(starts[n]! - starts[n - 1]!).toBeGreaterThanOrEqual(16) // 8 seconds, in half seconds
    expect(calm.seen.size).toBeGreaterThanOrEqual(4) // more than one gesture: looks, ears, a hop
    expect(calm.moved.length).toBeLessThan(150 * 2 * 0.25) // rare and short: still most of the time

    // every animal has gestures drawn for the baby, the adult and the crowned one, each frame with where the body sits
    for (const [name, sp] of Object.entries(BUILTIN.species) as [string, any][]) for (const st of ['baby', 'adult', 'crown']) {
      const idle = Object.entries(sp.states[st].idle) as [string, any][]
      expect(idle.length, `${name} ${st}`).toBeGreaterThan(0)
      for (const [g, v] of idle) { expect(['left', 'right', 'up', 'ears', 'hop']).toContain(g); expect(v.frames.length).toBeLessThanOrEqual(3); expect(v.at.length).toBeGreaterThan(0) }
    }

    // the golden coat: the glint is always on it, a sparkle lights up next to it now and then and goes
    k.disk.pet = { ...k.disk.pet, owned: ['golden'] }
    await k.clock.advance(11_000)
    const inks = async () => { const c = new Uint32Array(Uint8Array.from(atob((await shot()).cells), ch => ch.charCodeAt(0)).buffer); return new Set([...c].filter((_, i) => i % 3 !== 0)) }
    let lit = 0, glint = 0
    for (let i = 0; i < 120; i++) { await k.clock.advance(500); const s = await inks(); if (s.has(0xffd54f)) lit++; if (s.has(0xfff6cf)) glint++ }
    expect(glint).toBe(120)
    expect(lit).toBeGreaterThanOrEqual(4) // a sparkle every 5 to 13 seconds, a second long
    expect(lit).toBeLessThanOrEqual(30)
  }
})

test('news of another chat with the comments on: the small model is told the folder and the times, and says it in the pet\'s character; when it fails the fixed line is said', async ($, on) => {
  const k = voiceKit($, on, { voice: true })
  const T0 = Date.UTC(2026, 10, 12, 12), MIN = 60_000
  k.disk.pet = { coins: 3, affection: 3, days: 1, day: dayOf(T0), owned: [] }
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  k.v.reply = { isAnswered: true, text: 'The vodmax chat is done. I heard it sigh.', usage: USAGE }
  k.disk.chats = { ...k.disk.chats, other: { cwd: '/home/me/secret-client/vodmax', at: T0 + 1_000, done: true, took: 7 * MIN } }
  await k.clock.advance(10_000)
  await k.settle()
  expect(k.v.calls.length).toBe(1)
  expect(k.v.calls[0].prompt).toMatch(/the one in the folder vodmax, finished the job it was on\n- that job took about 7 minutes, and it ended just now/)
  expect(k.v.calls[0].prompt).toMatch(/tell the person that the chat in vodmax is done/)
  expect(k.v.calls[0].prompt).not.toMatch(/secret-client|the secret plan/) // the last part of the folder's path, and nothing of either chat
  expect((await k.texts()).join(' ').replace(/\s+/g, ' ')).toContain('The vodmax chat is done. I heard it sigh.')
  expect(k.disk.voice.today).toBe(1) // counted in the day

  // the call fails: the fixed line, with the folder and since when
  k.v.reply = { isAnswered: false, text: '', usage: NONE }
  await k.clock.advance(6 * MIN)
  await k.turn() // the chat is in use
  k.disk.chats = { ...k.disk.chats, third: { cwd: '/w/notes', at: T0 + 6 * MIN, done: true, took: 2 * MIN } }
  await k.clock.advance(10_000)
  await k.settle()
  expect((await k.texts()).join(' ').replace(/\s+/g, ' ')).toMatch(/the chat in notes finished its job (just now|\d+ min ago)/)
})

test('animals cost stars: the one a pet is born as is free, each other is unlocked once for 100 stars in the shop and kept, and the person goes freely among the ones they have, by /pet animal or the skin menu', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true })
  k.disk.pet = { coins: 150, affection: 150, days: 1, day: dayOf(Date.UTC(2026, 10, 12, 12)), owned: [] }
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  const look = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const keys = (await ui.findAll({ type: 'Button' })).map((b: any) => b.key as string), texts = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string), r = JSON.stringify((await ui.find({ type: 'Raster' }))!.props.cells); await ui.unmount(); return { keys, texts, r } }
  const press = async (key: string) => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); await ui.press({ key }); await k.clock.advance(1); await ui.unmount() }

  // one animal, its own: nothing to pick, and the shop lists the six apart, each with its price, the one shown marked
  expect((await look()).keys).not.toContain('skin')
  expect(await cardOf($, 'animal')).toBe('Pick one of: fox.\nOthers, 100 stars each, once: penguin, chick, dog, bunny, cactus. /pet shop <animal> unlocks one.')
  const shop = await cardOf($, 'shop')
  expect(shop).toMatch(/\n  golden +a golden coat +300  coat\n\n  eggshell +half an eggshell +–  head +founders only\n\n  penguin +penguin +100  animal\n  chick +chick +100  animal\n  dog +dog +100  animal\n  bunny +bunny +100  animal\n  fox +fox +100  animal +yours, shown\n  cactus +cactus +100  animal\n\n/)
  expect(shop).not.toMatch(/axolotl/) // the rare one is not sold
  expect(shop).toContain('Animals: the one your pet was born as is free; each other is unlocked once and stays yours. /pet shop <animal> unlocks, /pet animal <name> switches.')
  // not unlocked: /pet animal does not spend stars, it says how
  expect(await cardOf($, 'animal dog')).toBe('The dog is not yours yet: 100 stars unlock it, once, and you have 150. /pet shop dog unlocks it.')
  expect(prefsOf(k.disk).species).toBe('fox')
  expect(await cardOf($, 'shop axolotl')).toMatch(/^Nothing called axolotl in the shop\./)
  expect(await cardOf($, 'animal axolotl')).toBe('The axolotl is not for sale: only a pet born as one is one.\nPick one of: fox.\nOthers, 100 stars each, once: penguin, chick, dog, bunny, cactus. /pet shop <animal> unlocks one.') // E22: why, in a line

  // unlocked in the shop: paid once, shown at once, kept
  const fox = (await look()).r
  expect(await cardOf($, 'shop dog')).toBe('Unlocked the dog for 100 stars, 50 left: it is yours for good, and Hatchling is one now. /pet animal <name> switches among yours.')
  expect(k.disk.pet).toMatchObject({ coins: 50, affection: 150, animals: ['dog'] })
  expect(prefsOf(k.disk).species).toBe('dog')
  expect((await look()).r).not.toBe(fox)
  expect(await cardOf($, 'buy dog')).toBe('The dog is yours already. /pet animal dog switches to it.')
  expect(await cardOf($, 'shop fox')).toBe('The fox is yours already. /pet animal fox switches to it.') // the one it was born as: never paid
  expect(await cardOf($, 'shop bunny')).toMatch(/^The bunny costs 100 stars and you have 50\. Stars come with use: /)
  expect(k.disk.pet.coins).toBe(50)
  expect(await cardOf($, 'shop')).toMatch(/\n  dog +dog +100  animal +yours, shown\n  bunny +bunny +100  animal\n  fox +fox +100  animal +yours\n/)

  // free among the ones owned: by command, and by the animal part of the skin menu
  expect(await cardOf($, 'animal fox')).toBe('Hatchling is now a fox.')
  expect(await cardOf($, 'animal dog')).toBe('Hatchling is now a dog.')
  expect(k.disk.pet.coins).toBe(50)
  expect(await cardOf($, 'animal')).toMatch(/^Pick one of: fox, dog\.\nOthers, 100 stars each, once: penguin, chick, bunny, cactus\./)
  expect(await cardOf($, 'skin')).toMatch(/^Miro's skin\n  animal  dog\n\/pet wear <item>/)
  expect((await look()).keys).toContain('skin')
  await press('skin')
  const open = await look()
  expect(open.keys).toEqual(['slot-animal', 'skin-done'])
  expect(open.texts.join(' ')).toMatch(/animal: dog/)
  await press('slot-animal')
  expect(prefsOf(k.disk).species).toBe('fox')
  await press('slot-animal')
  expect(prefsOf(k.disk).species).toBe('dog')
})

test('a pet of before the prices shown as another animal than its own keeps both; a pet born as the rare one keeps it and sees it in the shop with no price', async ($, on) => {
  const k = home(on, {}, { species: 'bunny', born: 'axolotl', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true })
  k.disk.pet = { coins: 20, affection: 20, days: 1, day: dayOf(Date.UTC(2026, 10, 12, 12)), owned: [] }
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  expect(k.disk.pet).toMatchObject({ coins: 20, animals: ['bunny'] }) // kept for nothing
  expect(await cardOf($, 'animal')).toMatch(/^Pick one of: axolotl, bunny\.\nOthers, 100 stars each, once: penguin, chick, dog, fox, cactus\./)
  expect(await cardOf($, 'animal axolotl')).toBe('Hatchling is now a axolotl.')
  expect(await cardOf($, 'animal bunny')).toBe('Hatchling is now a bunny.')
  expect(await cardOf($, 'shop')).toMatch(/\n  bunny +bunny +100  animal +yours, shown\n  fox +fox +100  animal\n  cactus +cactus +100  animal\n  axolotl +axolotl +–  animal +yours\n\n/)
})

// ---- What four independent reviews found on 13/11/2026: each fault as a test ----

test('B7: with the band hidden no line is asked of the model: not for a failure, a long turn, a cuddle or /pet say', async ($, on) => {
  const k = voiceKit($, on, { voice: true })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await cardOf($, 'hide')
  k.v.fail = true
  await k.turn(() => $.tool.call({ tool: 'Bash', command: 'npm test', tool_use_id: 't1' } as any))
  await $.prompt.submit({ text: 'go', wait: false, origin: 'user' } as any)
  await k.clock.advance(11 * 60_000); await k.settle() // a turn that lasts
  await cardOf($, 'pet'); await k.settle()
  await $.prompt.submit({ text: '/pet say hello', command: { name: 'pet', args: 'say hello' }, wait: false, origin: 'user' } as any); await k.settle()
  expect(k.v.calls).toEqual([])
  expect(k.disk.voice).toBeUndefined()
  expect(await cardOf($)).toMatch(/\ncomments on: /) // still the person's choice: the card says so
  // shown again, it speaks again
  await cardOf($, 'show')
  await k.clock.advance(60_000)
  await k.turn(() => $.tool.call({ tool: 'Bash', command: 'npm test', tool_use_id: 't2' } as any))
  expect(k.v.calls.length).toBeGreaterThan(0)
})

test('B8: a line is counted in the store before its call goes out, so the cap holds while a call is on its way; a store that cannot be written means no call', async ($, on) => {
  const k = voiceKit($, on, { voice: true })
  const T0 = Date.UTC(2026, 10, 12, 12)
  k.disk.voice = { day: dayOf(T0), today: RULES.voiceCapDay - 1, lines: 39, at: T0 - 3_600_000 }
  const during: any[] = []
  k.v.onCall = () => { during.push(structuredClone(k.disk.voice)) }
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  k.v.fail = true
  await k.turn(() => $.tool.call({ tool: 'Bash', command: 'npm test', tool_use_id: 't1' } as any))
  expect(k.v.calls.length).toBe(1)
  expect(during[0]).toMatchObject({ today: RULES.voiceCapDay, lines: 40, at: T0, by: { fail: T0 } }) // already the 40th while the model is asked
  expect(during[0].input ?? 0).toBe(0) // its use is added after
  expect(k.disk.voice).toMatchObject({ today: RULES.voiceCapDay, lines: 40, input: 300, output: 20 })
  // another chat that reads the store during the call is at the cap: nothing more today, whatever the reason
  await k.clock.advance(60_000)
  await cardOf($, 'pet'); await k.settle()
  await k.turn(() => $.tool.call({ tool: 'Bash', command: 'npm test', tool_use_id: 't2' } as any))
  expect(k.v.calls.length).toBe(1)
  // the count cannot be written: the cap could not be held, so the model is not asked
  k.disk.voice = { day: dayOf(T0), today: 0, lines: 40 }
  ;(k as any).ro = true
  await k.clock.advance(60_000)
  await k.turn(() => $.tool.call({ tool: 'Bash', command: 'npm test', tool_use_id: 't3' } as any))
  expect(k.v.calls.length).toBe(1)
})

/** The columns a band's tree takes at its widest, from what was drawn: the name, the bubble, the buttons, the drawing. */
async function drawnWidth($: any, props: object) {
  const ui = await $.ui.mount({ ...BAND, props: { hasSurvey: false, ...props }, surface: 'terminal' })
  const r = await ui.find({ type: 'Raster' }), bubble = await ui.find({ type: 'Box', key: 'bubble' }), tail = await ui.find({ type: 'Box', key: 'tail' })
  const found = await ui.findAll({ type: 'Button' }), buttons = found.map((x: any) => String(x.text))
  const OWN = ['skin', 'pet'] // the pet's own buttons: in the row of the name; the others are under the bubble
  const own = found.filter((x: any) => OWN.includes(String(x.key))).map((x: any) => String(x.text)), under = found.filter((x: any) => !OWN.includes(String(x.key))).map((x: any) => String(x.text))
  const texts = (await ui.findAll({ type: 'Text' })).map((x: any) => String(x.text))
  const ui0head = ui.find({ type: 'Box', key: 'head' }), besideBox = await ui.find({ type: 'Box', key: 'beside' })
  await ui0head
  await ui.unmount()
  const w = (t: string) => [...t].reduce((n: number, ch: string) => n + (/[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/.test(ch) ? 2 : 1), 0)
  const span = (list: string[]) => list.reduce((n: number, b: string) => n + w(b), 0) + 2 * Math.max(0, list.length - 1)
  const headBox = await ui0head, head = String((headBox?.children as any[] | undefined)?.find((x: any) => x.type === 'Text')?.children[0] ?? texts.find((t: string) => t.includes('★')) ?? ''), keys = span(under) // the row of the name: with little room it may be the name alone, with no star
  const row = w(head) + (own.length ? 5 + span(own) : 0) // the row of the name: the head, the dot with two cells each side, the pet's own buttons
  const cols = r ? Number((r as any).props.columns) : 0
  const aside = !!r && !bubble && !!besideBox // the row of the name is beside the drawing
  const lines = texts.flatMap((t: string) => t.split('\n')).map(w)
  const total = !r ? Math.max(0, ...lines) : bubble ? Math.max(row, Number((bubble as any).props.width), keys) + 2 + cols : !texts.includes(head) ? cols : aside ? row + 1 + cols : Math.max(row, cols)
  return { total, raster: !!r, bubble: !!bubble, buttons, own, aside, head, texts }
}

test('E18: the band fits the width it is given: the bubble narrows, then the buttons go, then only the pet, then one row of text', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true, lang: 'en' })
  const T0 = Date.UTC(2026, 10, 12, 12)
  const ALL = ['shades', 'mug', 'scarf', 'cap', 'lamp', 'headphones', 'backpack', 'suitcase', 'sombrero', 'sneakers', 'skateboard', 'golden']
  k.disk.pet = { coins: 2000, affection: 600, days: 30, day: dayOf(T0), owned: ALL }
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }) as any)
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  const WIDTHS = [40, 60, 80, 100]
  const fits = async (what: string) => { for (const bodyColumns of WIDTHS) { const d = await drawnWidth($, { bodyColumns }); expect([what, bodyColumns, d.total <= bodyColumns], JSON.stringify(d)).toEqual([what, bodyColumns, true]) } }
  // a greeting in the bubble, with every thing on in turn: the accessories and the skateboard make the drawing wider and taller
  for (const wear of ['none', ...ALL.filter(id => id !== 'golden'), 'suitcase skateboard', 'cap scarf sneakers lamp golden', 'sombrero skateboard backpack golden']) {
    k.disk['pref.wear'] = wear
    await k.clock.advance(10_500) // the choice made in "another chat" reaches this one
    await fits(`wearing ${wear}`)
  }
  // the bubble is still there at every one of these widths, narrower: the same words on more lines
  k.disk['pref.wear'] = 'none'; await k.clock.advance(10_500)
  await $.session.end({ reason: 'clear', sessionId: 's1', resume: { id: 's1' } } as any); k.state = {}
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  const wide = await drawnWidth($, { bodyColumns: 100 }), narrow = await drawnWidth($, { bodyColumns: 40 })
  expect([wide.bubble, narrow.bubble]).toEqual([true, true])
  expect([wide.head, narrow.head, narrow.own]).toEqual(['Miro  ★ 2000', 'Miro', ['skin', 'pet']]) // in the row of the name the stars gave way, the pet's buttons are all there
  expect(narrow.texts.join(' ').replace(/\s+/g, ' ')).toBe(wide.texts.join(' ').replace(/\s+/g, ' ').replace('Miro ★ 2000', 'Miro'))
  expect(narrow.texts.join('\n').split('\n').length).toBeGreaterThan(wide.texts.join('\n').split('\n').length)
  // the skin menu open, in English and in Chinese
  let ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); await ui.press({ key: 'skin' }); await k.clock.advance(1); await ui.unmount()
  await fits('skin menu')
  await cardOf($, 'lang zh'); await fits('skin menu, Chinese')
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); await ui.press({ key: 'skin-done' }); await k.clock.advance(1); await ui.unmount()
  await fits('Chinese')
  await cardOf($, 'lang en')
  // narrower still: first the pet's own buttons go, then the bubble, then the drawing itself
  const at = async (bodyColumns: number, more = {}) => drawnWidth($, { bodyColumns, ...more })
  const b34 = await at(34)
  expect([b34.bubble, b34.raster, b34.total <= 34]).toEqual([true, true, true])
  const b24 = await at(24)
  expect([b24.bubble, b24.raster, b24.head, b24.own, b24.total <= 24]).toEqual([false, true, 'Miro', ['skin', 'pet'], true]) // only the pet, with its name and its buttons: the stars gave way to them
  const b16 = await at(16)
  expect([b16.raster, b16.head, b16.own, b16.total <= 16]).toEqual([true, 'Miro', ['skin'], true]) // the name over the drawing: beside it there is no room
  const b10 = await at(10)
  expect([b10.raster, b10.texts.length, b10.total <= 10]).toEqual([false, 1, true]) // one row of text, cut to the width
  // a band that may not be as tall as the drawing: the row of text too; one too low for the bubble: the pet alone
  expect((await at(100, { maxRows: 3 })).raster).toBe(false)
  const low = await at(100, { maxRows: 4 }), enough = await at(100, { maxRows: 6 })
  expect([low.raster, enough.raster, enough.bubble]).toEqual([false, true, true])
  // with no width given (an engine that does not say) everything is drawn as before
  const free = await drawnWidth($, {})
  expect([free.bubble, free.buttons]).toEqual([true, ['skin', 'pet']])
})

test('E19: with the bubble closed the buttons skin and pet are in the row of the name, beside the pet: no row of buttons under it, and no [-] of ours beside the engine\'s', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true, lang: 'en' })
  k.disk.pet = { coins: 4, affection: 4, days: 1, day: dayOf(Date.UTC(2026, 10, 12, 12)), owned: ['mug'] }
  await $.session.start({ cwd: '/w/hatchling', surface: 'terminal', isInteractive: true })
  await (await $.ui.mount({ ...BAND, surface: 'terminal' })).unmount() // the greeting is up
  await k.clock.advance(40_000) // and had its time
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await ui.find({ type: 'Box', key: 'bubble' })).toBeFalsy()
  expect(await ui.find({ type: 'Box', key: 'keys' })).toBeFalsy() // no row of buttons at all
  const row = (await ui.find({ type: 'Box', key: 'head' }))!
  expect((row.children as any[]).map(x => [x.type, x.type === 'Text' ? x.children[0] : x.props.label])).toEqual([['Text', 'Miro  ★ 4'], ['Text', '·'], ['Button', 'skin'], ['Button', 'pet']]) // Miro  ★ 4  ·  skin  pet
  expect([row.props.flexDirection, row.props.gap]).toEqual(['row', 2])
  // the engine draws its own [-] at the right end of the band: none of ours, at any width, with the bubble open or closed, or two are seen
  for (const props of [{}, { bodyColumns: 200 }, { bodyColumns: 60 }, { bodyColumns: 30 }]) {
    const all = await $.ui.mount({ ...BAND, props: { hasSurvey: false, ...props }, surface: 'terminal' })
    expect(JSON.stringify(await all.drawn())).not.toContain('[-]')
    expect((await all.findAll({ type: 'Button' })).map((x: any) => String(x.key))).toEqual(['skin', 'pet'])
    await all.unmount()
  }
  const tree = JSON.stringify(await ui.drawn())
  await ui.unmount()
  const order = ['Miro  ★ 4', '"skin"', '"pet"', '"Raster"'].map(x => tree.indexOf(x))
  expect(order.every(i => i >= 0)).toBe(true)
  expect([...order].sort((x, y) => x - y)).toEqual(order) // the name, its buttons, and then the drawing: one row with the pet
  // a band exactly as tall as the drawing loses nothing: the buttons are beside the pet, not under it
  const tight = await drawnWidth($, { bodyColumns: 100, maxRows: 6 })
  expect([tight.raster, tight.bubble, tight.buttons]).toEqual([true, false, ['skin', 'pet']])
  // narrower, the row of the name gives way: the stars first, and only then one button at a time, pet, then skin, which
  // stay as long as there is room for them beside the name; the name stays
  // (under the width where the name and the stars fit beside the drawing the row goes above it, where it has the whole width again)
  const seen: string[] = []
  for (let bodyColumns = 60; bodyColumns >= 14; bodyColumns--) {
    const d = await drawnWidth($, { bodyColumns })
    expect([bodyColumns, d.total <= bodyColumns, d.head.startsWith('Miro')], JSON.stringify(d)).toEqual([bodyColumns, true, true])
    if (!d.raster) break // under the width of the drawing: one row of text
    const what = `${d.aside ? 'beside' : 'above'}: ${[d.head, ...d.own].join(' ')}`
    if (seen.at(-1) !== what) seen.push(what)
  }
  expect(seen).toEqual([
    'beside: Miro  ★ 4 skin pet', 'beside: Miro skin pet', 'beside: Miro skin', 'beside: Miro  ★ 4', // with no button left the stars are back
    'above: Miro  ★ 4 skin pet', 'above: Miro skin pet',
  ])
})

test('E23: the question about the comments: on a surface with no buttons it says how to answer; a cuddle over it leaves no answer buttons under the cuddle; asked with the band hidden it is not marked as asked', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true, lang: 'en', hidden: true })
  k.disk.prefs.voiceAsked = false
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect(prefsOf(k.disk).voiceAsked).toBe(false) // nobody could see it: not burnt
  await cardOf($, 'show')
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect(prefsOf(k.disk).voiceAsked).toBe(true)
  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await desk.findAll({ type: 'Text' })).map(x => x.text).join(' ')).toMatch(/May I comment on your work\?/) // the apps have the buttons
  expect((await desk.findAll({ type: 'Button' })).map(x => x.text)).toEqual(['pet', 'comments on', 'stay quiet'])
  await desk.unmount()
  const code = await $.ui.mount({ ...BAND, surface: 'vscode' }) // one line, no buttons: it says how to answer
  expect((await code.findAll({ type: 'Text' })).map(x => x.text).join(' ')).toMatch(/May I comment on your work\?.*Answer with \/pet comments on or \/pet comments off\.$/)
  await code.unmount()
  let ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.findAll({ type: 'Button' })).map(x => x.text)).toEqual(['pet', 'comments on', 'stay quiet'])
  await ui.unmount()
  await cardOf($, 'pet') // a cuddle: its line is over the question for 5 seconds
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.findAll({ type: 'Text' })).map(x => x.text).join(' ')).not.toMatch(/May I comment/)
  expect((await ui.findAll({ type: 'Button' })).map(x => x.text)).toEqual(['skin', 'pet'])
  await ui.unmount()
  await k.clock.advance(6_000)
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.findAll({ type: 'Button' })).map(x => x.text)).toEqual(['pet', 'comments on', 'stay quiet']) // the question is back, with its buttons
  await ui.unmount()
})

test('a pack animal with a larger body (an imported Codex pet): drawn at its own size, things of the shop set on it by its anchors, the band still fits the width, credits in /pet skins', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true, lang: 'en' })
  k.disk.pet = { coins: 0, affection: 4, days: 1, day: dayOf(Date.UTC(2026, 10, 12, 12)), owned: ['shades', 'mug', 'skateboard', 'cap'] }
  const W = 20, H = 22, row = (y: number) => y < 2 ? '.'.repeat(W) : y === 8 ? '...AAAkAAAAAAkAAA...' : `...${'A'.repeat(W - 6)}...`
  const big = Array.from({ length: H }, (_, y) => row(y))
  k.skins = { 'codex-duck.json': { format: 1, id: 'codex-duck', name: 'Pixel Duck', credits: { author: 'Some One', license: 'CC BY 4.0', source: 'https://example.org/duck' }, animals: { 'pixel-duck': { name: { en: 'Pixel Duck' }, size: [W, H], palette: { A: '#e0e8f0' }, states: { adult: { frames: [big] }, sleep: { frames: [big] } } } } } }
  await $.session.start(START)
  expect(await cardOf($, 'skins')).toContain('  codex-duck.json  Pixel Duck (codex-duck)  animals: pixel-duck\n                   author: Some One, license: CC BY 4.0, source: https://example.org/duck')
  await cardOf($, 'animal pixel-duck')
  const raster = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const r = (await ui.find({ type: 'Raster' }))!.props; await ui.unmount(); const d = new Uint32Array(Uint8Array.from(atob(String(r.cells)), ch => ch.charCodeAt(0)).buffer); return { columns: Number(r.columns), rows: Number(r.rows), inks: new Set([...d].filter((_, i) => i % 3 !== 0)) } }
  await cardOf($, 'wear none')
  expect(await raster()).toMatchObject({ columns: W, rows: H / 2 }) // bare, the body alone: 20 columns by 11 rows of text
  await cardOf($, 'wear shades')
  const worn = await raster()
  expect([worn.columns, worn.rows, worn.inks.has(0x263238)]).toEqual([W + 2, (H + 2) / 2, true]) // with a thing on: one spare column each side and two rows above the head, and the sunglasses are drawn
  await cardOf($, 'wear mug'); await cardOf($, 'wear skateboard'); await cardOf($, 'wear cap')
  const all = await raster()
  expect([all.columns > W + 2, all.rows, all.inks.has(0x26c6da), all.inks.has(0xab47bc), all.inks.has(0x42a5f5)]).toEqual([true, (H + 2) / 2 + 1, true, true, true]) // the mug beside it, the skateboard under it, the cap over it
  for (const bodyColumns of [40, 60, 80, 100]) { const d = await drawnWidth($, { bodyColumns }); expect([bodyColumns, d.total <= bodyColumns, d.raster], JSON.stringify(d)).toEqual([bodyColumns, true, true]) }
  expect((await drawnWidth($, { bodyColumns: 100, maxRows: 8 })).raster).toBe(false) // a band lower than the drawing: the row of text
  await k.clock.advance(6 * 60_000) // asleep: it wears nothing, and the frame keeps its size
  expect((await raster()).rows).toBe((H + 2) / 2 + 1)
})

test('E22: commands: capitals do not matter, a word that is no command says so in a line, /pet help lists the commands there are and only those, and a wrong argument is told', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true, lang: 'en' })
  k.disk.pet = { coins: 120, affection: 25, days: 1, day: dayOf(Date.UTC(2026, 10, 12, 12)), owned: ['mug', 'golden'] }
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }) as any)
  on('process.run', () => ({ value: { exitCode: 0, stdout: 'ok', stderr: '' } }) as any)
  on('session.surfaces', () => ({ value: ['terminal'] }) as any)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  const first = async (a: string) => (await cardOf($, a)).split('\n')[0]
  // capitals in the verb and in its argument
  expect(await first('WEAR Mug')).toMatch(/^a coffee mug (goes on, accessory|comes off)\.$/)
  expect(await first('Wear PLAIN')).toMatch(/^Miro wears/)
  expect(await first('wear Golden')).toBe('a golden coat goes on, coat.')
  expect(await first('Shop')).toBe('HATCHLING SHOP · you have 120 stars')
  expect(await first('ANIMAL Fox')).toBe('Hatchling is now a fox.')
  expect(await first('Lang ES')).toBe('Hatchling ahora habla español.')
  expect(await first('LANG en')).toBe('Hatchling now speaks English.')
  expect(await first('Hide')).toBe('Hatchling is hidden. /pet show brings it back.')
  expect(await first('SHOW')).not.toMatch(/^No \/pet/)
  expect(prefsOf(k.disk).hidden).toBe(false)
  // a name keeps its capitals
  await cardOf($, 'NAME McDuff')
  expect(prefsOf(k.disk).name).toBe('McDuff')
  // no such command: one line, with where the commands are; never the card in silence
  for (const [typed, verb] of [['frobnicate', 'frobnicate'], ['/pet', '/pet'], ['Budgetx 5', 'budgetx'], ['weer mug', 'weer']]) expect(await cardOf($, typed)).toBe(`No /pet ${verb}. /pet help lists the commands.`)
  expect(await cardOf($, `x${'\u001b[31m'}y`)).toBe('No /pet xy. /pet help lists the commands.')
  expect(await first('')).toMatch(/^McDuff, Hatchling the/) // the card is /pet alone
  // an argument that is not understood
  expect(await cardOf($, 'lang fr')).toBe('No language fr. There are: en, es, pt, zh.')
  expect(await cardOf($, 'lean maybe')).toBe('/pet briefox takes on or off, not maybe.')
  expect(await cardOf($, 'comments loud')).toBe('/pet comments takes on or off, not loud.')
  expect(await first('animal axolotl')).toBe('The axolotl is not for sale: only a pet born as one is one.')
  expect(await first('animal dog')).toMatch(/^The dog is not yours yet: 100 stars unlock it/)
  expect(await first('animal unicorn')).toBe('No animal called unicorn.')
  expect(await first('wear unicorn')).toMatch(/unicorn/)
  expect(await first('shop unicorn')).toBe('Nothing called unicorn in the shop. /pet shop lists everything.')
  expect(await cardOf($, 'say')).toBe('Write something after it: /pet say <text>.')
  expect(await cardOf($, 'wear')).toMatch(/A coat is a colour: \/pet wear plain takes it off, \/pet wear golden puts the golden one on\.$/)
  // /pet help: every command it lists exists, and every command there is is listed
  const help = await cardOf($, 'help')
  const listed = [...new Set(help.split('\n').slice(1).map(l => l.trim().split(/\s+/)[1] ?? ''))].map(v => v.startsWith('<') || v.startsWith('[') ? '' : v)
  expect(listed).toEqual(['the', 'pet', 'say', 'remind', 'reminders', 'yes', 'until', 'routine', 'name', 'call', 'shop', 'skin', 'wear', 'animal', 'skins', 'chats', 'alerts', 'briefox', 'comments', 'model', 'lang', 'share', 'export', 'import', 'diary', 'adopt', 'hide', 'show', 'demo', 'where', 'help'].map(v => v === 'the' ? 'the' : v))
  expect(help).toMatch(/\/pet wear plain\|golden/); expect(help).toMatch(/\/pet diary clear/)
  for (const verb of listed.filter(v => v && v !== 'the')) expect([verb, (await cardOf($, verb === 'say' ? 'say hi' : verb)).startsWith('No /pet ')]).toEqual([verb, false])
  for (const lang of ['es', 'pt', 'zh']) { await cardOf($, `lang ${lang}`); const h = await cardOf($, 'help'); expect([lang, h.split('\n').length, h === help]).toEqual([lang, help.split('\n').length, false]) }
  // the short answers are said in the pet's language: adoption, the demo, the budget that is gone
  await cardOf($, 'lang es')
  expect(await cardOf($, 'adopt')).toBe('No hay ningún /buddy en tu configuración de Claude Code: nada que adoptar.')
  expect(await cardOf($, 'demo')).toMatch(/^Demo de Hatchling: .* \(5 s cada uno\)\.$/)
  expect(await cardOf($, 'budget 5')).toMatch(/^El presupuesto de contexto se quitó/)
  expect(await cardOf($, 'nada')).toBe('No existe /pet nada. /pet help muestra los comandos.')
  // typed with a capital, /pet Say is still for the pet alone: dropped, never a turn of the chat
  const r = await $.prompt.submit({ text: '/pet Say hola', command: { name: 'pet', args: 'Say hola' }, wait: false, origin: 'user' } as any) as any
  expect(r.drop).toBeTruthy()
})

test('which chat needs me: beside the name how many other chats work, wait or ask; a word when one needs the person; /pet chats lists them; off turns it all off', async ($, on) => {
  const k = voiceKit($, on, { voice: false })
  k.disk.pet = { owned: [] } // a pet with nothing to wear: the row of the name has the one button
  const T0 = Date.UTC(2026, 10, 12, 12), MIN = 60_000
  let verdict = 'ask'
  on('tool.check', () => ({ decision: verdict }) as any)
  await $.session.start({ cwd: '/w/here', surface: 'terminal', isInteractive: true })
  const head = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const t = (await ui.findAll({ type: 'Text' })).map((x: any) => String(x.text)); await ui.unmount(); return t.find(x => x.includes('★')) ?? '' }
  const bubble = async () => (await k.texts()).join(' ').replace(/\s+/g, ' ')
  // only this chat: nothing beside the name and the stars
  await $.prompt.submit({ text: 'go', wait: false, origin: 'user' } as any)
  await k.clock.advance(10_500)
  expect(await head()).toMatch(/^Miro  ★ \d+$/)
  expect(await cardOf($, 'chats')).toBe('Your open chats\n  here  here\nNo other chat is open.\nFolder names, the names you gave your chats and times only, nothing of what is in a chat. /pet chats titles on adds each chat\'s title; /pet chats off turns the board off.')
  // four other chats: one at work, one waiting for the person, one stopped on a permission, one that died without a word
  const now = () => Number(k.disk['chat.me'].beat)
  const others = () => {
    k.disk['chat.busy'] = { cwd: '/home/me/work/vodmax', at: now() - 4 * MIN, done: false, beat: now() }
    k.disk['chat.idle'] = { cwd: '/home/me/work/notes', at: now() + 1_000, done: true, took: 3 * MIN, beat: now() + 1_000 } // its turn ended after this chat opened
    k.disk['chat.stuck'] = { cwd: '/home/me/secret-client/api', at: now() - 6 * MIN, done: false, asking: now() - 20_000, beat: now() }
    k.disk['chat.dead'] = { cwd: '/home/me/work/old', at: now() - 3 * MIN, done: false, beat: now() - 10 * MIN }
  }
  others()
  await k.clock.advance(10_500)
  expect(await head()).toMatch(/^Miro  ★ \d+  ·  2 chats wait for you$/) // the one whose turn ended and the one stopped on a permission; the one at work needs nobody
  // with the count the row of the name is never wider than the band. What gives way: the count first, then the stars, then the pet's own button, and the name last
  const gave: string[] = []
  for (let bodyColumns = 100; bodyColumns >= 14; bodyColumns--) {
    const d = await drawnWidth($, { bodyColumns })
    expect([bodyColumns, d.total <= bodyColumns], JSON.stringify(d)).toEqual([bodyColumns, true])
    if (!d.raster) break // under the width of the drawing: one row of text
    const what = `${d.own.join(' ')}|${d.head.includes('wait for you') ? 'count' : d.head.includes('★') ? 'stars' : d.head === 'Miro' ? 'name' : 'cut'}`
    if (gave.at(-1) !== what) gave.push(what)
  }
  expect(gave).toEqual(['pet|count', 'pet|stars', 'pet|name', '|stars', 'pet|stars', 'pet|name']) // beside the drawing, then over it, where the row has the whole width again
  // the one that may wait for an OK is told first, with its folder's name and nothing else of it
  expect(await bubble()).toContain('the chat in api may be waiting for your OK')
  expect(await bubble()).not.toMatch(/secret-client/)
  // then the one whose long turn ended: not over the first piece of news, but when its five minutes are over, and not lost meanwhile
  await k.clock.advance(10_500)
  expect(await bubble()).not.toMatch(/finished its job/)
  await k.clock.advance(RULES.peerGapMs / 2)
  await $.prompt.submit({ text: 'more', wait: false, origin: 'user' } as any) // the person is still here: a pet asleep tells nothing
  await k.clock.advance(RULES.peerGapMs / 2 - 15_000)
  const seen: string[] = []
  for (let i = 0; i < 8; i++) { await k.clock.advance(5_000); seen.push(await bubble()) } // it stays about 12 seconds: looked at while it is up
  expect(seen.join(' | ')).toMatch(/the chat in notes finished its job \d+ min ago/)
  others(); await k.clock.advance(10_500)
  const list = await cardOf($, 'chats')
  expect(list.split('\n')).toEqual([
    'Your open chats',
    '  here    here', // the chat the person is in: only "here", no state and no time
    expect.stringMatching(/^  notes   waiting for you, (just now|\d+ min ago)$/),
    expect.stringMatching(/^  api     may be waiting for your OK, (just now|\d+ min ago)$/),
    expect.stringMatching(/^  vodmax  working, \d+ min ago$/),
    'Folder names, the names you gave your chats and times only, nothing of what is in a chat. /pet chats titles on adds each chat\'s title; /pet chats off turns the board off.',
  ])
  expect(list).not.toMatch(/  old |secret|home\//) // the dead one is closed, and no path is shown
  expect(k.v.calls).toEqual([]) // comments off: not one token
  // they go quiet: after chatDeadMs with no sign of life the others are closed, and the count goes
  await k.clock.advance(RULES.chatDeadMs + 11_000)
  expect(await head()).toMatch(/^Miro  ★ \d+$/)
  expect(k.disk['chat.me'].beat).toBeGreaterThan(T0 + RULES.chatDeadMs) // while this chat kept saying it is alive, every 20 seconds
  // this chat: a call the agent must ask leave for. Nothing for a few seconds (a rule or a classifier answers at once), then "asking"
  await ($ as any).tool.check({ tool: 'Bash', input: { command: 'rm -rf build' }, tool_use_id: 'p1', approver: 'person' })
  await k.clock.advance(2_000)
  expect(k.disk['chat.me'].asking).toBeUndefined()
  await k.clock.advance(4_000)
  expect(k.disk['chat.me']).toMatchObject({ done: false, asking: expect.any(Number) })
  expect(JSON.stringify(k.disk['chat.me'])).not.toMatch(/rm|build|Bash/) // that it waits, never for what
  // the person answers: the call starts, and the chat is at work again
  await $.tool.call({ tool: 'Bash', command: 'rm -rf build', tool_use_id: 'p1' } as any)
  expect(k.disk['chat.me'].asking).toBeUndefined()
  // a call that is allowed at once, or one the person cannot be asked about, is never a wait
  verdict = 'allow'
  await ($ as any).tool.check({ tool: 'Bash', input: { command: 'ls' }, tool_use_id: 'p2', approver: 'person' })
  await k.clock.advance(8_000)
  expect(k.disk['chat.me'].asking).toBeUndefined()
  // the turn ends: waiting for the person; the session ends: closed for the others at once
  await $.turn.complete({ answer: 'done', reason: 'answer' } as any)
  expect(k.disk['chat.me']).toMatchObject({ done: true })
  // off: no count, no news, and the mark is the least there ever was (no sign of life: the others take the chat for closed)
  others()
  expect(k.disk['chat.me'].beat).toBeGreaterThan(0)
  // the answer says both sides of it: the others no longer see this chat, and this chat no longer sees them
  expect(await cardOf($, 'chats off')).toBe('The board of the chats is off. From now on your other chats no longer see this chat: they take it for closed. And this chat no longer sees them: no count beside the name, no news, no list. /pet chats on turns it back on.')
  expect(k.disk['chat.me'].beat).toBeUndefined() // at once: no sign of life in its mark, so the others take it for closed from this moment
  for (const [lang, said] of [['es', /tus otros chats ya no ven este chat: lo dan por cerrado\. Y este chat ya no los ve/], ['pt', /as suas outras conversas já não veem esta: dão-na por fechada\. E esta já não as vê/], ['zh', /你的其他对话看不到本对话：它们把它当作已关闭。本对话也看不到它们/]] as const) { await cardOf($, `lang ${lang}`); expect(await cardOf($, 'chats off')).toMatch(said) }
  await cardOf($, 'lang en')
  await k.clock.advance(10_500)
  expect(await head()).toMatch(/^Miro  ★ \d+$/)
  expect(await cardOf($, 'chats')).toMatch(/^The board of the chats is off/)
  await $.prompt.submit({ text: 'again', wait: false, origin: 'user' } as any)
  expect(k.disk['chat.me'].beat).toBeUndefined()
  expect(prefsOf(k.disk).chats).toBe(false)
  expect(await cardOf($, 'chats on')).toMatch(/^The board of the chats is on/)
  expect(k.disk['chat.me'].beat).toBeGreaterThan(0) // seen again by the others, at once
  await $.turn.complete({ answer: 'done', reason: 'answer' } as any)
  await $.session.end({ reason: 'exit', sessionId: 'me' } as any)
  expect(k.disk['chat.me']).toMatchObject({ closed: true })
  expect(JSON.stringify(Object.fromEntries(Object.entries(k.disk).filter(([key]) => key.startsWith('chat.me'))))).not.toMatch(/again|rm -rf|build|Bash/) // nothing of a prompt, a command or a tool
})

test('/pet chats: the row of the chat the person is in says only "here", in the four languages, and that chat never counts among the ones that wait', async ($, on) => {
  const k = voiceKit($, on, { voice: false })
  k.disk.pet = { owned: [] }
  const MIN = 60_000
  await $.session.start({ cwd: '/w/desk', surface: 'terminal', isInteractive: true })
  const head = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const t = (await ui.findAll({ type: 'Text' })).map((x: any) => String(x.text)); await ui.unmount(); return t.find(x => x.includes('★')) ?? '' }
  const mine = async () => (await cardOf($, 'chats')).split('\n')[1]
  // its own turn ended: this chat waits for the person, and is still "here", with no state and no time; nothing is counted
  await $.prompt.submit({ text: 'go', wait: false, origin: 'user' } as any)
  await $.turn.complete({ answer: 'done', reason: 'answer' } as any)
  expect(k.disk['chat.me']).toMatchObject({ done: true })
  await k.clock.advance(10_500)
  expect(await head()).toMatch(/^Miro  ★ \d+$/)
  expect(await mine()).toBe('  desk  here')
  // another chat waits too: one is counted, never two
  const now = Number(k.disk['chat.me'].beat)
  k.disk['chat.idle'] = { cwd: '/home/me/work/notes', at: now, done: true, took: 3 * MIN, beat: now }
  await k.clock.advance(10_500)
  expect(await head()).toMatch(/^Miro  ★ \d+  ·  1 chat waits for you$/)
  expect((await cardOf($, 'chats')).split('\n').slice(1, 3)).toEqual(['  desk   here', expect.stringMatching(/^  notes  waiting for you, (just now|\d+ min ago)$/)])
  for (const [lang, here, waits] of [['es', 'aquí', 'te espera'], ['pt', 'aqui', 'espera por você'], ['zh', '这里', '在等你'], ['en', 'here', 'waiting for you']] as const) {
    await cardOf($, `lang ${lang}`)
    const rows = (await cardOf($, 'chats')).split('\n')
    expect([lang, rows[1]]).toEqual([lang, `  desk   ${here}`])
    expect(rows[2]).toContain(waits)
  }
})

test('which chat needs me: with the comments on the small model may say the news, under the same cap; with the band hidden nothing is asked; under the bench no chat leaves a mark; marks too old leave the store', async ($, on) => {
  const k = voiceKit($, on, { voice: true })
  const MIN = 60_000, T0 = Date.UTC(2026, 10, 12, 12)
  k.disk['chat.ancient'] = { cwd: '/w/x', at: T0 - RULES.marksMs - MIN, done: true, beat: T0 - RULES.marksMs - MIN }
  k.disk['chat.recent'] = { cwd: '/w/y', at: T0 - 5 * 86_400_000, done: true, beat: T0 - 5 * 86_400_000 }
  await $.session.start({ cwd: '/w/here', surface: 'terminal', isInteractive: true })
  expect([k.disk['chat.ancient'], !!k.disk['chat.recent']]).toEqual([undefined, true]) // older than 30 days: gone at a start
  await $.prompt.submit({ text: 'go', wait: false, origin: 'user' } as any)
  const now = Number(k.disk['chat.me'].beat)
  k.v.reply = { isAnswered: true, text: 'Someone is knocking over in api.', usage: USAGE }
  k.disk['chat.stuck'] = { cwd: '/home/me/secret-client/api', at: now - 6 * MIN, done: false, asking: now - 20_000, beat: now }
  await k.clock.advance(10_500); await k.settle()
  expect(k.v.calls.length).toBe(1)
  expect(k.v.calls[0].prompt).toMatch(/the one in the folder api, has stopped in the middle of its work\n- it seems to be waiting for the person to allow something/)
  expect(JSON.stringify(k.v.calls[0])).not.toMatch(/secret-client|home\/me/)
  expect((await k.texts()).join(' ')).toContain('Someone is knocking over in api.')
  expect(k.disk.voice).toMatchObject({ today: 1, by: { peer: expect.any(Number) } }) // counted in the day like any comment
  // hidden: the mark is still kept, the count is not shown, and nothing is asked of the model
  await cardOf($, 'hide')
  k.disk['chat.stuck2'] = { cwd: '/w/other', at: now, done: false, asking: now + 70_000, beat: now + 80_000 }
  await k.clock.advance(90_000); await k.settle()
  expect(k.v.calls.length).toBe(1)
})

test('which chat needs me: under the bench no chat leaves a mark and there is no board', async ($, on) => {
  const k = voiceKit($, on, { voice: false })
  k.env.HATCHLING_BENCH = '/var/tmp/bench'
  await $.session.start({ cwd: '/w/here', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: 'go', wait: false, origin: 'user' } as any)
  await k.clock.advance(30_000)
  expect(Object.keys(k.disk).filter(key => key.startsWith('chat'))).toEqual([])
  expect(await cardOf($, 'chats')).toBe('No board of the chats: under the bench no chat leaves a mark.')
})

test('the Santa hat out of December: the catalogue says "in December" in the four languages and nothing is sold', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true })
  k.disk.pet = { coins: 100, affection: 100, days: 1, day: dayOf(Date.UTC(2026, 10, 12, 12)), owned: [] }
  await $.session.start(START) // 12 November
  expect(await cardOf($, 'shop')).toMatch(/^  santa +a Santa hat +40  head +in December$/m)
  for (const [lang, name, when] of [['es', 'un gorro de Papá Noel', 'en diciembre'], ['pt', 'um gorro de Papai Noel', 'em dezembro'], ['zh', '圣诞帽', '12 月出售'], ['en', 'a Santa hat', 'in December']]) {
    await cardOf($, `lang ${lang}`)
    expect(await cardOf($, 'shop')).toMatch(new RegExp(`^  santa +${name} +40  \\S+ +${when}$`, 'm'))
    expect(await cardOf($, 'shop')).not.toMatch(/undefined|\{\w+\}|shop\.month/)
  }
  for (const verb of ['shop', 'buy']) expect(await cardOf($, `${verb} santa`)).toBe('a Santa hat is sold only in December. Whoever has it keeps it all year.')
  expect([k.disk.pet.coins, k.disk.pet.owned, await cardOf($, 'wear santa')]).toEqual([100, [], expect.stringMatching(/^Not yours yet: santa\./)])
  // the other things are sold as ever
  expect(await cardOf($, 'shop wizard')).toMatch(/^Bought a wizard's hat for 80 stars, 20 left\./)
})

const MIRO = { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true }
test('the Santa hat in December: a row like any other, bought and on at once', async ($, on) => {
  const k = home(on, {}, MIRO, Date.UTC(2026, 11, 10, 12))
  k.disk.pet = { coins: 100, affection: 100, days: 1, day: dayOf(Date.UTC(2026, 11, 10, 12)), owned: [] }
  await $.session.start(START)
  expect(await cardOf($, 'shop')).toMatch(/^  santa +a Santa hat +40  head$/m)
  expect(await cardOf($, 'shop santa')).toBe('Bought a Santa hat for 40 stars, 60 left. Miro wears it now, head: /pet wear santa takes it off.')
  expect([k.disk.pet.owned, prefsOf(k.disk).wear]).toEqual([['santa'], 'santa'])
})

test('the Santa hat after December: who has it keeps it, sees it as theirs in the catalogue and wears it', async ($, on) => {
  const k = home(on, {}, { ...MIRO, wear: 'santa' }, Date.UTC(2027, 1, 10, 12))
  k.disk.pet = { coins: 100, affection: 100, days: 1, day: dayOf(Date.UTC(2027, 1, 10, 12)), owned: ['santa'] }
  await $.session.start(START)
  expect(await cardOf($, 'shop')).toMatch(/^  santa +a Santa hat +40  head +yours, worn$/m)
  expect(await cardOf($, 'shop santa')).toMatch(/^You already have a Santa hat/)
  expect(await cardOf($, 'wear santa')).toBe('a Santa hat comes off.\nMiro wears nothing.')
  expect(await cardOf($, 'wear santa')).toBe('a Santa hat goes on, head.\nMiro wears head: a Santa hat.')
})

test('the plain coats: bought, on at once, a colour with no glint that things to wear leave alone, turned by the coat\'s button; on a light theme each takes its own darkest colour at the edge', async ($, on) => {
  const k = home(on, {}, { species: 'bunny', born: 'bunny', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true })
  k.disk.pet = { coins: 360, affection: 360, days: 1, day: dayOf(Date.UTC(2026, 10, 12, 12)), owned: [] }
  await $.session.start(START)
  const look = async () => {
    const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
    const cells = new Uint32Array(Uint8Array.from(atob((await ui.find({ type: 'Raster' }))!.props.cells as string), c => c.charCodeAt(0)).buffer)
    const keys = (await ui.findAll({ type: 'Button' })).map((b: any) => b.key)
    await ui.unmount()
    return { inks: new Set([...cells].filter((_, i) => i % 3 !== 0)), keys }
  }
  const press = async (key: string) => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); await ui.press({ key }); await k.clock.advance(1); await ui.unmount() }
  const WHITE = 0xf5f5f5, SKY = 0xaee0fa, PINK = 0xf9b9d4, PHOSPHOR = 0x2ed158, GLOW = 0x8cffa8, GLINT = 0xfff6cf, EYE = 0x1b1b1b
  const has = async (...inks: number[]) => { const seen = (await look()).inks; return inks.map(i => seen.has(i)) }

  expect(await cardOf($, 'wear pastel')).toMatch(/^Not yours yet: pastel\./)
  expect(await cardOf($, 'shop pastel')).toBe('Bought a pastel coat for 150 stars, 210 left. Miro wears it now, coat: /pet wear pastel takes it off.')
  expect(await has(WHITE, SKY, PINK, GLINT, EYE)).toEqual([false, true, true, false, true]) // the bunny's white is gone, its eyes are not, and nothing shines
  expect(await cardOf($)).toMatch(/^Miro, Hatchling the bunny, .*(\n.*)*\n210 stars; owns a pastel coat\. \/pet shop\n  wears coat: a pastel coat$/m) // golden is the golden coat's word
  expect(await cardOf($, 'shop terminal')).toBe('Bought a terminal coat for 200 stars, 10 left. Miro wears it now, coat: /pet wear terminal takes it off.')
  expect(await has(WHITE, SKY, PHOSPHOR, GLOW, GLINT, EYE)).toEqual([false, false, true, true, false, true])
  expect(await cardOf($, 'shop')).toMatch(/\n  pastel +a pastel coat +150  coat +yours\n  terminal +a terminal coat +200  coat +yours, worn\n  golden +a golden coat +300  coat\n/)
  expect(k.disk.pet).toMatchObject({ coins: 10, affection: 360, owned: ['pastel', 'terminal'] })

  // a colour: taking everything off leaves it, plain takes it off, and the coat's button goes through each one owned and then the pet's own
  expect(await cardOf($, 'wear none')).toBe('Miro wears nothing; the coat stays.')
  expect(prefsOf(k.disk).wear).toBe('terminal')
  expect(await cardOf($, 'wear plain')).toBe('Miro wears nothing.')
  expect(await has(WHITE, PHOSPHOR)).toEqual([true, false])
  expect(await cardOf($, 'wear pastel')).toBe('a pastel coat goes on, coat.\nMiro wears coat: a pastel coat.')
  await press('skin')
  const seen = []
  for (let i = 0; i < 3; i++) { await press('slot-coat'); seen.push(prefsOf(k.disk).wear) }
  expect(seen).toEqual(['terminal', 'none', 'pastel'])

  // a light theme: a pale colour of the coat takes the coat's darkest where it touches the background, never the grey a darkened pastel is
  Object.assign(k, { theme: 'light' })
  await $.session.start(START)
  expect(await has(SKY, 0xd184b0, 0x688696, EYE)).toEqual([true, true, false, true])
  await cardOf($, 'wear terminal')
  expect(await has(PHOSPHOR, 0x157a36, 0x549965, EYE)).toEqual([true, true, false, true])
})

const EARLY = Date.UTC(2026, 10, 12, 12), AFTER = new Date(2027, 1, 1, 12).getTime() // a day before FOUNDER_UNTIL, and a day after it
test("the founder's eggshell: a pet hatched in time has it and wears it; the catalogue lists it apart, and nobody can buy it", async ($, on) => {
  expect(FOUNDER_UNTIL).toBe('2026-12-17')
  const k = home(on, {}) // an empty store, on 12 November 2026
  await $.session.start(START)
  await k.clock.advance(9_000)
  expect(k.disk.pet).toMatchObject({ owned: ['eggshell'], born: EARLY })
  expect(prefsOf(k.disk).wear ?? '').toBe('') // on by itself: nothing had to be kept
  expect(await cardOf($)).toMatch(/owns half an eggshell\. \/pet shop\n  wears head: half an eggshell\n/)
  expect(await cardOf($, 'shop')).toMatch(/\n  golden +a golden coat +300  coat\n\n  eggshell +half an eggshell +–  head +yours, worn\n\n/)
  expect(await cardOf($, 'shop eggshell')).toBe('You already have half an eggshell. /pet wear eggshell puts it on.')
  expect([await cardOf($, 'wear eggshell'), await cardOf($, 'shop')]).toEqual([expect.stringMatching(/^half an eggshell comes off\./), expect.stringMatching(/^  eggshell +half an eggshell +–  head +yours$/m)])
  expect(await cardOf($, 'wear eggshell')).toMatch(/half an eggshell/)
  // drawn: the white of the shell is over the head
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const cells = new Uint32Array(Uint8Array.from(atob((await ui.find({ type: 'Raster' }))!.props.cells as string), c => c.charCodeAt(0)).buffer)
  expect([...cells]).toContain(parseInt(zoo.common.i.slice(1), 16))
  await ui.unmount()
})

test("the founder's eggshell after the date: a newborn has none, in the four languages the catalogue says founders only, and who has it keeps it", async ($, on) => {
  const k = home(on, {}, undefined, AFTER)
  await $.session.start(START)
  await k.clock.advance(9_000)
  expect(k.disk.pet).toMatchObject({ owned: [], born: AFTER })
  expect(await cardOf($)).toMatch(/owns nothing yet/)
  for (const [lang, name, only, no] of [['es', 'media cáscara de huevo', 'solo fundadores', /^media cáscara de huevo no se vende: .* 2026-12-17\.$/], ['pt', 'meia casca de ovo', 'só fundadores', /^meia casca de ovo não é vendida: .* 2026-12-17\.$/], ['zh', '半个蛋壳', '仅限创始宠物', /^半个蛋壳不出售：.* 2026-12-17 /], ['en', 'half an eggshell', 'founders only', /^half an eggshell is not sold: it is the keepsake of the pets hatched by 2026-12-17\.$/]] as const) {
    await cardOf($, `lang ${lang}`)
    const shop = await cardOf($, 'shop')
    expect(shop).toMatch(new RegExp(`^  eggshell +${name} +–  \\S+ +${only}$`, 'm'))
    expect(shop).not.toMatch(/undefined|\{\w+\}|shop\.founder/)
    for (const verb of ['shop', 'buy']) expect(await cardOf($, `${verb} eggshell`)).toMatch(no)
  }
  expect([k.disk.pet.owned, await cardOf($, 'wear eggshell')]).toEqual([[], expect.stringMatching(/^Not yours yet: eggshell\./)])
  // a pet born in time that has it still has it and wears it after the date; a new start takes nothing away
  k.state = {}
  k.disk.pet = { ...k.disk.pet, owned: ['eggshell', 'cap'], born: EARLY }
  elsewhere(k.disk, { wear: 'eggshell' })
  await $.session.start(START)
  expect(k.disk.pet).toMatchObject({ owned: ['eggshell', 'cap'], born: EARLY })
  expect(await cardOf($)).toMatch(/owns half an eggshell, a travel cap\. \/pet shop\n  wears head: half an eggshell\n/)
  expect(await cardOf($, 'shop')).toMatch(/^  eggshell +half an eggshell +–  head +yours, worn$/m)
})

// `born: 0` is a pet kept by a version that knew no birth (without it the kit says born late, see `home`)
const OLD = { coins: 5, affection: 100, days: 9, born: 0 }
test("the founder's eggshell for a pet born before this version: the first start gives it, and puts it on a head with nothing on", async ($, on) => {
  const k = home(on, {}, { ...MIRO, wear: 'scarf' })
  k.disk.pet = { ...OLD, day: dayOf(EARLY), owned: ['scarf', 'cap'] }
  await $.session.start(START)
  expect(k.disk.pet).toMatchObject({ owned: ['eggshell', 'scarf', 'cap'], born: EARLY })
  expect(prefsOf(k.disk).wear).toBe('eggshell scarf') // the head was free
  // a hat on, a head left bare, or everything taken off by choice: owned, and not put on
  for (const wear of ['cap', 'scarf nohead', 'none']) {
    k.state = {}; k.disk.pet = { ...OLD, day: dayOf(EARLY), owned: ['scarf', 'cap'] }; elsewhere(k.disk, { wear })
    await $.session.start(START)
    expect([k.disk.pet.owned, prefsOf(k.disk).wear]).toEqual([['eggshell', 'scarf', 'cap'], wear])
  }
})

test("the founder's eggshell for a pet first started on this version after the date: none, unless its diary began in time", async ($, on) => {
  const k = home(on, {}, MIRO, AFTER)
  k.disk.pet = { ...OLD, day: dayOf(AFTER), owned: [] }
  await $.session.start(START)
  expect(k.disk.pet).toMatchObject({ owned: [], born: AFTER })
  k.state = {}; k.disk.pet = { ...OLD, day: dayOf(AFTER), owned: [] }; k.disk.diary = diaryOpened(diaryOf(undefined), { now: EARLY, folder: 'w' })
  await $.session.start(START)
  expect(k.disk.pet).toMatchObject({ owned: ['eggshell'], born: EARLY })
})

test("the founder's eggshell under the bench: the same rule on the bench's own pet, in time and after the date, and nothing of it on the disk", async ($, on) => {
  const k = home(on, {})
  k.env.HATCHLING_BENCH = '/var/tmp/bench'
  await $.session.start({ ...START, isInteractive: false })
  expect(await cardOf($)).toMatch(/owns half an eggshell\. \/pet shop\n  wears head: half an eggshell\n/)
  expect(k.disk.pet).toBeUndefined()
})
test("the founder's eggshell under the bench after the date: none", async ($, on) => {
  const k = home(on, {}, undefined, AFTER)
  k.env.HATCHLING_BENCH = '/var/tmp/bench'
  await $.session.start({ ...START, isInteractive: false })
  expect(await cardOf($)).toMatch(/owns nothing yet/)
  expect(k.disk.pet).toBeUndefined()
})

test('the hood of the hoodie gives way to a hat: with a thing on the head only the body of the hoodie is drawn; the crown and the hood go together', async ($, on) => {
  const k = home(on, {}, { ...MIRO, wear: 'hoodie' })
  k.disk.pet = { coins: 0, affection: 100, days: 9, day: dayOf(EARLY), owned: ['sombrero', 'hoodie'] }
  await $.session.start(START)
  const BLUE = parseInt(zoo.common.u.slice(1), 16)
  const blue = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const cells = new Uint32Array(Uint8Array.from(atob((await ui.find({ type: 'Raster' }))!.props.cells as string), c => c.charCodeAt(0)).buffer); await ui.unmount(); return [...cells].filter(c => c === BLUE).length }
  const up = await blue()
  await cardOf($, 'wear sombrero')
  const under = await blue()
  expect(under).toBeGreaterThan(0)
  expect(up).toBeGreaterThan(under) // the hood is gone, the body stays
  await cardOf($, 'wear sombrero') // off again: the hood is back
  expect(await blue()).toBe(up)
  // every animal, adult and baby: a hood above the neck, drawn outside the body only, so behind the ears
  for (const [name, a] of Object.entries(zoo.pack.animals) as [string, any][]) for (const body of ['adult', 'baby'] as const) {
    const hood = marksFor('hoodie', name, body).filter(m => m[0] < a.anchors[body].neck), base = a.states[body].frames[0] as string[]
    expect([name, body, hood.length > 4]).toEqual([name, body, true])
    for (const [r, c] of hood) expect([name, body, r, c, base[r]?.[c] ?? '.']).toEqual([name, body, r, c, '.'])
  }
})

// The picture /pet share hands to Node: the path it is to be written at, and its rows of palette indexes (the PNG is stored, not compressed)
const shared = (run: { argv: string[], stdin: string }) => {
  const b = Uint8Array.from(atob(run.stdin), ch => ch.charCodeAt(0)), view = new DataView(b.buffer)
  expect([...b.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  expect([view.getUint32(16), view.getUint32(20)]).toEqual([800, 420])
  let at = 8
  while (String.fromCharCode(...b.subarray(at + 4, at + 8)) !== 'IDAT') at += 12 + view.getUint32(at)
  const raw: number[] = []
  for (let z = at + 10, last = 0; !last; z += 5 + view.getUint16(z + 1, true)) { last = b[z]!; raw.push(...b.subarray(z + 5, z + 5 + view.getUint16(z + 1, true))) }
  expect(raw.length).toBe(801 * 420)
  return { file: run.argv[2]!, argv: run.argv, words: Array.from({ length: 420 }, (_, y) => raw.slice(y * 801 + 1 + TEXT_X, (y + 1) * 801).join('')).join('\n'), pet: raw.filter((c, i) => c > 4 && (i % 801) - 1 < TEXT_X).length }
}
/** The same part of a picture with these words and no pet. */
const wordsOf = (lines: string[]) => { const p = picture({ rows: [], palette: {} }, lines); return Array.from({ length: 420 }, (_, y) => [...p.px.subarray(y * 800 + TEXT_X, (y + 1) * 800)].join('')).join('\n') }

test('/pet share: a colour picture of the pet written by Node in the config folder, its path said, the words from the pet only and nothing of the work', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true, personality: 'A secret adopted line.', hatched: 1_700_000_000_000, cuddles: 4141, wear: 'sombrero hoodie skateboard suitcase golden' })
  k.disk.pet = { variant: 'golden', coins: 123, affection: 98_765, days: 5151, day: dayOf(EARLY), born: EARLY, life: { input: 77_777_777, cacheRead: 88_888_888 }, owned: ['eggshell', 'sombrero', 'hoodie', 'skateboard', 'suitcase', 'golden'], animals: ['penguin'] }
  // E24: node is run by its absolute path, from an absolute folder of the PATH that is not inside the project: never a `node`
  // found through the working folder (an empty entry, `.`, a relative one) or left in the repository
  k.env.PATH = ':.:bin:/w/secretproj/bin:/w/secretproj:/usr/bin'
  const stats: string[] = []
  on('fs.stat', (_: any, e: any) => { stats.push(e.path); if (!['/usr/bin/node', '/w/secretproj/bin/node'].includes(e.path)) throw new Error('ENOENT'); return { value: { kind: 'file', size: 1, mtimeMs: 0, isLink: false } } })
  const ran: { argv: string[], stdin: string }[] = []
  let exitCode = 0
  on('process.run', (_: any, e: any) => { ran.push({ argv: e.argv, stdin: e.init.stdin }); return { value: { exitCode, stdout: '', stderr: '' } } as any })
  await $.session.start({ ...START, cwd: '/w/secretproj' })
  const said = await cardOf($, 'share')
  expect(said).toBe('Saved a picture of the pet: /home/me/.claude/hatchling-share/hatchling-miro.png\nAttach it to a post. Nothing about your work is on it.')
  const one = shared(ran[0]!)
  expect(one.argv).toEqual(['/usr/bin/node', expect.stringMatching(/\/engine\/share-save\.js$/), '/home/me/.claude/hatchling-share/hatchling-miro.png'])
  expect(stats.some(p => p.startsWith('/w/secretproj') || !p.startsWith('/'))).toBe(false) // the project's own folders were not even looked in
  // the words drawn are these and no others: the name, the animal, the stage and what is special, the strong point, the stars, the link
  expect(one.words).toBe(wordsOf(['Miro', 'Hatchling the fox', 'crown · golden · founder', 'Checks everything twice', '★ 123 stars', 'github.com/silirim/hatchling']))
  expect(one.pet).toBeGreaterThan(5000) // and the pet, in colours of its own
  expect(k.writes).toEqual([]) // nothing written by the mod itself
  // the picture is in English whatever the pet's language; what is said about it is in that language
  await cardOf($, 'lang es')
  expect(await cardOf($, 'share')).toMatch(/^Guardé una imagen de la mascota: \/home\/me\/\.claude\/hatchling-share\/hatchling-miro\.png\n/)
  expect(ran[1]!.stdin).toBe(ran[0]!.stdin)
  await cardOf($, 'lang en')
  // whatever the name, the file is in the folder; the config folder Claude Code was given is the one used
  k.env.CLAUDE_CONFIG_DIR = '/cfg'
  for (const [name, file] of [['../../etc/x', 'hatchling-etcx.png'], ["a'b - c", 'hatchling-a-b-c.png'], ['--', 'hatchling-pet.png']] as const) {
    k.disk['pref.name'] = name
    k.state = {}
    expect(await cardOf($, 'share')).toMatch(new RegExp(`: /cfg/hatchling-share/${file}\n`))
    expect(ran.at(-1)!.argv[2]).toBe(`/cfg/hatchling-share/${file}`)
  }
  // Node fails, or there is none: the same picture as an SVG, written by the mod, and said
  exitCode = 1
  expect(await cardOf($, 'share')).toMatch(/^Saved a picture of the pet as an SVG, since `node` is not on the PATH to write a PNG: \/cfg\/hatchling-share\/hatchling-pet\.svg\n/)
  k.env.PATH = '/opt/empty'
  const runs = ran.length
  expect(await cardOf($, 'share')).toMatch(/hatchling-pet\.svg\n/)
  expect([ran.length, k.writes]).toEqual([runs, ['/cfg/hatchling-share/hatchling-pet.svg', '/cfg/hatchling-share/hatchling-pet.svg']])
})

test('/pet share for a rare baby born after the founders: it says so, with no founder and no golden; a folder that cannot be written is said', async ($, on) => {
  const k = home(on, {}, { species: 'axolotl', born: 'axolotl', seed: 9, name: 'Lola', stats: [80, 30, 60, 20, 50], asked: true }, AFTER)
  k.disk.pet = { coins: 1, affection: 3, days: 1, day: dayOf(AFTER), owned: [] }
  k.env.PATH = '/usr/bin'
  on('fs.stat', () => ({ value: { kind: 'file', size: 1, mtimeMs: 0, isLink: false } }))
  const ran: { argv: string[], stdin: string }[] = []
  on('process.run', (_: any, e: any) => { ran.push({ argv: e.argv, stdin: e.init.stdin }); if (ran.length > 1) throw new Error('EACCES'); return { value: { exitCode: 0, stdout: '', stderr: '' } } as any })
  await $.session.start(START)
  expect(await cardOf($, 'share')).toMatch(/hatchling-lola\.png\n/)
  expect(shared(ran[0]!).words).toBe(wordsOf(['Lola', 'Hatchling the axolotl', 'baby · a rare one', 'Says it dry and short', '★ 1 star', 'github.com/silirim/hatchling']))
  ;(k as any).sealed = true // nothing can be written
  expect(await cardOf($, 'share')).toBe('The picture could not be saved: the folder hatchling-share in your Claude Code config folder could not be written.')
})

test('/pet call me: the pet learns the person\'s name only from what is typed there, cleaned and cut; says it one cuddle in three; forgets it when told; and reads a name nowhere else', async ($, on) => {
  const k = home(on, {}, { species: 'bunny', born: 'bunny', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true })
  const asked: string[] = [], ran: unknown[] = []
  on('env.get', (_: any, e: any) => { asked.push(e.name); return { value: e.name === 'HOME' ? '/home/ana-real' : ({ USER: 'ana-real', USERNAME: 'ana-real', LOGNAME: 'ana-real', GIT_AUTHOR_NAME: 'Ana Real' } as Record<string, string>)[e.name] } })
  on('process.run', (_: any, e: any) => { ran.push(e.argv); return { value: { exitCode: 0, stdout: 'Ana Real', stderr: '' } } as any })
  await $.session.start({ ...START, cwd: '/home/ana-real/work' })
  const pat = async () => { await cardOf($, 'pet'); const b = await drawn($); await b.ui.unmount(); return b.said.join('\n') }
  // none told: it says so, and no line carries a name
  expect(await cardOf($, 'call me')).toBe('I do not know your name. /pet call me <name> tells me: letters, digits, spaces, up to 24 characters. I only know what you type here.')
  expect(await cardOf($, 'call')).toMatch(/^I do not know your name\./)
  expect(prefsOf(k.disk).callme).toBeUndefined()
  for (const _ of [1, 2, 3]) expect(await pat()).not.toMatch(/Ana|ana-real/)
  // told: cleaned, cut to 24, kept under its own key
  expect(await cardOf($, 'call me  \x1b[31mAna\x1b[0m\n María <b> ')).toBe('I will call you Ana María b, now and then.')
  expect(await cardOf($, 'call me Ana María')).toBe('I will call you Ana María, now and then.')
  expect([k.disk['pref.callme'], k.sets.at(-1)]).toEqual(['Ana María', 'pref.callme'])
  expect(await cardOf($, 'call me')).toBe('I call you Ana María. /pet call me <name> changes it, /pet call me nobody forgets it.')
  expect(await cardOf($, `call me ${'x'.repeat(60)}`)).toBe(`I will call you ${'x'.repeat(24)}, now and then.`)
  expect(await cardOf($, 'call me {}<>$')).toMatch(/^I do not know your name\./) // nothing of it is a name: nothing changes
  expect(k.disk['pref.callme']).toBe('x'.repeat(24))
  await cardOf($, 'call me Ana María')
  // the cuddles: the sixth carries the name, the fourth and the fifth do not
  const lines = [await pat(), await pat(), await pat()]
  expect(lines.map(l => /Ana María, /.test(l))).toEqual([false, false, true])
  // in the other languages too
  for (const [lang, is] of [['es', 'Te llamo Ana María.'], ['pt', 'Chamo você de Ana María.'], ['zh', '我叫你 Ana María。']] as const) { await cardOf($, `lang ${lang}`); expect(await cardOf($, 'call me')).toContain(is) }
  await cardOf($, 'lang en')
  // not in the diary, not in the marks of the chats, not on the card; only under its key
  const { 'pref.callme': kept, ...rest } = k.disk
  expect(kept).toBe('Ana María')
  expect(JSON.stringify(rest)).not.toMatch(/Ana María/)
  expect(await cardOf($, 'diary')).not.toMatch(/Ana María/)
  expect(await cardOf($, 'chats')).not.toMatch(/Ana María/)
  // forgotten, by either word: the key holds nothing and the lines are the plain ones again
  expect(await cardOf($, 'call me nobody')).toBe('Forgotten: I no longer know your name.')
  expect(k.disk['pref.callme']).toBe('')
  await cardOf($, 'call me Ana'); expect(await cardOf($, 'call me OFF')).toBe('Forgotten: I no longer know your name.')
  expect(await cardOf($, 'call me')).toMatch(/^I do not know your name\./)
  for (const _ of [7, 8, 9]) expect(await pat()).not.toMatch(/Ana/)
  // nothing else reads a name: no variable of the user or of git is asked, no program is run, no file is read
  expect(asked.filter(name => /USER|LOGNAME|NAME|GIT|MAIL/i.test(name) && name !== 'USERPROFILE')).toEqual([])
  expect([ran, k.reads]).toEqual([[], []])
  expect(JSON.stringify(k.disk)).not.toMatch(/Ana Real/)
})

test('the name told with /pet call me goes to the small model only with comments on, as one more line of the request', async ($, on) => {
  const k = voiceKit($, on, { callme: 'Ana María' })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  // comments off: no request at all, with a name told
  k.v.fail = true
  await k.turn(() => $.tool.call({ tool: 'Bash', command: 'npm test', tool_use_id: 't1' } as any))
  await cardOf($, 'pet'); await cardOf($, 'say hello')
  await k.settle()
  expect(k.v.calls).toEqual([])
  // comments on: the notice says it, and the request carries it
  expect(await cardOf($, 'comments on')).toMatch(/the name you told it with \/pet call me, when you told one;/)
  await k.turn(() => $.tool.call({ tool: 'Bash', command: 'npm test', tool_use_id: 't2' } as any))
  expect(k.v.calls.length).toBe(1)
  expect(k.v.calls[0].system).toMatch(/\nThe person asked you to call them Ana María\. You may say that name now and then, in few of your lines, never in every one\.$/)
  expect(k.v.calls[0].prompt).not.toMatch(/Ana María/)
  // forgotten: the next request has no word of it
  await cardOf($, 'call me nobody')
  await cardOf($, 'say hello')
  await k.settle()
  expect(k.v.calls.length).toBe(2)
  expect(k.v.calls[1].system + k.v.calls[1].prompt).not.toMatch(/Ana|call them/)
})

// The recap: where the work got to, said once when the person is back after a pause. `rows` is what $.session.messages() gives.
const PAUSE = RULES.recapAfterMs
const ROWS = [
  { role: 'user', text: 'an older request', toolUses: [] },
  { role: 'assistant', text: 'OLDER ANSWER', toolUses: [] },
  { role: 'user', text: `fix the\n parser ${'1'.repeat(400)}`, toolUses: [] },
  { role: 'assistant', text: 'First I look.', toolUses: [{ id: 't1', name: 'Bash', input: { command: 'TOOL INPUT' }, text: 'TOOL OUTPUT' }] },
  { role: 'user', text: '', toolUses: [], toolResults: [{ tool_use_id: 't1', text: 'TOOL OUTPUT', isError: false }] },
  { role: 'assistant', text: `${'2'.repeat(20_000)} The parser tests are green; the README is still to do.`, toolUses: [] },
]
const LINE = 'Parser tests are green, the README is still to do. Shall we go on?'
function recapKit($: any, on: any, prefs: object = { voice: true }) {
  const k = voiceKit($, on, prefs), r = { rows: ROWS as any[], reads: 0 }
  on('session.messages', () => { r.reads++; return { value: r.rows } })
  const recaps = () => k.v.calls.filter(c => /comes back to this chat after a pause/.test(c.system))
  const said = async () => (await k.texts()).map(t => t.replace(/\n/g, ' ')) // the bubble wraps a line: read here as one
  return Object.assign(k, { r, recaps, said })
}
const NOW = Date.UTC(2026, 10, 12, 12)

test('the recap: 30 minutes after a turn with no new prompt the pet says once where the work got to, from the last prompt and the last turn\'s text; held in the bubble with its time, and nothing of it on disk', { timeoutMs: 60_000 }, async ($, on) => {
  const k = recapKit($, on)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await k.turn()
  k.v.reply = { isAnswered: true, text: LINE, usage: USAGE }
  await k.clock.advance(PAUSE - 60_000)
  await k.settle()
  expect(k.recaps()).toEqual([]) // not before the pause is over
  expect(k.r.reads).toBe(0)
  await k.clock.advance(60_000)
  await k.settle()
  expect(k.recaps().length).toBe(1)
  const ask = k.recaps()[0]
  expect(ask).toMatchObject({ model: 'haiku', maxTokens: 80, effort: 'low', timeoutMs: 20000 })
  expect(ask.system).toMatch(/^You are Miro, a small pixel fox /) // what a comment gets: the character and the language
  expect(ask.system).toMatch(/where the work got to and what is left to do, then ask in a few words whether to go on.*Do not say when it was/)
  expect(ask.system).toMatch(/One or two short sentences, all on one line, never more than 100 characters\. Plain English\./)
  // the person's last prompt, its first 300 characters on one line; the assistant's text of the last turn, the newest kept; 16,000 in all
  expect(ask.prompt).toMatch(/\nThe person's last request began:\nfix the parser 1{285}\n/)
  expect(ask.prompt).toMatch(/\nWhat the assistant wrote in that turn ended:\n2+ The parser tests are green; the README is still to do\.\n\nThat turn ended by itself\.\n/)
  const sent = ask.prompt.split('began:\n')[1].split('\n')[0].length + ask.prompt.split('turn ended:\n')[1].split('\n\nThat turn')[0].length
  expect(sent).toBe(RULES.recapChars)
  expect(ask.prompt).not.toMatch(/TOOL INPUT|TOOL OUTPUT|OLDER ANSWER|older request|First I look/) // text blocks of the last turn only, and the oldest of them gave way
  // shown with when it was, worked out at the drawing: it stays, and the time moves on
  expect(await k.said()).toContain(`30 min ago: ${LINE}`)
  await k.clock.advance(60 * 60_000)
  await k.settle()
  expect(await k.said()).toContain(`2 h ago: ${LINE}`) // still there, asleep or not
  expect(k.recaps().length).toBe(1) // once per pause
  // counted in the day and in the tokens as any line; neither the input nor the line is in the store
  expect(k.disk.voice).toMatchObject({ today: 2, lines: 2, todayTokens: 640 })
  expect(k.disk.voice.last).toEqual(['Three failures, then green. Noted.'])
  const disk = JSON.stringify(k.disk)
  expect(disk).not.toMatch(/Parser tests|README|fix the|parser|1{20}|2{20}|First I look/)
  expect(JSON.stringify(k.state)).toContain(LINE) // in the session's memory only
  expect(k.disk['chat.me'].recap).toBe(k.disk['chat.me'].at) // the mark keeps which pause it was for: a time
  // the next prompt takes it away
  await $.prompt.submit({ text: 'go on', wait: false, origin: 'user' } as any)
  expect((await k.texts()).join('\n')).not.toContain('Parser tests')
  expect(JSON.stringify(k.state)).not.toContain(LINE)
})

test('the recap: a new prompt cancels the wait, and each pause has its own', { timeoutMs: 60_000 }, async ($, on) => {
  const k = recapKit($, on)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await k.turn()
  await k.clock.advance(PAUSE - 60_000)
  await $.prompt.submit({ text: 'more', wait: false, origin: 'user' } as any) // back before the pause was over
  await k.clock.advance(PAUSE + 60_000) // a turn that runs is no pause
  await k.settle()
  expect(k.recaps()).toEqual([])
  await $.turn.complete({ answer: 'cut', reason: 'aborted' } as any)
  await k.clock.advance(PAUSE - 60_000)
  await k.settle()
  expect(k.recaps()).toEqual([]) // counted from the end of this turn
  await k.clock.advance(60_000)
  await k.settle()
  expect(k.recaps().length).toBe(1)
  expect(k.recaps()[0].prompt).toMatch(/\nThat turn was cut short before the assistant finished: say that it stopped midway, never that the work is done\.\n/)
  await $.command.run({ command: 'pet', args: 'chats' } as any) // a slash command is no prompt
  await k.clock.advance(PAUSE + 60_000)
  await k.settle()
  expect(k.recaps().length).toBe(1)
})

test('the recap with no messages from the session: the end of the reply the comments already hold; with nothing at all, no call', { timeoutMs: 60_000 }, async ($, on) => {
  const k = recapKit($, on)
  k.r.rows = []
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await k.turn(async () => {}, `${'x'.repeat(700)} All done: the tests pass now.`)
  await k.clock.advance(PAUSE)
  await k.settle()
  expect(k.recaps().length).toBe(1)
  expect(k.recaps()[0].prompt).toMatch(/\nWhat the assistant wrote in that turn ended:\nx+ All done: the tests pass now\.\n/)
  expect(k.recaps()[0].prompt.split('turn ended:\n')[1].split('\n\n')[0].length).toBe(600)
  expect(k.recaps()[0].prompt).not.toMatch(/request began|secret plan/)
  await k.turn(async () => {}, '')
  await k.clock.advance(PAUSE)
  await k.settle()
  expect(k.recaps().length).toBe(1)
})

test('the recap of a chat closed and resumed: asked at each start of the process when its last turn is older than 30 minutes, also for a pause already recapped, with the day it was; not again under a reload', { timeoutMs: 60_000 }, async ($, on) => {
  const k = recapKit($, on)
  k.disk['chat.me'] = { cwd: '/w', at: NOW - 24 * 3_600_000, done: true }
  k.v.reply = { isAnswered: true, text: LINE, usage: USAGE }
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await k.settle()
  expect(k.recaps().length).toBe(1)
  expect(await k.said()).toContain(`yesterday: ${LINE}`)
  expect(k.disk['chat.me']).toMatchObject({ at: NOW - 24 * 3_600_000, recap: NOW - 24 * 3_600_000 })
  expect(JSON.stringify(k.disk)).not.toMatch(/Parser tests|README|fix the/)
  // a reload of the mod, the same process: the same pause, no second recap, and the line is still there
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  for (let i = 0; i < 4; i++) await k.clock.advance(8 * 60_000) // in steps: each start of this test adds a tick of its own, and one advance holds only so many
  await k.settle()
  expect(k.recaps().length).toBe(1)
  expect(await k.said()).toContain(`yesterday: ${LINE}`)
  // closed with no prompt and resumed, a new process: the line was in memory only and is lost, so it is asked again, once
  await $.session.end({ reason: 'exit', sessionId: 'me' } as any)
  expect(k.disk['chat.me']).toMatchObject({ closed: true, left: NOW - 24 * 3_600_000 })
  k.state = {}
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await k.settle()
  expect(k.recaps().length).toBe(2)
  expect(await k.said()).toContain(`yesterday: ${LINE}`)
  for (let i = 0; i < 4; i++) await k.clock.advance(8 * 60_000) // in steps: each start of this test adds a tick of its own, and one advance holds only so many
  await k.settle()
  expect(k.recaps().length).toBe(2)
  expect(JSON.stringify(k.disk)).not.toMatch(/Parser tests|README|fix the/)
})

test('the recap of a chat resumed within 30 minutes waits for the rest of them; a turn that was cut is told as cut', { timeoutMs: 60_000 }, async ($, on) => {
  const k = recapKit($, on)
  k.disk['chat.me'] = { cwd: '/w', at: NOW - 10 * 60_000, done: false }
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await k.settle()
  expect(k.recaps()).toEqual([])
  expect(k.r.reads).toBe(0)
  await k.clock.advance(19 * 60_000)
  await k.settle()
  expect(k.recaps()).toEqual([])
  await k.clock.advance(60_000)
  await k.settle()
  expect(k.recaps().length).toBe(1)
  expect(k.recaps()[0].prompt).toMatch(/That turn was cut short/)
})

test('a chat closed keeps in its mark when its last turn was and whether it was cut, and a resume counts from there', { timeoutMs: 60_000 }, async ($, on) => {
  const k = recapKit($, on)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: 'go', wait: false, origin: 'user' } as any)
  await $.turn.complete({ answer: 'half', reason: 'aborted' } as any)
  await k.settle()
  const left = k.disk['chat.me'].at
  await k.clock.advance(5 * 60_000)
  await $.session.end({ reason: 'exit', sessionId: 'me' } as any)
  expect(k.disk['chat.me']).toMatchObject({ closed: true, at: left + 5 * 60_000, left, mid: true })
  k.state = {}
  await k.clock.advance(PAUSE)
  await k.settle()
  expect(k.recaps()).toEqual([]) // the timer of the chat that closed is gone
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await k.settle()
  expect(k.recaps().length).toBe(1)
  expect(k.recaps()[0].prompt).toMatch(/That turn was cut short/)
})

test('the recap one character too long is shown cut at the last whole word, with an ellipsis: paid for, never thrown away', { timeoutMs: 60_000 }, async ($, on) => {
  const k = recapKit($, on)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await k.turn()
  const long = `${'word '.repeat(23)}words.` // 121 characters against the 120 of RULES.recapMaxCols
  expect(long.length).toBe(RULES.recapMaxCols + 1)
  k.v.reply = { isAnswered: true, text: `**${long}**\nmore`, usage: USAGE }
  await k.clock.advance(PAUSE + 60_000)
  await k.settle()
  expect(k.recaps().length).toBe(1)
  expect(await k.said()).toContain(`31 min ago: ${'word '.repeat(23).trim()}\u2026`)
})

test('the recap is part of the comments: off, no call and nothing read from the session; at the day\'s cap, no call; a call that fails, silence', { timeoutMs: 60_000 }, async ($, on) => {
  const k = recapKit($, on, {})
  k.disk['chat.me'] = { cwd: '/w', at: NOW - 2 * 3_600_000, done: true }
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await k.turn()
  await k.clock.advance(PAUSE + 60_000)
  await k.settle()
  expect(k.v.calls).toEqual([])
  expect(k.r.reads).toBe(0)
  expect(k.disk.voice).toBeUndefined()
  // on, with the day's lines used up
  await cardOf($, 'comments on')
  k.disk.voice = { day: dayOf(NOW), today: RULES.voiceCapDay, lines: RULES.voiceCapDay }
  await k.turn()
  await k.clock.advance(PAUSE + 60_000)
  await k.settle()
  expect(k.v.calls).toEqual([])
  expect(k.disk.voice.today).toBe(RULES.voiceCapDay)
  // two lines left, one for the comment at the end of the turn and one for the recap, and the calls fail: counted, and nothing is said
  k.disk.voice = { day: dayOf(NOW), today: RULES.voiceCapDay - 2, lines: RULES.voiceCapDay - 2 }
  k.v.reply = { isAnswered: false, reason: 'error', usage: NONE }
  await k.turn()
  await k.clock.advance(PAUSE + 60_000)
  await k.settle()
  expect(k.recaps().length).toBe(1)
  expect(k.disk.voice.today).toBe(RULES.voiceCapDay)
  expect(JSON.stringify(k.state)).not.toMatch(/"recap":"[^"]/)
  expect((await k.texts()).join('\n')).not.toMatch(/ago: /)
})

// The model of the comments is the person's choice: /pet model.
test('/pet model: haiku as installed; a choice is kept, checked for its shape only and used by every call; default goes back; the card, /pet comments and /pet help show it, in the four languages', async ($, on) => {
  const k = voiceKit($, on, { voice: true })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  // as installed: the alias haiku, and nothing kept for it
  expect(await cardOf($, 'model')).toBe('Comments use the model haiku. /pet model <alias or id> changes it, /pet model default goes back to haiku.')
  expect(await cardOf($, 'help')).toMatch(/\n  \/pet model \[alias\|id\]      the model of the comments, now haiku\n/)
  expect(prefsOf(k.disk).model ?? '').toBe('')
  await sayTo($, 'hello')
  await k.settle()
  expect(k.v.calls.at(-1).model).toBe('haiku')
  // a choice: said with what a larger model comes to, kept under its own key, and the next call is asked of it
  expect(await cardOf($, 'model claude-sonnet-5-5')).toBe('Comments now use the model claude-sonnet-5-5. A larger model costs more tokens per line. /pet model default goes back to haiku.')
  expect(k.disk['pref.model']).toBe('claude-sonnet-5-5')
  expect(await cardOf($, 'model')).toBe('Comments use the model claude-sonnet-5-5. /pet model <alias or id> changes it, /pet model default goes back to haiku.')
  await k.clock.advance(6_000)
  await sayTo($, 'hello again')
  await k.settle()
  expect(k.v.calls.length).toBe(2)
  expect(k.v.calls[1]).toMatchObject({ model: 'claude-sonnet-5-5', maxTokens: 30, effort: 'low', timeoutMs: 4000 })
  // shown where the comments are told of
  expect(await cardOf($)).toMatch(/\ncomments on: model claude-sonnet-5-5, about /)
  expect(await cardOf($, 'help')).toMatch(/the model of the comments, now claude-sonnet-5-5\n/)
  const says = await cardOf($, 'comments')
  expect(says).toMatch(/one request to a small model \(claude-sonnet-5-5, through Claude Code's own client\)\.\nThe model in use: claude-sonnet-5-5 \(the default is haiku\)\. \/pet model <alias or id> changes it; a larger model costs more tokens per line\./)
  expect(says).toMatch(/depends on the model claude-sonnet-5-5 leads to on your account\./)
  // an id keeps its capitals; the verb does not mind them
  expect(await cardOf($, 'MODEL us.anthropic.Claude-Haiku-v1:0')).toMatch(/^Comments now use the model us\.anthropic\.Claude-Haiku-v1:0\./)
  expect(k.disk['pref.model']).toBe('us.anthropic.Claude-Haiku-v1:0')
  // a bad shape is refused, told, and the choice stays
  for (const bad of ['two words', 'ha"iku', 'haiku;rm', '-x', 'modèle', 'a'.repeat(101)]) {
    expect(await cardOf($, `model ${bad}`)).toMatch(/^Not a model name: .*Give one word, an alias such as haiku or a full model id: letters, digits and \. _ : \/ @ - \[ \], at most 100 characters\.$/)
    expect(k.disk['pref.model']).toBe('us.anthropic.Claude-Haiku-v1:0')
  }
  // the four languages
  for (const [lang, is, help] of [['es', /^Los comentarios usan el modelo us\.anthropic/, /el modelo de los comentarios, ahora us\.anthropic/], ['pt', /^Os comentários usam o modelo us\.anthropic/, /o modelo dos comentários, agora us\.anthropic/], ['zh', /^点评用的模型是 us\.anthropic/, /点评用的模型，现在是 us\.anthropic/]] as const) {
    await cardOf($, `lang ${lang}`)
    expect(await cardOf($, 'model')).toMatch(is)
    expect(await cardOf($, 'help')).toMatch(help)
    expect(await cardOf($)).toMatch(/us\.anthropic\.Claude-Haiku-v1:0/)
  }
  await cardOf($, 'lang en')
  // default: back to haiku, in the store and in the next call; a chat that starts over reads the same
  expect(await cardOf($, 'model default')).toBe('Comments use the default model again: haiku.')
  expect(k.disk['pref.model']).toBe('')
  await k.clock.advance(6_000)
  await sayTo($, 'and now')
  await k.settle()
  expect(k.v.calls.at(-1).model).toBe('haiku')
  await cardOf($, 'model opus')
  k.state = {}
  expect(await cardOf($, 'model')).toMatch(/^Comments use the model opus\./)
  // a choice in the store that has no shape of a model reads as none
  k.disk['pref.model'] = 'not a model'
  k.state = {}
  expect(await cardOf($, 'model')).toMatch(/^Comments use the model haiku\./)
})

test('a model that is not there: the pet stays silent, never takes another model, and says so in a toast once a day; any other failure is silent', async ($, on) => {
  const k = voiceKit($, on, { voice: true, model: 'claude-gone-1' })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  const GONE = 'Hatchling: the model claude-gone-1 did not answer. Choose another with /pet model.'
  const told = () => k.toasts.filter(t => /did not answer|no respondió/.test(t))
  const say = async () => { await k.clock.advance(6_000); await sayTo($, 'hello'); await k.settle() }
  // every other failure: the network, an overload, a wrong request, the account, a call out of time, no text
  const usage = NONE
  for (const reply of [
    { isAnswered: false, reason: 'api-error', status: null, error: 'unknown', usage },
    { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage },
    { isAnswered: false, reason: 'api-error', status: 400, error: 'invalid_request', usage },
    { isAnswered: false, reason: 'api-error', status: 403, error: 'authentication_failed', usage },
    { isAnswered: false, reason: 'aborted', usage },
    { isAnswered: false, reason: 'empty-reply', usage },
  ]) { k.v.reply = reply; await say() }
  expect(k.v.calls.length).toBe(6)
  expect(told()).toEqual([])
  expect(k.disk.voiceGone).toBeUndefined()
  // the API says there is no such model: silence in the bubble (the fixed line of a lost answer), one toast, and the same model asked again
  k.v.reply = { isAnswered: false, reason: 'api-error', status: 404, error: 'model_not_found', usage }
  await say()
  expect(told()).toEqual([GONE])
  expect(k.v.calls.at(-1).model).toBe('claude-gone-1')
  expect((await bubbleOf($)).join(' ')).not.toMatch(/claude-gone-1|did not answer/)
  // the same day, the same model: not a second time, in this chat or after a /clear
  // (Claude Code's own refusal of a model rejects the call: the kit skips a hook that throws, so that way is tested in engine/voice.test.js)
  await say()
  k.v.reply = { isAnswered: false, reason: 'api-error', status: 404, error: 'unknown', usage }
  await say()
  k.state = {}
  await say()
  expect(told()).toEqual([GONE])
  expect(k.v.calls.every((c: any) => c.model === 'claude-gone-1')).toBe(true) // never another model by itself
  expect(prefsOf(k.disk).model).toBe('claude-gone-1')
  // the next day: once more
  k.disk.voiceGone.day--
  await say()
  await say()
  expect(told()).toEqual([GONE, GONE])
  // another model that is not there either is told of the same day; one that answers is not
  await cardOf($, 'model claude-gone-2')
  await say()
  expect(told().at(-1)).toBe('Hatchling: the model claude-gone-2 did not answer. Choose another with /pet model.')
  expect(told().length).toBe(3)
  k.v.reply = { isAnswered: true, text: 'Here I am.', usage: USAGE }
  await cardOf($, 'model default')
  await say()
  expect(k.v.calls.at(-1).model).toBe('haiku')
  expect(await bubbleOf($)).toEqual(['Here I am.'])
  expect(told().length).toBe(3)
  // in the pet's language
  await cardOf($, 'lang es')
  await cardOf($, 'model claude-gone-3')
  k.v.reply = { isAnswered: false, reason: 'api-error', status: 404, error: 'model_not_found', usage }
  await say()
  expect(told().at(-1)).toBe('Hatchling: el modelo claude-gone-3 no respondió. Elige otro con /pet model.')
})

// The terminal's drawing, pinned: the cells of a fixed pet, bare and dressed, on a dark and on a light theme, as they were
// before the apps got a drawing of their own. A change here is a change of what the terminal shows
test('the terminal drawing is the same, byte for byte', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true, lang: 'en' })
  k.disk.pet = { coins: 0, affection: 4, days: 1, day: dayOf(Date.UTC(2026, 10, 12, 12)), owned: ['shades', 'skateboard', 'golden'] }
  const hash = (s: string) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0; return h.toString(16) }
  const shot = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const r = (await ui.find({ type: 'Raster' }))!.props; await ui.unmount(); return `${r.columns}x${r.rows} ${hash(String(r.cells))}` }
  const seen: string[] = []
  for (const theme of ['dark', 'light']) {
    ;(k as any).theme = theme
    await $.session.start(START)
    await cardOf($, 'wear none')
    await cardOf($, 'wear plain')
    seen.push(await shot())
    for (const item of ['shades', 'skateboard', 'golden']) await cardOf($, `wear ${item}`)
    seen.push(await shot())
  }
  expect(seen).toEqual(['12x5 f3219565', '14x7 c736b204', '12x5 7a533345', '14x7 538509fc'])
})

// The pet in the Claude apps: an Svg made from the frame the terminal draws, with the name, the phrase and the buttons beside it
test('in the desktop and mobile apps the pet is an Svg with its phrase and buttons; vscode keeps its row', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true, lang: 'en' })
  k.disk.pet = { coins: 0, affection: 4, days: 1, day: dayOf(Date.UTC(2026, 10, 12, 12)), owned: ['shades', 'golden'] }
  on('tool.call', () => ({ result: {} }) as any)
  await $.session.start(START)
  await cardOf($, 'wear none')
  await cardOf($, 'wear plain')
  const look = async (surface: string) => {
    const ui = await $.ui.mount({ ...BAND, surface }) // the kit refuses a tree that does not validate on the surface
    const svg = (await ui.find({ type: 'Svg' }))?.props as any, texts = (await ui.findAll({ type: 'Text' })).map((x: any) => x.text as string), keys = (await ui.findAll({ type: 'Button' })).map((x: any) => x.key as string), raster = !!(await ui.find({ type: 'Raster' }))
    return { ui, svg, texts, keys, raster }
  }
  const fills = (source: string) => new Set([...source.matchAll(/fill="(#[0-9a-f]{6})"/g)].map(m => m[1]))
  await $.tool.call({ tool: 'Read', file_path: '/a.txt' })
  await $.tool.call({ tool: 'Read', file_path: '/a.txt' }) // a phrase with a button of its own
  const shots: Record<string, string> = {}
  for (const surface of ['desktop', 'mobile']) {
    const d = await look(surface)
    expect(d.raster).toBe(false)
    const source = String(d.svg.source)
    shots[surface] = source
    expect(source).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="\d+" height="\d+" viewBox="0 0 \d+ \d+" shape-rendering="crispEdges"><rect /)
    expect(source.length).toBeLessThan(131072)
    expect(source).not.toMatch(/<(script|style|image|foreignObject)|href|on\w+=/) // rects and nothing else
    expect([...source.matchAll(/<rect [^>]*>/g)].every(m => /^<rect x="\d+" y="\d+" width="\d+" height="1" fill="#[0-9a-f]{6}"\/>$/.test(m[0]))).toBe(true) // a rect a run: no rect behind the pet
    expect(d.svg.height).toBeGreaterThanOrEqual(48)
    expect(d.svg.height).toBeLessThanOrEqual(96)
    expect(d.svg.alt).toBe('Miro, fox')
    expect(fills(source).has(REG.species.fox!.palette['1'])).toBe(true) // the fox's own orange
    expect(d.texts[0]).toBe('Miro  ★ 0')
    expect(d.texts.join(' ')).toMatch(/re-read.*a\.txt/)
    expect(d.keys).toEqual(['skin', 'pet', 'fix']) // the pet's own after its name, the phrase's under it
    k.filled = ''
    await d.ui.press({ key: 'fix' })
    expect(k.filled).toMatch(/already in context/)
    await d.ui.unmount()
  }
  expect(shots.mobile).toBe(shots.desktop)

  // no timer moves it: the same picture tick after tick, while the terminal's blinks or breathes
  const seen = new Set<string>()
  for (let i = 0; i < 12; i++) { await k.clock.advance(500); const d = await look('desktop'); seen.add(String(d.svg.source)); await d.ui.unmount() }
  expect([...seen]).toEqual([shots.desktop])

  // what it wears and its coat are in the picture: the golden coat's colours replace the orange
  await cardOf($, 'wear shades')
  const worn = await look('mobile')
  expect(String(worn.svg.source)).not.toBe(shots.desktop)
  await worn.ui.unmount()
  await cardOf($, 'wear golden')
  const gold = await look('desktop')
  expect(fills(String(gold.svg.source)).has(REG.species.fox!.palette['1'])).toBe(false)
  await gold.ui.unmount()
  // a pale or a dark colour that touches the background is not drawn as it is: an outline that reads on a light and on a dark app
  const grid = (source: string) => { const g: Record<string, string> = {}; for (const m of source.matchAll(/x="(\d+)" y="(\d+)" width="(\d+)" height="1" fill="(#[0-9a-f]{6})"/g)) for (let x = +m[1]!; x < +m[1]! + +m[3]!; x++) g[`${x},${m[2]}`] = m[4]!; return g }
  const g = grid(shots.desktop!), rim = Object.entries(g).filter(([at]) => { const [x, y] = at.split(',').map(Number) as [number, number]; return [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(n => !g[n.join(',')]) }).map(([, ink]) => ink)
  expect(rim.length).toBeGreaterThan(10)
  expect(rim.filter(ink => ink === '#f5f5f5' || ink === '#1b1b1b')).toEqual([])

  // the skin button opens the parts in the apps as on the terminal
  const d = await look('desktop')
  await d.ui.press({ key: 'skin' })
  await d.ui.unmount()
  const parts = await look('desktop')
  expect(parts.keys.at(-1)).toBe('skin-done')
  expect(parts.keys.some(key => key.startsWith('slot-'))).toBe(true)
  await parts.ui.unmount()

  // vscode: the row of text, as before
  const code = await look('vscode')
  expect([code.svg, code.raster, code.keys]).toEqual([undefined, false, []])
  expect(code.texts.length).toBe(1)
  expect(code.texts[0]).toMatch(/^Miro  ★ 0/)
  await code.ui.unmount()
})

test('/pet where: a line a surface, with when a client attached, how many times the band was asked there and what the last answer was', async ($, on) => {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true, lang: 'en' })
  k.disk.pet = { coins: 0, affection: 4, days: 1, day: dayOf(Date.UTC(2026, 10, 12, 12)), owned: [] }
  let roster = ['terminal']
  on('session.surfaces', () => ({ value: roster }) as any)
  on('session.attach', (_: any, e: any) => ({ clientId: e.clientId }) as any)
  await $.session.start(START)
  expect((await cardOf($, 'where')).split('\n')).toEqual([
    'Where Hatchling draws (counts since the mod loaded, in memory only; the roster does not tell a mod which elements an app draws)',
    '  terminal  in the roster; the terminal raises no attach; band asked 0 times',
  ])
  roster = ['terminal', 'mobile', 'vscode']
  await $.session.attach({ surface: 'mobile', clientId: 'mobile:default', viewport: { columns: 40, rows: 60 } } as any)
  const ask = async (surface: string, props = {}) => { const ui = await $.ui.mount({ ...BAND, props: { ...BAND.props, ...props }, surface }); await ui.unmount() }
  await ask('terminal'); await ask('terminal', { bodyColumns: 5 }) // too narrow for the drawing: the row
  await ask('mobile')
  await ask('desktop'); await ask('desktop'); await ask('desktop', { hasSurvey: true }) // a survey holds the band: nothing
  await ask('vscode')
  const lines = (await cardOf($, 'where')).split('\n').slice(1)
  expect(lines).toEqual([
    '  terminal  in the roster; the terminal raises no attach; band asked 2 times, last answer: the row of text',
    '  mobile    in the roster; mobile:default attached 12:00:00 UTC, 40x60 cells; band asked 1 time, last answer: the Svg picture',
    '  vscode    in the roster; no attach heard since the mod loaded; band asked 1 time, last answer: the row of text',
    '  desktop   not in the roster now; no attach heard since the mod loaded; band asked 3 times, last answer: nothing',
  ])
  await ask('terminal')
  expect((await cardOf($, 'where')).split('\n')[1]).toMatch(/band asked 3 times, last answer: the terminal drawing$/)
  expect(Object.keys(k.disk).some(key => /where|asked|attach/.test(key))).toBe(false) // in memory only
})

// The pet moved to another computer (/pet export, /pet import): the "disk" of the files Node or the mod writes, and of the one read back
function moving(on: any, k: ReturnType<typeof home>) {
  const m = { files: k.files, ran: [] as string[][], kinds: {} as Record<string, string>, fileReads: k.reads }
  k.env.PATH = '/usr/bin'
  on('fs.stat', (_: any, e: any) => {
    if (e.path === '/usr/bin/node' || e.path === '/bin/chmod') return { value: { kind: 'file', size: 1, mtimeMs: 0, isLink: false } }
    if (m.files[e.path] === undefined && !m.kinds[e.path]) throw new Error('ENOENT')
    return { value: { kind: m.kinds[e.path] ?? 'file', size: m.files[e.path]?.length ?? 0, mtimeMs: 0, isLink: false } }
  })
  on('process.run', (_: any, e: any) => { m.ran.push(e.argv); if (e.init?.stdin !== undefined) m.files[e.argv[2]] = e.init.stdin; return { value: { exitCode: 0, stdout: '', stderr: '' } } as any })
  return m
}
const MOVED = { species: 'penguin', born: 'fox', seed: 7, name: 'Miro', stats: [20, 50, 40, 90, 70], asked: true, personality: 'A quiet one.', hatched: 1_700_000_000_000, cuddles: 41, cuddled: EARLY - 5000, wear: 'sombrero', lang: 'en', style: true, callme: 'Ana', model: 'claude-haiku-5-5', voice: false, chats: true, hidden: false }
const MOVED_PET = { variant: null, coins: 123, affection: 456, days: 9, day: dayOf(EARLY), lately: [dayOf(EARLY)], born: EARLY - 3 * 86_400_000, owned: ['eggshell', 'sombrero'], animals: ['penguin'] }
const MOVE_DAY = dated(EARLY)

test('/pet export then /pet import on an empty store gives the same pet: the file is the person\'s alone, holds no chat mark and no spoken line, and the import asks first and saves the pet that was there', async ($, on) => {
  const k = home(on, {}, MOVED), m = moving(on, k)
  k.disk.pet = structuredClone(MOVED_PET)
  k.disk.diary = diaryOpened(diaryOf(undefined), { now: EARLY - 86_400_000, folder: 'hatchling', born: false })
  k.disk['chat.other'] = { cwd: '/w/secretproj', at: EARLY - 1000, done: true }
  k.disk.voice = { day: dayOf(EARLY), today: 3, lines: 9, input: 5000, output: 400, last: ['a secret spoken line'] }
  await $.session.start({ ...START, cwd: '/w/secretproj' })
  const file = `/home/me/.claude/hatchling-share/hatchling-miro-${MOVE_DAY}.json`
  expect(await cardOf($, 'export')).toBe(`Saved Miro to a file, to take to another computer: ${file}\nCopy it there and run /pet import <path>. It holds the pet, your choices and the diary, and the diary carries folder names: look at it before you send it to anyone.`)
  // Node writes it, with the mode 0600 (engine/move-save.js): the mod itself writes nothing
  expect(m.ran).toEqual([['/usr/bin/node', expect.stringMatching(/\/engine\/move-save\.js$/), file]])
  expect(k.writes).toEqual([])
  const text = m.files[file]!, out = JSON.parse(text)
  expect(Object.keys(out)).toEqual(['hatchling', 'format', 'exported', 'pet', 'prefs', 'diary', 'routine'])
  expect([out.hatchling, out.format]).toEqual(['pet', 1])
  expect(out.pet).toMatchObject(MOVED_PET)
  expect(out.prefs).toMatchObject({ ...MOVED, voiceAsked: true })
  expect(Object.keys(out.prefs).sort()).toEqual(KNOWN.filter(key => key !== 'missing'))
  expect(out.diary).toEqual(k.disk.diary)
  expect(Object.keys(out.diary.folders)).toEqual(['hatchling', 'secretproj']) // the diary carries folder names, as the line printed says: names, never a path
  // not in the file: the marks of the chats (full paths, times of turns), the pet's last lines, the day's count of comments, the session
  expect(text).not.toMatch(/\/w\/|spoken|chat\.|"cwd"|"last"|"today":3|session|issues|"missing"/)

  // another computer: an empty store, where a pet of its own hatches, with a chat mark of its own
  for (const key of Object.keys(k.disk)) delete k.disk[key]
  k.disk['chat.there'] = { cwd: '/w/elsewhere', at: EARLY - 2000, done: true }
  k.disk.voice = { day: dayOf(EARLY), today: 1, lines: 1, input: 600, output: 70, last: ['a line of this machine'] }
  k.state = {}
  await $.session.start({ ...START, cwd: '/w/elsewhere' })
  await k.clock.advance(9_000)
  const local = prefsOf(k.disk).name as string
  expect(local).not.toBe('Miro')
  m.files['/home/me/my pets/miro.json'] = text
  m.ran.length = 0
  // the first call only tells: the pet of the file, the pet here that it would replace, and how to say yes
  const kept = () => JSON.stringify({ ...k.disk, routine: undefined }) // the routine notes that the person was here, as with any command: nothing else may change
  const before = kept(), asked = await cardOf($, 'import ~/my pets/miro.json')
  expect(asked.split('\n')).toEqual([
    `In the file: Miro, Hatchling the penguin, adult, 123 stars, affection 456 over 9 days of use. Saved on ${MOVE_DAY}.`,
    expect.stringMatching(new RegExp(`^Here now: ${local}, Hatchling the \\w+, baby, \\d+ stars?, affection \\d+ over \\d+ days? of use\\. It would be replaced, after a copy of it is saved\\.$`)),
    'To do it: /pet import ~/my pets/miro.json yes',
  ])
  expect([kept(), m.ran, k.writes]).toEqual([before, [], []])
  // with yes: the pet here is saved first, and its path said; then the pet of the file is the pet
  const done = await cardOf($, 'import ~/my pets/miro.json yes')
  const backup = m.ran[0]![2]!
  expect(backup).toMatch(new RegExp(`^/home/me/\\.claude/hatchling-share/hatchling-[\\p{L}\\p{N}-]+-${MOVE_DAY}-backup-\\d{6}\\.json$`, 'u'))
  expect(done).toBe(`Miro moved in. The marks of this computer's chats stay.\nThe pet that was here is saved: ${backup}`)
  expect(JSON.parse(m.files[backup]!).prefs.name).toBe(local)
  expect(m.ran.length).toBe(1)
  // the same pet: what the file held, to the last field
  expect(k.disk.pet).toEqual(out.pet)
  expect(prefsOf(k.disk)).toMatchObject({ ...out.prefs, missing: '' })
  expect(k.disk.diary).toEqual(out.diary)
  expect(await cardOf($)).toMatch(/^Miro, Hatchling the penguin, adult/)
  expect(await cardOf($)).toMatch(/\n  wears head: a sombrero\n/)
  // what is this computer's own stays: the marks of its chats, the lines the pet said here and the day's count
  expect(k.disk['chat.there']).toEqual({ cwd: '/w/elsewhere', at: EARLY - 2000, done: true })
  expect(k.disk.voice).toMatchObject({ today: 1, last: ['a line of this machine'] })
  expect(Object.keys(k.disk).filter(key => !/^(pet|diary|work|voice|routine|pref\.\w+|chat\.\w+)$/.test(key))).toEqual([])
  // and exported again from here it is the same file, but for the moment it was written
  await cardOf($, 'export')
  const again = JSON.parse(m.files[file]!)
  expect({ ...again, exported: 0, routine: 0 }).toEqual({ ...out, exported: 0, routine: 0 })
  expect([again.routine.off, Object.keys(again.routine.days)]).toEqual([out.routine.off, Object.keys(out.routine.days)]) // the routine moved in with it; its day lasts until now, the commands since counted
})

test('/pet import over a newborn whose question about the comments is up: the choice that moves in stands, and the question goes at once', async ($, on) => {
  const k = home(on, {}, MOVED), m = moving(on, k)
  k.disk.pet = structuredClone(MOVED_PET)
  await $.session.start(START)
  await cardOf($, 'export')
  const text = Object.values(m.files)[0]!
  expect(JSON.parse(text).prefs.voiceAsked).toBe(true)
  for (const key of Object.keys(k.disk)) delete k.disk[key] // another computer: a pet hatches there, and asks
  k.state = {}
  await $.session.start(START)
  await k.clock.advance(29_500) // hatched, and it said who it is
  let ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.findAll({ type: 'Button' })).map(x => x.text)).toEqual(['pet', 'comments on', 'stay quiet'])
  await ui.unmount()
  m.files['/t/miro.json'] = text
  expect(await cardOf($, 'import /t/miro.json yes')).toMatch(/^Miro moved in\./)
  ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect((await ui.findAll({ type: 'Text' })).map(x => x.text).join(' ')).not.toMatch(/May I comment/)
  expect((await ui.findAll({ type: 'Button' })).map(x => x.text)).not.toContain('comments on')
  await ui.unmount()
  expect(prefsOf(k.disk)).toMatchObject({ voice: false, voiceAsked: true })
})

test('/pet import: the founder\'s eggshell follows the birth of the pet that moves in, as it does for any pet', async ($, on) => {
  const k = home(on, {}, MOVED), m = moving(on, k)
  k.disk.pet = structuredClone(MOVED_PET)
  await $.session.start(START)
  await cardOf($, 'export')
  const out = JSON.parse(Object.values(m.files)[0]!)
  // born in time, and the file says no eggshell: it has it once here, and wears it on a head with nothing on
  m.files['/t/early.json'] = JSON.stringify({ ...out, pet: { ...out.pet, owned: [] }, prefs: { ...out.prefs, name: 'Early', wear: '' } })
  expect(await cardOf($, 'import /t/early.json yes')).toMatch(/^Early moved in\./)
  expect(k.disk.pet).toMatchObject({ owned: ['eggshell'], born: MOVED_PET.born })
  expect(await cardOf($)).toMatch(/\n  wears head: half an eggshell\n/)
  // born after the founders' date: none
  m.files['/t/late.json'] = JSON.stringify({ ...out, pet: { ...out.pet, born: AFTER, owned: ['sombrero'] }, prefs: { ...out.prefs, name: 'Late' } })
  expect(await cardOf($, 'import /t/late.json yes')).toMatch(/^Late moved in\./)
  expect(k.disk.pet).toMatchObject({ owned: ['sombrero'], born: AFTER })
  expect(await cardOf($, 'shop')).toMatch(/\n  eggshell +half an eggshell +–  head +founders only\n/)
})

test('/pet import of a hostile file: said in one line, and nothing is read further, written or changed', async ($, on) => {
  const k = home(on, {}, MOVED), m = moving(on, k)
  k.disk.pet = structuredClone(MOVED_PET)
  await $.session.start(START)
  await cardOf($, 'export')
  const good = Object.values(m.files)[0]!, out = JSON.parse(good)
  m.ran.length = 0
  const before = JSON.stringify(k.disk)
  const refused = async (path: string, why: RegExp, yes = ' yes') => {
    const said = await cardOf($, `import ${path}${yes}`)
    expect(said.split('\n').length).toBe(1)
    expect(said).toMatch(why)
    expect(said).not.toMatch(/\u001b/)
    expect([JSON.stringify(k.disk), m.ran, k.writes]).toEqual([before, [], []])
  }
  const bad = (name: string, change: (o: any) => void) => { const o = structuredClone(out); change(o); m.files[`/t/${name}.json`] = JSON.stringify(o); return `/t/${name}.json` }
  expect(await cardOf($, 'import')).toBe('Name the file: /pet import <path>. /pet export on the other computer makes it.')
  await refused('/t/none.json', /^Nothing imported from \/t\/none\.json: file: there is no such file$/)
  m.kinds['/t/folder'] = 'dir'
  await refused('/t/folder', /: file: not a regular file$/)
  // a huge file is not even read
  m.files['/t/huge.json'] = `{"hatchling":"pet","pad":"${'x'.repeat(300 * 1024)}"}`
  await refused('/t/huge.json', /: file: larger than 256 KiB$/)
  expect(m.fileReads).not.toContain('/t/huge.json')
  m.files['/t/broken.json'] = good.slice(0, 200)
  await refused('/t/broken.json', /: file: not JSON \(/)
  await refused(bad('escape', o => { o.prefs.name = 'Mi\u001b[31mro\u001b]0;x\u0007' }), /: file\.prefs\.name: must be a text/)
  await refused(bad('escape2', o => { o.diary.folders = { 'a\u001b[2Jb': 3 } }), /a field's name/)
  await refused(bad('type', o => { o.pet.coins = '999999' }), /: pet\.coins: missing, unknown, not of the right kind, or out of range$/)
  await refused(bad('type2', o => { o.prefs.style = 'yes' }), /: prefs\.style: not of the right kind, or out of range$/)
  await refused(bad('item', o => { o.pet.owned = ['eggshell', 'jetpack'] }), /: pet\.owned: "jetpack" is not an item or a coat known here$/)
  await refused(bad('animal', o => { o.prefs.species = 'unicorn' }), /: prefs\.species: the animal "unicorn" is not known here: if it comes from a skin pack, install the pack first$/)
  await refused(bad('coat', o => { o.prefs.wear = 'sombrero mint' }), /: prefs\.wear: "mint" is not a thing or a coat known here/)
  await refused(bad('newer', o => { o.format = 2 }), /: format: the file was made by a newer Hatchling \(format 2, this one reads 1\): update Hatchling here, then import it$/)
  // path tricks: a name that would be a path, a field that names a file, a key nobody knows
  await refused(bad('path', o => { o.prefs.name = '../../../etc/cron.d/x' }), /: prefs\.name: not of the right kind, or out of range$/)
  await refused(bad('path2', o => { o.prefs.callme = '/etc/passwd' }), /: prefs\.callme: /)
  await refused(bad('path3', o => { o.file = '/etc/passwd'; o.backup = '~/.ssh/authorized_keys' }), /: file: unknown field "file"$/)
  await refused(bad('path4', o => { o.prefs.dir = '/tmp' }), /: prefs: unknown field "dir"$/)
  // refused the same without yes: a file is judged before anything is asked
  await refused(bad('ask', o => { o.pet.days = -1 }), /: pet\.days: /, '')
  expect(await cardOf($)).toMatch(/^Miro, Hatchling the penguin/)
  // the only paths the mod opened are the ones the person named
  expect(m.fileReads.every(p => p.startsWith('/t/'))).toBe(true)
})

test('/pet export with no Node: the mod writes the file and chmod closes it, or it says the file is open; with no copy of the pet here, nothing is imported', async ($, on) => {
  const k = home(on, {}, MOVED), m = moving(on, k)
  k.disk.pet = structuredClone(MOVED_PET)
  await $.session.start(START)
  await cardOf($, 'export')
  const good = Object.values(m.files)[0]!
  m.files['/t/miro.json'] = good.replace('"Miro"', '"Nube"')
  k.env.PATH = '/opt/empty' // neither node nor chmod
  m.ran.length = 0
  const file = `/home/me/.claude/hatchling-share/hatchling-miro-${MOVE_DAY}.json`
  expect((await cardOf($, 'export')).split('\n')).toEqual([expect.stringMatching(/^Saved Miro to a file/), 'The file could not be closed to the other users of this computer (mode 0600): they may read it.', expect.stringMatching(/^Copy it there/)])
  expect([m.ran, k.writes]).toEqual([[], [file]])
  // chmod found on the PATH: run by its absolute path on the file, and no warning
  k.env.PATH = '/bin'
  expect((await cardOf($, 'export')).split('\n').length).toBe(2)
  expect(m.ran).toEqual([['/bin/chmod', '600', file]])
  // the folder cannot be written: said; and an import stops before it changes anything
  k.env.PATH = '/opt/empty';
  (k as any).sealed = true
  const before = JSON.stringify(k.disk)
  expect(await cardOf($, 'export')).toBe('The pet could not be saved to a file: the store could not be read, or the folder hatchling-share in your Claude Code config folder could not be written.')
  expect(await cardOf($, 'import /t/miro.json yes')).toBe('Nothing imported: the pet that is here could not be saved to a file first.')
  expect(JSON.stringify(k.disk)).toBe(before)
  // the language of the fixed text is the pet's
  await cardOf($, 'lang es')
  expect(await cardOf($, 'import')).toBe('Indica el archivo: /pet import <ruta>. Lo crea /pet export en el otro ordenador.')
  expect(await cardOf($, 'import /t/miro.json')).toMatch(/^En el archivo: Nube, Hatchling: pingüino, adulto, 123 estrellas, .*\nAquí ahora: Miro, .*\nPara hacerlo: \/pet import \/t\/miro\.json yes$/)
})


// The three things that make the pet useful, all at zero tokens: the work diary, the reminders, the watcher of the other chats
test('the work diary: the first greeting of a day says yesterday in one line, once; /pet diary reports the days from counts and folder names', async ($, on) => {
  const k = voiceKit($, on, { voice: true })
  // yesterday, as the mod wrote it then: one chat in vodmax, a turn that changed two files; and another chat left mid-turn there
  const T0 = k.clock.now()
  k.disk.work = workTurned(workOpened(workOf(undefined), { now: T0 - DAY, folder: 'vodmax' }), { now: T0 - DAY, files: 2 })
  k.disk['chat.other'] = { cwd: '/home/me/secret-client/vodmax', at: T0 - DAY, done: false, beat: T0 - DAY }
  await $.session.start({ cwd: '/home/me/secret-client/gin', surface: 'terminal', isInteractive: true })
  expect((await bubbleOf($)).at(-1)).toBe('yesterday: 1 chat, 1 folder; one left mid-turn in vodmax')
  // a turn that changes a file twice and writes another: one turn, two files
  await k.turn(async () => { await $.tool.call({ tool: 'Edit', file_path: '/home/me/secret-client/gin/a.go' } as any); await $.tool.call({ tool: 'Write', file_path: '/home/me/secret-client/gin/b.go' } as any); await $.tool.call({ tool: 'Edit', file_path: '/home/me/secret-client/gin/a.go' } as any) })
  expect(await cardOf($, 'diary')).toMatch(/^WORK DIARY\ntoday: 1 chat, 1 folder, 1 turn, 2 files changed\n  folders: gin 1\nyesterday: 1 chat, 1 folder, 1 turn, 2 files changed\n  folders: vodmax 1\n  left mid-turn: vodmax\nCounts and folder names only/)
  expect(await cardOf($, 'diary week')).toMatch(/\nlast 7 days: 2 chats, 2 folders, 2 turns, 4 files changed\n/)
  expect((await cardOf($, 'diary yesterday')).split('\n').filter(l => /^\S+: /.test(l)).map(l => l.split(':')[0])).toEqual(['yesterday'])
  expect((await cardOf($, 'diary today')).split('\n').filter(l => /^\S+: /.test(l)).map(l => l.split(':')[0])).toEqual(['today'])
  // a second chat the same day: the line was said, and is not said again
  const calls = k.v.calls.length
  k.state = {}
  await $.session.start({ cwd: '/home/me/secret-client/gin', surface: 'terminal', isInteractive: true })
  expect((await bubbleOf($)).join(' | ')).not.toMatch(/yesterday/)
  expect(Object.values(k.disk.work.days).map((d: any) => d.chats)).toEqual([1, 2])
  expect(JSON.stringify(k.disk.work)).not.toMatch(/secret-client|home\/me|a\.go|plan/)
  expect(k.v.calls.length).toBe(calls) // no model was asked for the report or the line
})

test('reminders: kept in the store, capped and cleaned; shown in the bubble at a start and when a timed one falls due; never in a request to the comments model; the answers are the command\'s, lines of the chat like any other', async ($, on) => {
  const k = voiceKit($, on, { voice: true })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  // nothing is dropped at the prompt: /pet remind and /pet reminders are answered by the command, as /pet diary is
  const typed = async (args: string) => { expect((await $.prompt.submit({ text: `/pet ${args}`, command: { name: 'pet', args }, wait: false, origin: 'user' } as any) as any)?.drop).toBeUndefined(); return cardOf($, args) }
  expect(await cardOf($, 'reminders')).toBe('No reminders. /pet remind <text> keeps one.')
  expect(await typed('remind')).toMatch(/^\/pet remind <text> keeps a reminder/)
  expect(await typed('remind call \x1b[31mAna\x1b[0m\tback\u0007')).toBe('Reminder 1 kept: call Ana back') // cleaned of control and escape characters
  expect(await typed('remind in 1m check the build')).toBe('Reminder 2 kept, in 1 min: check the build')
  expect(await typed(`Remind ${'x'.repeat(500)}`)).toBe(`Reminder 3 kept: ${'x'.repeat(200)}`)
  expect(k.disk.reminders.map((r: any) => [r.text.length, typeof r.made, r.at === undefined])).toEqual([[13, 'number', true], [15, 'number', false], [200, 'number', true]])
  expect(await cardOf($, 'reminders')).toBe(`Your reminders\n  1. call Ana back\n  2. check the build  (in 1 min)\n  3. ${'x'.repeat(200)}\nKept on this machine: never sent to the comments model, not on /pet share, not in /pet export. Setting or listing them answers in this chat, as any command does, so its assistant can read that; the bubble is not a chat line. /pet remind done <n|all> removes.`)
  expect(await typed('remind done 3')).toBe(`Removed: ${'x'.repeat(200)}`)
  expect(await typed('remind done 7')).toBe('No reminder 7. /pet reminders lists them.')
  // a while after the chat opened the pet says the first one, with how many more; the timed one is not due yet
  await k.clock.advance(RULES.remindStartMs + 10_500)
  expect(await bubbleOf($)).toEqual(['remember: call Ana back', '/pet remind done 1 when it is done'])
  await k.clock.advance(RULES.remindShowMs + 1_000)
  expect((await bubbleOf($)).join(' ')).not.toMatch(/remember/)
  // the timed one falls due: said once, marked as said for every chat, and kept until done
  await k.turn() // the person is at this chat
  await k.clock.advance(k.disk.reminders[1].at - k.clock.now() + 10_500)
  expect(await bubbleOf($)).toEqual(['remember: check the build', '1 more: /pet reminders'])
  expect(k.disk.reminders.map((r: any) => r.told)).toEqual([undefined, true])
  await k.clock.advance(RULES.remindShowMs + 21_000)
  expect((await bubbleOf($)).join(' ')).not.toMatch(/remember/)
  expect(await cardOf($, 'reminders')).toMatch(/\n  2\. check the build  \(due\)\n/)
  // with the comments on, nothing of a reminder is in any request to the model; and the cap holds
  expect(k.v.calls.length).toBeGreaterThan(0)
  expect(JSON.stringify(k.v.calls)).not.toMatch(/Ana|check the build|remind/i)
  for (let i = 0; i < 25; i++) await typed(`remind n${i}`)
  expect(k.disk.reminders.length).toBe(20)
  expect(await typed('remind one more')).toBe('No room: 20 reminders at most. /pet remind done <n> removes one.')
  expect(await typed('remind done all')).toBe('Removed all the reminders: 20.')
  expect(k.disk.reminders).toEqual([])
  expect(await cardOf($, 'reminders')).toBe('No reminders. /pet remind <text> keeps one.') // run by another mod, the command answers the same
  // a store that cannot be written: said, not thrown, and nothing is shown as kept
  ;(k as any).ro = true
  expect(await typed('remind x')).toBe('The reminders could not be read or kept: the store cannot be used now.')
})

test('reminders: a timed one that falls due while the question about the comments is up is said over it, and the question is back after', async ($, on) => {
  const k = voiceKit($, on, { voice: false })
  forget(k.disk) // a newborn: it hatches, then asks
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await k.clock.advance(29_500) // hatched, and it said who it is
  const buttons = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const b = (await ui.findAll({ type: 'Button' })).map((x: any) => x.text); await ui.unmount(); return b }
  expect(await buttons()).toEqual(['pet', 'comments on', 'stay quiet'])
  expect(await cardOf($, 'remind in 1m check the build')).toBe('Reminder 1 kept, in 1 min: check the build')
  expect(await buttons()).toEqual(['pet', 'comments on', 'stay quiet']) // a command is no answer: the question waits
  await k.clock.advance(70_000)
  expect(await bubbleOf($)).toEqual(['remember: check the build', '/pet remind done 1 when it is done'])
  expect(k.disk.reminders[0].told).toBe(true)
  await k.clock.advance(RULES.remindShowMs + 1_000)
  expect((await bubbleOf($)).join(' ')).toMatch(/May I comment on your work\?/)
  expect(await buttons()).toEqual(['pet', 'comments on', 'stay quiet'])
})

test('reminders: back after a pause the pet says them again at the next prompt; none under the bench band, and none while the band is hidden', async ($, on) => {
  const k = voiceKit($, on, { voice: false })
  k.disk.reminders = [{ text: 'call Ana back', made: 5 }, { text: 'later', made: 6, at: k.clock.now() + 9e9 }]
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await k.clock.advance(RULES.remindStartMs + 10_500)
  expect(await bubbleOf($)).toEqual(['remember: call Ana back', '/pet remind done 1 when it is done']) // the one not due yet is not counted
  await k.turn()
  await k.clock.advance(RULES.recapAfterMs + 60_000)
  expect((await bubbleOf($)).join(' ')).not.toMatch(/remember/)
  await k.turn()
  await k.clock.advance(10_500)
  expect((await bubbleOf($))[0]).toBe('remember: call Ana back')
  expect(k.disk.reminders.length).toBe(2) // shown, it stays until done
  expect(k.v.calls).toEqual([])
})

test('the watcher: after /clear the old id of this chat is not another chat that waits, and a mark whose session left the live list is not counted', async ($, on) => {
  const k = voiceKit($, on, { voice: false })
  k.env.PATH = '/usr/bin'
  const row = (sessionId: string, cwd: string, status: string) => ({ pid: 1, cwd, kind: 'interactive', startedAt: 5, sessionId, name: `${cwd.split('/').pop()}-5a`, status })
  let sessions: object[] = [row('me', '/w/here', 'busy')]
  on('process.run', () => ({ value: { exitCode: 0, stdout: JSON.stringify(sessions), stderr: '' } }) as any)
  const head = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const t = (await ui.findAll({ type: 'Text' })).map((x: any) => String(x.text)); await ui.unmount(); return t.find(x => x.includes('★')) ?? '' }
  const others = async () => (await cardOf($, 'chats')).split('\n').slice(1, -1).filter(l => !/this chat/.test(l)).map(l => l.trim())
  await $.session.start({ cwd: '/w/here', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: 'go', wait: false, origin: 'user' } as any)
  await k.clock.advance(10_500); await k.settle() // a look sees this chat at work
  await k.turn()
  sessions = [row('me', '/w/here', 'idle')]
  await k.clock.advance(40_000); await k.settle() // and the next one sees its turn ended
  expect(k.disk.agents.rows[0]).toMatchObject({ id: 'me', st: 'idle' })
  expect(k.disk.agents.rows[0].done).toBeGreaterThan(0)
  // /clear: the process goes on under a new id, and the list still holds the old one
  ;(k as any).id = 'me2'
  await $.session.end({ reason: 'clear', sessionId: 'me', resume: { id: 'me' } } as any)
  expect(k.disk['chat.me'].closed).toBe(true)
  for (const wait of [1_000, 40_000, 40_000]) { // with the look from before the /clear, and with later ones
    await k.clock.advance(wait); await k.settle()
    expect(await others()).toEqual(['No other chat is open.'])
    expect(await head()).not.toMatch(/wait/)
  }
  // another chat's mark still says it waits, but its session is not in the live list: not counted, not listed
  const now = k.clock.now()
  k.disk['chat.dead'] = { cwd: '/w/dead', at: now - 60_000, done: true, beat: now }
  k.disk['chat.live'] = { cwd: '/w/live', at: now - 60_000, done: true, beat: now }
  sessions = [row('me2', '/w/here', 'idle'), row('live', '/w/live', 'idle')]
  await k.clock.advance(40_000); await k.settle()
  k.disk['chat.dead'].beat = k.disk['chat.live'].beat = k.clock.now()
  await k.clock.advance(10_500); await k.settle()
  expect((await others()).map(l => l.replace(/, .*/, ''))).toEqual(['live  waiting for you'])
  expect(await head()).toMatch(/1 chat waits for you$/)
})

test('the watcher: claude agents --json adds the chats that run without Hatchling to the count, the list and the news; one toast for a permission, a notification only with /pet alerts on', async ($, on) => {
  const k = voiceKit($, on, { voice: false })
  k.env.PATH = '/usr/bin'
  const ran: any[] = [], notes: any[] = []
  let sessions: object[] = []
  const row = (sessionId: string, cwd: string, status: string, more: object = {}) => ({ pid: 1, cwd, kind: 'interactive', startedAt: 5, sessionId, name: `${cwd.split('/').pop()}-5a`, status, ...more }) // named by Claude Code, unless a test says the person named it
  let printed = () => JSON.stringify(sessions)
  on('process.run', (_: any, e: any) => { ran.push(e); return { value: { exitCode: 0, stdout: printed(), stderr: '' } } as any })
  on('ui.notify', (_: any, e: any) => { notes.push(e); return { value: { isSent: true, channel: 'terminal_bell' } } as any })
  const head = async () => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); const t = (await ui.findAll({ type: 'Text' })).map((x: any) => String(x.text)); await ui.unmount(); return t.find(x => x.includes('★')) ?? '' }
  sessions = [row('me', '/w/here', 'busy'), row('s1', '/home/me/work/vodmax', 'busy', { name: '\x1b[31mrelease\x07 notes\n' }), row('s2', '/home/me/work/notes', 'idle'), row('s3', '/home/me/secret-client/api', 'waiting', { waitingFor: 'approve Bash: rm -rf /srv --token=hunter2' })]
  await $.session.start({ cwd: '/w/here', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: 'go', wait: false, origin: 'user' } as any)
  await k.clock.advance(10_500); await k.settle()
  expect(ran.map(e => [e.argv, e.init?.timeoutMs])).toEqual([[['/usr/bin/claude', 'agents', '--json'], 5000]])
  await k.clock.advance(10_000); await k.settle()
  expect(await head()).toMatch(/^Miro  ★ \d+  ·  1 chat waits for you$/) // the one that waits for an OK; the idle one was never seen busy
  expect(k.toasts).toEqual(['Hatchling: the chat in api may be waiting for your OK'])
  expect(notes).toEqual([]) // alerts are off until asked for
  expect((await cardOf($, 'chats')).split('\n').slice(1, -1).map(l => l.trim().replace(/, .*/, '')).sort()).toEqual(['api            may be waiting for your OK', 'here           here', 'release notes  vodmax']) // the name the person gave, cleaned, then the folder
  // what is kept of the look: ids, folders, statuses, the one label, and a name only where the person gave one. Never the name Claude Code made, the command, or what it waits for
  expect(Object.keys(k.disk.agents.rows[3]).sort()).toEqual(['cwd', 'id', 'since', 'st', 'wait'])
  expect(Object.keys(k.disk.agents.rows[1]).sort()).toEqual(['cwd', 'id', 'name', 'since', 'st', 'wait'])
  expect(k.disk.agents.rows[1].name).toBe('release notes')
  expect(JSON.stringify(k.disk)).not.toMatch(/hunter2|rm -rf|approve|-5a/)
  expect(JSON.stringify({ ...k.disk, agents: 0 })).not.toMatch(/release/) // the name is under the key of the look and nowhere else
  // the same wait is told once; one look serves 30 seconds, whoever took it
  await k.clock.advance(60_000); await k.settle()
  expect(k.toasts.length).toBe(1)
  expect(ran.length).toBeLessThanOrEqual(4)
  expect(ran.length).toBeGreaterThanOrEqual(2)
  // /pet alerts on: the next chat that waits for an OK also raises a notification
  expect(await cardOf($, 'alerts')).toMatch(/^Alerts off/)
  expect(await cardOf($, 'alerts on')).toMatch(/^Alerts on/)
  expect(await cardOf($, 'alerts maybe')).toMatch(/alerts/)
  sessions = [...sessions.map((s: any) => s.sessionId === 's1' ? { ...s, status: 'idle' } : s), row('s4', '/home/me/work/gin', 'waiting', { waitingFor: 'approve plan', name: 'deploy' })] // and the one at work ends its turn
  await $.prompt.submit({ text: 'more', wait: false, origin: 'user' } as any)
  await k.clock.advance(70_000); await k.settle()
  expect(k.toasts.at(-1)).toBe('Hatchling: your chat “deploy” may be waiting for your OK')
  expect(notes.map(n => [n.text ?? n.message, n.options?.title ?? n.title])).toEqual([['Hatchling: your chat “deploy” may be waiting for your OK', 'Miro']])
  expect(await head()).toMatch(/·  3 chats wait for you$/) // two wait for an OK, and the one seen going from busy to idle
  expect(JSON.stringify({ ...k.disk, agents: 0 })).not.toMatch(/deploy|release/) // a name told in the bubble and the toast is still kept under the key of the look alone
  // the sessions go: after a new look nothing is counted
  sessions = [row('me', '/w/here', 'busy')]
  await k.clock.advance(45_000); await k.settle()
  expect(await head()).toMatch(/^Miro  ★ \d+$/)
  // hostile output: not JSON. The watcher stops for good, quietly, and the chat marks still count
  const before = ran.length
  printed = () => '{"not":"a list"'
  await k.clock.advance(120_000); await k.settle()
  expect(ran.length).toBe(before + 1)
  k.disk['chat.idle'] = { cwd: '/home/me/work/notes', at: k.clock.now(), done: true, beat: k.clock.now() }
  await k.clock.advance(10_500)
  expect(await head()).toMatch(/·  1 chat waits for you$/)
  expect(k.v.calls).toEqual([]) // not one token
})

test('the watcher runs nothing under the bench, without a person, with the board off, or when claude is not found; a command that fails is not tried again', async ($, on) => {
  const k = voiceKit($, on, { voice: false, chats: false })
  k.env.PATH = '/usr/bin'
  const ran: any[] = []
  let fails = false
  on('process.run', (_: any, e: any) => { ran.push(e.argv); if (fails) throw new Error('timeout'); return { value: { exitCode: 0, stdout: '[]', stderr: '' } } as any })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await k.clock.advance(65_000); await k.settle()
  expect(ran).toEqual([]) // /pet chats off: no look at the other chats at all
  await cardOf($, 'chats on')
  fails = true
  await k.clock.advance(125_000); await k.settle()
  expect(ran.length).toBe(1) // it failed: once, and never again in this chat
  expect(k.disk.agents).toBeUndefined()
  expect(k.toasts).toEqual([])
})

test('/pet chats titles: off by default and then nothing of a transcript is asked for; on, it says what is read, reads only the end of the other chats\' transcripts, and keeps the title in memory alone', async ($, on) => {
  const k = voiceKit($, on, { voice: false })
  k.env.PATH = '/usr/bin'
  const title = (t: string) => JSON.stringify({ type: 'ai-title', aiTitle: t, sessionId: 'x' })
  const SECRET = JSON.stringify({ type: 'user', message: { role: 'user', content: 'the secret plan of the client' } })
  const tails: Record<string, string> = { s1: `${SECRET}\n${title('Old title')}\n${SECRET}\n${title('\x1b[31mFix the login\x07 bug\n and ' + 'x'.repeat(80))}\n${SECRET}\n`, s2: title('Hidden by the name'), me: title('My own chat'), s3: `${SECRET}\n` }
  const ran: string[][] = []
  const row = (sessionId: string, cwd: string, status: string, more: object = {}) => ({ pid: 1, cwd, kind: 'interactive', startedAt: 5, sessionId, name: `${cwd.split('/').pop()}-5a`, status, ...more })
  const sessions = [row('me', '/w/here', 'busy'), row('s1', '/home/me/work/vodmax', 'busy'), row('s2', '/home/me/work/notes', 'busy', { name: 'release notes' }), row('s3', '/home/me/work/gin', 'busy'), row('s4', '/home/me/work/gone', 'busy')]
  on('process.run', (_: any, e: any) => {
    ran.push(e.argv)
    if (e.argv[1] === 'agents') return { value: { exitCode: 0, stdout: JSON.stringify(sessions), stderr: '' } } as any
    const id = String(e.argv.at(-1)).split('/').pop()!.replace('.jsonl', '')
    return { value: { exitCode: 0, stdout: tails[id] ?? '', stderr: '' } } as any
  })
  const stats: string[] = [], lists: string[] = []
  Object.assign(k, { stats, lists, missing: (path: string) => path.includes('s4.jsonl') })
  await $.session.start({ cwd: '/w/here', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: 'go', wait: false, origin: 'user' } as any)
  await k.clock.advance(21_000); await k.settle()
  const lines = async () => (await cardOf($, 'chats')).split('\n')
  const transcript = () => [...stats, ...lists, ...k.reads, ...ran.map(a => a.join(' '))].filter(x => /projects|\.jsonl|tail/.test(x))
  // off, as installed: the list has folders and the person's own names; not one stat, list, read or command about a transcript
  expect(k.disk.titles).toBeUndefined()
  let list = await lines()
  expect(list.slice(1, -1).map(l => l.trim().replace(/, (just now|\d+ \w+ ago).*$/, '').replace(/ {2,}/g, ' | ')).sort()).toEqual(['gin | working', 'gone | working', 'here | here', 'release notes | notes, working', 'vodmax | working'])
  expect(list.at(-1)).toMatch(/^Folder names, the names you gave your chats and times only/)
  expect(await cardOf($, 'chats titles')).toMatch(/^Titles are off: nothing of a transcript is read\./)
  expect(transcript()).toEqual([])
  // on: one plain notice of what is read
  expect(await cardOf($, 'chats titles maybe')).toMatch(/chats titles/)
  expect(await cardOf($, 'chats titles on')).toBe("Titles are on. What is read: the title line of your other chats' transcripts, nothing else, kept in memory only. /pet chats shows them; /pet chats titles off stops it.")
  expect(k.disk.titles).toBe(true)
  expect(transcript()).toEqual([]) // nothing is read until the list is asked for
  list = await lines()
  // the title, cleaned and cut to 48 columns, then the folder and the state; the person's name goes before a title; a chat with no title line, or no transcript, shows its folder
  const cut = `Fix the login bug and ${'x'.repeat(25)}…`
  expect(cut.length).toBe(48)
  expect(list.slice(1, -1).map(l => l.trim().replace(/, (just now|\d+ \w+ ago).*$/, '').replace(/ {2,}/g, ' | ')).sort()).toEqual([`${cut} | vodmax, working`, 'gin | working', 'gone | working', 'here | here', 'release notes | notes, working'])
  expect(list.at(-1)).toMatch(/^Titles are on: the title line of your other chats' transcripts is read, nothing else/)
  // what was asked: the end of the transcripts of the other chats without a name, by their ids, with a limit of time. Never this chat's, never the named one's, never a whole file
  const tailed = ran.filter(a => a[0] === '/usr/bin/tail')
  expect(tailed.map(a => a.slice(0, 3))).toEqual([['/usr/bin/tail', '-c', '262144'], ['/usr/bin/tail', '-c', '262144'], ['/usr/bin/tail', '-c', '4000000']])
  expect(tailed.map(a => a[3])).toEqual(['/home/me/.claude/projects/-home-me-work-vodmax/s1.jsonl', '/home/me/.claude/projects/-home-me-work-gin/s3.jsonl', '/home/me/.claude/projects/-home-me-work-gin/s3.jsonl'])
  expect(k.reads.filter(x => /projects|jsonl/.test(x))).toEqual([]) // never a whole file
  expect(lists.filter(x => /projects/.test(x))).toEqual(['/home/me/.claude/projects']) // once, for the transcript that is not where its folder says
  expect(transcript().filter(x => /me\.jsonl|s2\.jsonl/.test(x))).toEqual([])
  // memory only: nothing of a title in the store or the state, and no call to a model
  expect(JSON.stringify([k.disk, k.state])).not.toMatch(/login|Old title|Hidden by|My own|secret plan/)
  expect(k.v.calls).toEqual([])
  // asked again at once: what is remembered serves, and only the missing transcript is not looked for before a minute
  const work = () => transcript().filter(x => x !== '/usr/bin/tail').length // but for finding `tail` on the PATH
  const before = work()
  await lines()
  expect(work()).toBe(before)
  // off again: said, forgotten, and nothing more is asked
  expect(await cardOf($, 'chats titles off')).toMatch(/^Titles are off/)
  expect(k.disk.titles).toBe(false)
  list = await lines()
  expect(list.join('\n')).not.toMatch(/login/)
  expect(work()).toBe(before)
})

for (const [what, bench, isInteractive] of [['under the bench', '/tmp/bench', true], ['in a headless run', '', false]] as const) test(`the watcher ${what}: no command is run`, async ($, on) => {
  const k = voiceKit($, on, { voice: false })
  k.env.PATH = '/usr/bin'
  if (bench) k.env.HATCHLING_BENCH = bench
  const ran: any[] = []
  on('process.run', (_: any, e: any) => { ran.push(e.argv); return { value: { exitCode: 0, stdout: '[]', stderr: '' } } as any })
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive })
  await k.clock.advance(65_000); await k.settle()
  expect(ran).toEqual([])
  expect(k.disk.agents).toBeUndefined()
})

// The routine (engine/routine.js): the day's questions, the finish time, the welcome back. The hours are the machine's own, as the mod reads them.
const dayAt = (day: number, h: number, m = 0) => new Date(2026, 10, day, h, m).getTime() // Tuesday 17 November 2026 is day 17
function dayKit($: any, on: any, now: number, prefs: object = {}) {
  const k = home(on, {}, { species: 'fox', born: 'fox', seed: 7, name: 'Miro', stats: [91, 45, 12, 70, 38], asked: true, lang: 'en', ...prefs }, now)
  on('prompt.submit', (_: any, e: any) => ({ text: e.text }) as any)
  on('turn.complete', () => ({ text: '' }) as any)
  on('model.complete', () => { throw new Error('no model is asked for the routine') })
  const pass = async (ms: number) => { for (let left = ms; left > 0; left -= 5 * 60_000) await k.clock.advance(Math.min(left, 5 * 60_000)) } // in steps: one advance holds only so many ticks
  const to = (t: number) => pass(t - k.clock.now())
  const buttons = async (surface = 'terminal') => { const ui = await $.ui.mount({ ...BAND, surface }); const b = (await ui.findAll({ type: 'Button' })).map((x: any) => x.text as string); await ui.unmount(); return b }
  const press = async (key: string) => { const ui = await $.ui.mount({ ...BAND, surface: 'terminal' }); await ui.press({ key }); await ui.unmount() }
  const said = async () => (await bubbleOf($)).join(' | ')
  return Object.assign(k, { pass, to, buttons, press, said })
}
const oneOf = (key: string, fill: Record<string, string> = {}) => wordings('en', key).map(l => l.replace(/\{(\w+)\}/g, (all, name) => fill[name] ?? all))

test('the day\'s questions: the finish time ten minutes after the first use, never during a turn, answered by a button; then the coffee, answered by /pet no; each asked once', { timeoutMs: 60_000 }, async ($, on) => {
  const k = dayKit($, on, dayAt(17, 9))
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect(k.disk.routine).toMatchObject({ day: '2026-11-17', asked: 0, q: null, days: { '2026-11-17': { start: dayAt(17, 9) } } }) // who opens a chat is here: the day has started
  // a turn runs when its ten minutes are over: nothing is asked meanwhile
  await k.pass(60_000)
  await $.prompt.submit({ text: 'go', wait: false, origin: 'user' } as any)
  await k.to(dayAt(17, 9, 12))
  expect([/finish/.test(await k.said()), k.disk.routine.asked]).toEqual([false, 0])
  await $.turn.complete({ answer: '', reason: 'answer' } as any)
  await k.pass(11_000)
  expect(await k.said()).toBe('what time do you finish today?')
  expect(await k.buttons()).toEqual(['pet', '17:00', '18:00', '19:00', 'later'])
  expect(k.disk.routine).toMatchObject({ asked: 1, q: { kind: 'finish', opts: ['17', '18', '19', 'later'] } })
  // where there are no buttons the row says how to answer
  { const ui = await $.ui.mount({ ...BAND, surface: 'vscode' }); expect((await ui.findAll({ type: 'Text' })).map((x: any) => x.text).join(' ')).toMatch(/what time do you finish today\? Answer with \/pet answer <17\|18\|19\|later>\.$/); await ui.unmount() }
  // a prompt does not answer it nor send it away: it waits its 30 minutes
  await $.prompt.submit({ text: 'more', wait: false, origin: 'user' } as any)
  await $.turn.complete({ answer: '', reason: 'answer' } as any)
  expect(await k.said()).toBe('what time do you finish today?')
  expect(await cardOf($, 'answer maybe')).toBe('This question takes one of: 17, 18, 19, later.')
  await k.press('answer-18')
  expect(await k.said()).toBe('Until 18:00, then. I will say it 30 and 10 minutes before, and at the time. /pet until off drops it.') // what it says back, for a while
  expect(k.disk.routine).toMatchObject({ until: dayAt(17, 18), q: null, days: { '2026-11-17': { finish: dayAt(17, 18) } } })
  expect(await cardOf($, 'until')).toBe('Today you finish at 18:00. /pet until off drops it.')
  expect(await cardOf($, 'yes')).toBe('No question is open.')
  // the coffee: not right after, and once
  await k.pass(4 * 60_000)
  expect(await k.said()).not.toMatch(/coffee/)
  await k.pass(90_000)
  expect(await k.said()).toBe('had your coffee yet?')
  expect(await k.buttons()).toEqual(['pet', 'yes', 'no'])
  expect(await cardOf($, 'no')).toBe('Noted. I will remind you once, in a while.')
  expect(await k.said()).not.toMatch(/coffee/)
  expect(k.disk.routine).toMatchObject({ asked: 2, q: null, days: { '2026-11-17': { coffee: false } } })
  // several chats open: a question that is up here and was answered in another chat goes at the next look
  k.disk.routine = { ...k.disk.routine, done: k.disk.routine.done.filter((x: string) => x !== 'small'), asked: 1, qAt: 0, days: { '2026-11-17': { start: dayAt(17, 9), end: k.clock.now(), finish: dayAt(17, 18) } } }
  await k.pass(11_000)
  expect(await k.said()).toBe('had your coffee yet?')
  k.disk.routine = { ...k.disk.routine, q: null, days: { '2026-11-17': { ...k.disk.routine.days['2026-11-17'], coffee: true, coffeeAt: k.clock.now() } } } // /pet yes, typed there
  await k.pass(11_000)
  expect([/coffee/.test(await k.said()), await k.buttons()]).toEqual([false, ['skin', 'pet']])
  // nothing else is asked that day, and no model was asked for any of it (the kit's would throw)
  for (let i = 0; i < 4; i++) { await k.pass(20 * 60_000); await cardOf($, 'pet'); expect(k.disk.routine.asked).toBe(2) }
})

test('a question nobody answers goes after 30 minutes; /pet routine off stops the questions, shows what was learned, and clear forgets; nothing is asked without a person or under the bench', { timeoutMs: 60_000 }, async ($, on) => {
  const k = dayKit($, on, dayAt(17, 9))
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await k.pass(10 * 60_000 + 11_000)
  expect(await k.said()).toBe('what time do you finish today?')
  await k.pass(29 * 60_000)
  expect(await k.said()).toBe('what time do you finish today?')
  await k.pass(70_000)
  expect([/finish/.test(await k.said()), await k.buttons(), k.disk.routine.q]).toEqual([false, ['skin', 'pet'], null]) // gone, quietly
  expect(await cardOf($, 'answer 18')).toBe('No question is open.')
  // /pet until says the time all the same; and what was learned is shown
  expect(await cardOf($, 'until 18:30')).toBe('Until 18:30, then. I will say it 30 and 10 minutes before, and at the time. /pet until off drops it.')
  expect(await cardOf($, 'until 25')).toBe('A time on the 24-hour clock: /pet until 18:30, or /pet until off.')
  expect(await cardOf($, 'routine')).toBe([
    'What Miro has learned of your days (1 kept, 30 at most)',
    '  today: started at 09:00',
    '  today: you finish at 18:30',
    'Questions on: 1 of 3 asked today. /pet routine off stops them; /pet routine clear forgets everything.',
    'Kept on this machine: never sent to the comments model, not on the picture of /pet share. It is in the file of /pet export. This answer is a line of the chat.',
  ].join('\n'))
  expect(await cardOf($, 'until off')).toBe('No finish time today.')
  // off: the coffee question, due now, never comes
  expect(await cardOf($, 'routine off')).toMatch(/^Questions off: the pet asks nothing about your day\./)
  for (let i = 0; i < 3; i++) { await k.pass(10 * 60_000); await cardOf($, 'pet') }
  expect([k.disk.routine.asked, k.disk.routine.off, await k.buttons()]).toEqual([1, true, ['skin', 'pet']])
  expect(await cardOf($, 'routine')).toMatch(/\nQuestions off\. \/pet routine on brings them back/)
  expect(await cardOf($, 'routine on')).toBe('Questions on: at most 3 a day, one at a time.')
  expect(await cardOf($, 'routine clear')).toBe("Forgotten: the days, the usual times and today's answers.")
  expect([Object.keys(k.disk.routine.days), k.disk.routine.until]).toEqual([['2026-11-17'], 0]) // today begins again, from this command
  expect(await cardOf($, 'routine maybe')).toBe('/pet routine shows what was learned; /pet routine off, /pet routine on, /pet routine clear.')
})

test('no routine without a person at the prompt: nothing is kept and nothing is asked', { timeoutMs: 60_000 }, async ($, on) => {
  const k = dayKit($, on, dayAt(17, 9))
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: false })
  await $.prompt.submit({ text: 'go', wait: false, origin: 'user' } as any)
  await $.turn.complete({ answer: '', reason: 'answer' } as any)
  await k.pass(15 * 60_000)
  expect(k.disk.routine).toBeUndefined()
  expect(await k.buttons()).not.toContain('17:00')
})

test('no routine under the bench: the person\'s store is not touched and nothing is asked', { timeoutMs: 60_000 }, async ($, on) => {
  const k = dayKit($, on, dayAt(17, 9))
  k.env.HATCHLING_BENCH = '/out/run'
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await $.prompt.submit({ text: 'go', wait: false, origin: 'user' } as any)
  await $.turn.complete({ answer: '', reason: 'answer' } as any)
  await k.pass(15 * 60_000)
  expect(k.disk.routine).toBeUndefined()
})

test('after three answered days the usual time is proposed with yes and no; no brings the hours, the same question going on; in another language the words are its own', { timeoutMs: 60_000 }, async ($, on) => {
  const k = dayKit($, on, dayAt(17, 9), { lang: 'es' })
  k.disk.routine = { days: Object.fromEntries([14, 15, 16].map(d => [`2026-11-${d}`, { start: dayAt(d, 9), end: dayAt(d, 18, 5), finish: dayAt(d, 18, 30), coffee: true, coffeeAt: dayAt(d, 9, 20) }])) }
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await k.pass(10 * 60_000 + 11_000)
  expect(await k.said()).toBe('¿hoy a las 18:30, como siempre?')
  expect(await k.buttons()).toEqual(['acariciar', 'sí', 'no'])
  await k.press('answer-no')
  expect(await k.said()).toBe('¿a qué hora terminas hoy?')
  expect(await k.buttons()).toEqual(['acariciar', '17:00', '18:00', '19:00', 'más tarde'])
  expect(k.disk.routine.asked).toBe(1)
  expect(await cardOf($, 'answer later')).toBe('Más tarde, entonces. /pet until 20:30 cuando lo sepas.')
  expect(k.disk.routine.until).toBe(0)
  expect(await cardOf($, 'routine')).toMatch(/^Lo que Miro ha aprendido de tus días \(4 guardados, 30 como máximo\)\n  inicio habitual: 09:00\n  fin habitual: 18:30\n  café: normalmente sí\n  hoy: empezaste a las 09:00\n/)
})

test('the finish time is warned about 30 and 10 minutes before and at the time: in the band of every open chat, with one toast for all of them', { timeoutMs: 60_000 }, async ($, on) => {
  const k = dayKit($, on, dayAt(17, 17))
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  expect(await cardOf($, 'until 18')).toMatch(/^Until 18:00, then\./)
  await k.to(dayAt(17, 17, 29))
  expect([/18:00/.test(await k.said()), k.toasts]).toEqual([false, []])
  await k.to(dayAt(17, 17, 30) + 11_000)
  expect(oneOf('until.w30', { time: '18:00', min: '30' })).toContain(await k.said())
  expect([k.toasts.length, oneOf('until.w30', { time: '18:00', min: '30' }).includes(k.toasts[0]!), k.disk.routine.done.includes('w30')]).toEqual([1, true, true])
  await k.pass(RULES.warnShowMs + 1_000)
  expect(await k.said()).not.toMatch(/18:00/) // for a minute, then it goes
  // ten minutes before, another chat saw it first and marked it: this band shows it too, and makes no second toast
  await k.to(dayAt(17, 17, 49))
  k.disk.routine = { ...k.disk.routine, done: [...k.disk.routine.done, 'w10'] }
  await k.to(dayAt(17, 17, 50) + 11_000)
  expect(oneOf('until.w10', { time: '18:00', min: '10' })).toContain(await k.said())
  expect(k.toasts.length).toBe(1)
  // at the time
  await k.to(dayAt(17, 18) + 11_000)
  expect(oneOf('until.w0', { time: '18:00' })).toContain(await k.said())
  expect(k.toasts.length).toBe(2)
  await k.to(dayAt(17, 18, 20))
  expect([/18:00/.test(await k.said()), k.toasts.length]).toEqual([false, 2]) // each once
})

test('the welcome back: after an hour with nothing done the line is in the bubble and stays until the person does something; done in another chat, it goes; then the coffee reminder is said', { timeoutMs: 60_000 }, async ($, on) => {
  const k = dayKit($, on, dayAt(17, 9))
  k.disk.routine = { day: '2026-11-17', done: ['finish', 'small'], days: { '2026-11-17': { start: dayAt(17, 8), end: dayAt(17, 8, 59), coffee: false, coffeeAt: dayAt(17, 8, 30) } } } // asked and answered already: no coffee yet
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await k.to(dayAt(17, 9, 59))
  expect(wordings('en', 'back.hour')).not.toContain(await k.said())
  await k.to(dayAt(17, 10) + 11_000)
  expect(wordings('en', 'back.hour')).toContain(await k.said()) // an hour: it is there for when they sit down
  await k.to(dayAt(17, 10, 40))
  expect(wordings('en', 'back.hour')).toContain(await k.said()) // and stays, asleep or not; the coffee reminder, due since 10:30, waits for the person
  expect(k.disk.routine.done).not.toContain('again')
  await k.to(dayAt(17, 12, 30))
  expect(wordings('en', 'back.long')).toContain(await k.said()) // worded as of now: three hours and more
  // the person presses a button: the welcome goes, and now the reminder about the coffee is said
  await k.press('pet')
  expect([...wordings('en', 'back.long'), ...wordings('en', 'back.hour')]).not.toContain(await k.said())
  await k.pass(RULES.cuddleShowMs + 11_000)
  expect(wordings('en', 'cup.no')).toContain(await k.said())
  expect(k.disk.routine.done).toContain('again')
  await k.pass(RULES.remindShowMs + 60_000)
  expect(wordings('en', 'cup.no')).not.toContain(await k.said()) // once
  // away again; back in another chat: this one's welcome goes
  await k.to(dayAt(17, 14))
  const lunch = await k.said()
  expect(wordings('en', 'back.lunch')).toContain(lunch) // left at half past twelve, back at two
  k.disk.routine = { ...k.disk.routine, seen: k.clock.now() }
  await k.pass(11_000)
  expect(await k.said()).not.toBe(lunch)
})

test('back after a pause with the comments on: the recap comes first and the welcome is the line under it, both kept until the person does something; then the reminder that fell due is said', { timeoutMs: 60_000 }, async ($, on) => {
  const k = recapKit($, on)
  await $.session.start({ cwd: '/w', surface: 'terminal', isInteractive: true })
  await cardOf($, 'routine off') // the day's questions are not this test's
  await cardOf($, 'remind in 70m call the plumber')
  await k.turn()
  k.v.reply = { isAnswered: true, text: LINE, usage: USAGE }
  for (let i = 0; i < 7; i++) { await k.clock.advance(5 * 60_000); await k.settle() }
  expect((await bubbleOf($)).join(' | ')).toBe(`35 min ago: ${LINE}`)
  for (let i = 0; i < 6; i++) { await k.clock.advance(5 * 60_000); await k.settle() }
  const both = await bubbleOf($)
  expect(both[0]).toBe(`65 min ago: ${LINE}`)
  expect(['hour', 'lunch', 'long', 'morning'].flatMap(kind => wordings('en', `back.${kind}`))).toContain(both[1]) // whichever the hour of the machine makes it
  expect(k.v.calls.every((c: any) => !/routine|finish|coffee/.test(JSON.stringify(c)))).toBe(true) // nothing of the routine goes to the model
  // the reminder fell due while the person was away: it waits for them, as ever, and the two lines stay
  await k.clock.advance(5 * 60_000 + 11_000)
  expect(await bubbleOf($)).toEqual([`70 min ago: ${LINE}`, both[1]])
  // the person is back and sends a prompt: the recap and the welcome had their time, and now the reminder is said. None was lost
  await k.turn()
  expect((await bubbleOf($)).join(' | ')).not.toContain(LINE)
  expect(await bubbleOf($)).not.toContain(both[1])
  await k.clock.advance(11_000)
  expect((await bubbleOf($)).join(' | ')).toMatch(/^remember: call the plumber/)
})

