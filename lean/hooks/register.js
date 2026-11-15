// @ts-check
// cachito-lean: the style in the system prompt, on as installed. No drawing, no pet; the store holds one key, and only after /lean off.
import { BENCH as SHOWN, STYLE, STYLE_ID } from '../style.js'

// Everything but the style's text and id lives inside `register`, and `$` is used where it is given: the function then stands alone,
// and the pet's tests load it as written beside the pet (hooks/register.test.ts at the root, the test of the two plugins together).
export function register(/** @type {import('claude-code').On} */ on) {
  const BENCH = `${SHOWN}. Every run: bench/RESULTS.md in the repository.`
  // switching re-sends the whole conversation once: in a long chat that costs more than the style saves for a long while,
  // so a switch waits for a moment when the cache is rebuilt anyway (a new chat, a compaction) or the chat is still small
  const SWITCH_UNDER = 30_000 // context tokens
  let ctxTokens = 0 // what the last request of the main thread was answered over
  let afterCompact = false
  /** @type {boolean | undefined} */ let live // what the system prompt carries now
  /** @type {import('claude-code').PromptComposeInput | undefined} */ let asked // the last prompt composed, to ask again what the other plugins add
  let probing = false // true while /lean off asks what the others add: this plugin then adds nothing
  /**
   * The choice: on unless /lean off was given; a store that cannot be read is no choice, so on. Under the bench (bench/run.mjs sets
   * CACHITO_BENCH) the person's own choice stays out.
   * @param {string | undefined} bench @param {unknown} off
   */
  const wanted = (bench, off) => !!bench || off !== true
  /** Whether the next request carries the style: the choice when a switch is cheap, else what it carries now. */
  const coming = (/** @type {boolean} */ want) => live === undefined || ctxTokens < SWITCH_UNDER || afterCompact ? want : live

  on('session.start', async ($, e, next) => {
    // where no command can be registered (a process with no session bound yet) the style still goes in: it needs no command
    await $.command.register({ name: 'lean', description: 'cachito-lean: /lean shows whether the style is in the system prompt, /lean off takes it out, /lean on puts it back' }).catch(() => {})
    return next(e)
  })

  on('prompt.compose', async ($, e, next) => {
    const r = await next(e)
    if (probing) return r
    asked = e
    live = coming(wanted(await $.env.get('CACHITO_BENCH').catch(() => undefined), await $.store.get('off').catch(() => undefined)))
    // with the pet installed too the section may be there already: an id is unique in the list, and the style goes in once
    return live && !r.sections.some(s => s.id === STYLE_ID) ? { sections: [...r.sections, { id: STYLE_ID, text: STYLE, scope: /** @type {const} */ ('session') }] } : r
  })

  on('turn.step', async function* (_, e, next) {
    const r = yield* next(e)
    const u = r?.usage
    if (u && /** @type {any} */ (e).agentId === undefined) { ctxTokens = u.input_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens; afterCompact = false }
    return r
  })

  on('session.compact', async (_, e, next) => {
    const r = await next(e)
    if (e.agentId === undefined && !r.skip) { ctxTokens = 0; afterCompact = true }
    return r
  })

  on('session.end', (_, e, next) => {
    if (e.reason === 'clear') { ctxTokens = 0; live = undefined } // the next chat sends everything again anyway
    return next(e)
  })

  on('command.run', { command: 'lean' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()
    if (arg && arg !== 'on' && arg !== 'off') return { text: '/lean shows the state, /lean on and /lean off switch the style.' }
    if (arg) await $.store.set('off', arg === 'off')
    const want = wanted(await $.env.get('CACHITO_BENCH').catch(() => undefined), await $.store.get('off').catch(() => undefined)), waits = coming(want) !== want
    const when = waits ? 'at the next compaction or in the next chat: this chat is already long, and switching now would re-send the whole conversation' : 'from your next prompt'
    if (want) return { text: `Lean on: the style is in the system prompt ${arg || waits ? when : 'of every request'}. /lean off takes it out. ${BENCH}\n\n${STYLE}` }
    // another plugin of this repository (the pet, with /pet lean on) may still send the same section
    let other = false
    if (asked) { probing = true; try { other = (await $.prompt.compose(asked)).sections.some(s => s.id === STYLE_ID) } catch {} finally { probing = false } }
    return { text: `Lean off: the style leaves the system prompt ${when}. /lean on puts it back.${other ? ' Another plugin still adds the same section: with the pet installed, /pet lean off.' : ''}` }
  })
}
