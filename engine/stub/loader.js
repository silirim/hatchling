// @ts-check
// Node loader hook: 'claude-code', the engine's own module, resolves to the stand-in next to this file.
/** @type {(name: string, context: unknown, next: (name: string, context: unknown) => unknown) => unknown} */
export const resolve = (name, context, next) => name === 'claude-code' ? { url: new URL('./claude-code.js', import.meta.url).href, shortCircuit: true } : next(name, context)
