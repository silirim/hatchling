// @ts-check
// A stand-in for the engine's 'claude-code' module, for the one Node test that loads the two hooks modules together
// (engine/together.test.js): values kept in a map, as `$.state` keeps them for a session.
const held = new Map()
export const atom = (/** @type {unknown} */ ref, /** @type {unknown} */ initial) => ({ ref, initial })
export const read = async (/** @type {unknown} */ _$, /** @type {{ initial: unknown }} */ a) => held.has(a) ? held.get(a) : a.initial
export const update = async (/** @type {unknown} */ $, /** @type {{ initial: unknown }} */ a, /** @type {(v: unknown) => unknown} */ fn) => { held.set(a, fn(await read($, a))) }
