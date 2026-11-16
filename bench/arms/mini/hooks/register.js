// @ts-check
// A text arm of the bench (bench/run.mjs): one section in the system prompt, added as lean/hooks/register.js adds the style (appended
// last, scope `session`). This file is the same in every arm of bench/arms (bench/arms.test.mjs): the arms differ only in ../text.js.
import { ID, TEXT } from '../text.js'

export function register(/** @type {import('claude-code').On} */ on) {
  on('prompt.compose', async (_, e, next) => {
    const r = await next(e)
    return { sections: [...r.sections, { id: ID, text: TEXT, scope: /** @type {const} */ ('session') }] }
  })
}
