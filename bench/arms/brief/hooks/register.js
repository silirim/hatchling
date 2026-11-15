// @ts-check
// The bench arm `brief` (bench/run.mjs): what "just write 'be brief'" does, measured. One section in the system prompt, added as
// lean/hooks/register.js adds the style (appended last, scope `session`), so the two arms differ only in the text.
export const BRIEF_ID = 'bench:brief'
export const BRIEF = 'Be brief.'

export function register(/** @type {import('claude-code').On} */ on) {
  on('prompt.compose', async (_, e, next) => {
    const r = await next(e)
    return { sections: [...r.sections, { id: BRIEF_ID, text: BRIEF, scope: /** @type {const} */ ('session') }] }
  })
}
