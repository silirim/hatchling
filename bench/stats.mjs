// The arithmetic the report and the chart share.
export const mean = (/** @type {number[]} */ xs) => xs.reduce((a, b) => a + b, 0) / xs.length

/**
 * Exact two-sided permutation test on the difference of means: the share of ways to split the runs in two groups that differ at least as much.
 * @param {number[]} a @param {number[]} b
 */
export function permutation(a, b) {
  const all = [...a, ...b], total = all.reduce((x, y) => x + y, 0), seen = Math.abs(mean(a) - mean(b)) - 1e-12
  let hits = 0, splits = 0
  const pick = (/** @type {number} */ from, /** @type {number} */ left, /** @type {number} */ sum) => {
    if (left === 0) { splits++; if (Math.abs(sum / a.length - (total - sum) / b.length) >= seen) hits++; return }
    for (let i = from; i <= all.length - left; i++) pick(i + 1, left - 1, sum + (all[i] ?? 0))
  }
  pick(0, a.length, 0)
  return hits / splits
}
// self-check: two groups that do not overlap, 3 against 3, are the most extreme 2 of the 20 splits
if (permutation([1, 2, 3], [7, 8, 9]) !== 0.1) throw new Error('permutation test is wrong')
