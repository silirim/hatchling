// Reads a bench folder and prints, per arm, what the CLI billed and the checks passed; then every pair of arms.
// Usage: node bench/report.mjs <out dir>
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { mean, permutation } from './stats.mjs'

const out = process.argv[2]
if (!out) { console.error('usage: node bench/report.mjs <out dir>'); process.exit(2) }
const manifest = JSON.parse(readFileSync(join(out, 'manifest.json'), 'utf8'))
const rows = readdirSync(out).filter(f => f.endsWith('.result.json')).map(f => JSON.parse(readFileSync(join(out, f), 'utf8')))
const arms = Object.keys(manifest.arms).filter(a => rows.some(r => r.arm === a))
const sd = (/** @type {number[]} */ xs) => xs.length < 2 ? 0 : Math.sqrt(xs.reduce((s, x) => s + (x - mean(xs)) ** 2, 0) / (xs.length - 1))

console.log(`${manifest.model}${manifest.effort ? ` at effort ${manifest.effort}` : ''}, ${manifest.task} at ${manifest.commit.slice(0, 7)} (${manifest.ref}), ${manifest.claude}, mod ${manifest.mod}, prompts ${manifest.prompts}, started ${manifest.started}`)
const usd = (/** @type {number} */ x) => `$${x.toFixed(3)}`
const tokens = (/** @type {any} */ r, /** @type {string} */ k) => Object.values(r.modelUsage ?? {}).reduce((s, m) => s + (m[k] ?? 0), 0)
/** @type {Record<string, number[]>} */ const stat = {}
/** @type {number | undefined} */ let base1
for (const arm of arms) {
  const mine = rows.filter(r => r.arm === arm).sort((x, y) => x.n - y.n), dirty = mine.filter(r => !r.isolated || !r.checks.answered)
  const good = mine.filter(r => !dirty.includes(r)), cost = good.map(r => r.cost)
  stat[arm] = cost
  const m = (/** @type {string} */ k) => Math.round(mean(good.map(r => tokens(r, k))) / 1000)
  const checks = Object.keys(good[0]?.checks ?? {}).map(k => `${k} ${good.filter(r => r.checks[k]).length}/${good.length}`).join(', ')
  console.log(`\n${arm}: ${good.length} runs${dirty.length ? ` (+${dirty.length} left out: not isolated or not finished: ${dirty.map(r => r.n)})` : ''}`)
  if (!good.length) continue
  console.log(`  cost ${cost.map(usd).join(' ')}  mean ${usd(mean(cost))} sd ${usd(sd(cost))}`)
  console.log(`  tokens (k, mean): cache write ${m('cacheCreationInputTokens')}, cache read ${m('cacheReadInputTokens')}, output ${m('outputTokens')}, input ${m('inputTokens')}; requests ${Math.round(mean(good.map(r => r.turns)))}; first prompt ${[...new Set(good.map(r => r.loaded.firstPrompt))].join('/')}`)
  console.log(`  ${checks}; commits ${good.map(r => r.commits ?? '?').join(' ')}`)
  // a task with hidden tests of its defects: how many each run fixed by them, and the mean
  if (good.some(r => r.of)) console.log(`  defects fixed of ${good[0].of}, by the hidden tests: ${good.map(r => r.fixed ?? '?').join(' ')}  mean ${mean(good.map(r => r.fixed ?? 0)).toFixed(2)}`)
  // an arm that instructs the model makes the first prompt larger: one no larger than the baseline's means the instructions were not there
  if (manifest.arms[arm].plugin && !(arm === 'observe' || arm === 'diet') /* `diet`: an arm of the past series */ && base1 !== undefined && mean(good.map(r => r.loaded.firstPrompt)) <= base1) console.log('  WARNING: the first prompt is no larger than the baseline: the instructions of this arm were not applied')
  base1 ??= mean(good.map(r => r.loaded.firstPrompt))
}
// every pair of arms, the first one against the rest first: with several arms, one p under 0.05 among many is weaker evidence than it looks
for (let i = 0; i < arms.length; i++) for (let j = i + 1; j < arms.length; j++) {
  const a = stat[arms[i] ?? ''] ?? [], b = stat[arms[j] ?? ''] ?? []
  if (a.length < 2 || b.length < 2) continue
  const d = mean(b) - mean(a), p = permutation(a, b)
  console.log(`${i === 0 && j === 1 || i === 1 && j === 2 ? '\n' : ''}${arms[j]} against ${arms[i]}: ${d < 0 ? '' : '+'}${usd(d).replace('$-', '-$')} (${(100 * d / mean(a)).toFixed(1)}%), permutation p = ${p.toFixed(4)} over ${a.length}+${b.length} runs: ${p < 0.05 ? 'a difference this large is unlikely by chance' : 'NOT shown: chance alone gives this often'}`)
}
