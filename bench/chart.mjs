// Draws assets/results.svg: the mean cost of a session per arm of one series, each run as a dot.
// Usage: node bench/chart.mjs [<out dir> <series number>]
// With the folder of a series and its number in bench/RESULTS.md, the figures are read from its run files and kept in bench/chart.json;
// without them, they are read from that file. Today's chart is Series 9: node bench/chart.mjs <out>/tour-mini 9
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mean, permutation } from './stats.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const kept = join(here, 'chart.json'), svgFile = join(here, '..', 'assets', 'results.svg')
const out = process.argv[2], series = Number(process.argv[3])
if (out && !Number.isInteger(series)) { console.error('usage: node bench/chart.mjs <out dir> <series number>'); process.exit(2) }
// how an arm is named on the chart: `brief` is the text briefox ships, `leanonly` the eight lines of the past series
const LABEL = /** @type {Record<string, string>} */ ({ clean: 'clean', brief: 'Be brief.', mini: 'brief + 3 lines', leanonly: 'eight lines' })
const OURS = 'brief'

/**
 * What the chart needs of a series, read as report.mjs reads it: the runs that were isolated and finished.
 * @param {string} dir
 */
function read(dir) {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'))
  const rows = readdirSync(dir).filter(f => f.endsWith('.result.json')).map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')))
  // a task that names its project says `owner/name at vX.Y.Z`; one that names none is on the bench's default project, known by its commit
  const [, project = /([^/:]+\/[^/]+?)(\.git)?$/.exec(manifest.task)?.[1], tag = manifest.commit.slice(0, 7)] = /(\S+\/\S+) at (v[\d.]+)/.exec(manifest.spec.about) ?? []
  if (!project) throw new Error('no project in the manifest')
  /** @type {Record<string, { label: string, cost: number[] }>} */ const arms = {}
  for (const arm of Object.keys(manifest.arms)) {
    const version = manifest.others?.[arm]?.version
    const cost = rows.filter(r => r.arm === arm && r.isolated && r.checks.answered).sort((x, y) => x.n - y.n).map(r => r.cost)
    if (cost.length) arms[arm] = { label: version ? `${arm} ${version}` : LABEL[arm] ?? arm, cost }
  }
  return { series, project, tag, model: manifest.model, started: manifest.started, runs: manifest.runs, arms }
}

if (out) writeFileSync(kept, JSON.stringify(read(out), null, 1) + '\n')
else if (!existsSync(kept)) { console.error('usage: node bench/chart.mjs <out dir> <series number>  (no bench/chart.json to read instead)'); process.exit(2) }
/** @type {ReturnType<typeof read>} */ const data = JSON.parse(readFileSync(kept, 'utf8'))

// the cover's colours
const NIGHT = '#1e1e2e', FLOOR = '#27273a', STAR = '#ffd54f', SAND = '#efe9dc'
const W = 880, PAD = 32, X0 = 196, X1 = 616, TOP = 104, ROW = 54, BAR = 24
const arms = Object.entries(data.arms), base = arms[0]?.[1].cost ?? []
const top = Math.ceil(Math.max(...arms.flatMap(([, a]) => a.cost)))  // the scale ends at the next whole dollar
const x = (/** @type {number} */ usd) => X0 + (X1 - X0) * usd / top  // bars start at zero
const H = TOP + arms.length * ROW + 92, axis = TOP + arms.length * ROW
const n = (/** @type {number} */ v) => v.toFixed(1)
const text = (/** @type {number} */ tx, /** @type {number} */ ty, /** @type {string} */ s, attrs = '') => `<text x="${n(tx)}" y="${n(ty)}"${attrs}>${s.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`
const quiet = ' fill-opacity=".7"'

const parts = []
for (let t = 0; t <= top; t++) {
  parts.push(`<line x1="${n(x(t))}" x2="${n(x(t))}" y1="${TOP - 8}" y2="${axis}" stroke="${SAND}" stroke-opacity="${t ? '.14' : '.5'}"/>`)
  parts.push(text(x(t), axis + 18, `$${t}`, ` text-anchor="middle" font-size="12"${quiet}`))
}
arms.forEach(([arm, a], i) => {
  const mid = TOP + i * ROW + ROW / 2, m = mean(a.cost), ours = arm === OURS, end = x(m)
  parts.push(text(X0 - 12, mid + 5, a.label, ` text-anchor="end" font-size="14"${ours ? ' font-weight="bold"' : ''}`))
  // flat at the baseline, rounded at the data end
  parts.push(`<path d="M${X0} ${mid - BAR / 2}H${n(end - 4)}a4 4 0 0 1 4 4V${mid + BAR / 2 - 4}a4 4 0 0 1 -4 4H${X0}Z" fill="${ours ? STAR : SAND}"${ours ? '' : ' fill-opacity=".42"'}/>`)
  // each run, spread over three lines so that close ones do not hide each other
  a.cost.forEach((c, k) => parts.push(`<circle cx="${n(x(c))}" cy="${mid + (k % 3 - 1) * 6}" r="3.5" fill="${NIGHT}" stroke="${SAND}" stroke-width="1.5"/>`))
  parts.push(text(X1 + 22, mid + 5, `$${m.toFixed(2)}`, ' font-size="14" font-weight="bold"'))
  if (i === 0) return parts.push(text(X1 + 82, mid + 5, 'no plugin', ` font-size="13"${quiet}`))
  const p = permutation(base, a.cost), shown = p < 0.05
  parts.push(text(X1 + 82, mid + (shown ? 5 : -2), `${(100 * (m - mean(base)) / mean(base)).toFixed(1).replace('-', '−')}%`, ' font-size="14"'))
  if (!shown) parts.push(text(X1 + 82, mid + 13, `may be chance (p ${p.toFixed(2)})`, ` font-size="11"${quiet}`))
})

const day = new Date(data.started).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const title = 'Mean cost of a whole coding session, by what is added to the prompt'
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d" font-family="ui-monospace, SFMono-Regular, Menlo, Consolas, 'Liberation Mono', monospace" fill="${SAND}">
<title id="t">${title}</title>
<desc id="d">${arms.map(([, a]) => `${a.label} $${mean(a.cost).toFixed(2)}`).join(', ')}. ${data.project} ${data.tag}, ${data.model}, ${data.runs} runs an arm.</desc>
<rect width="${W}" height="${H}" rx="8" fill="${NIGHT}"/>
<rect y="${H - 62}" width="${W}" height="62" fill="${FLOOR}"/><rect y="${H - 8}" width="${W}" height="8" rx="8" fill="${FLOOR}"/>
${text(PAD, 46, title, ' font-size="18" font-weight="bold"')}
${text(PAD, 70, `bar: mean of ${data.runs} sessions · dot: one session · beside: against ${arms[0]?.[1].label}`, ` font-size="13"${quiet}`)}
${parts.join('\n')}
${text(PAD, H - 36, `${data.project} ${data.tag} · ${data.model} · ${data.runs} runs an arm, ${day} · cost of whole sessions as billed`, ` font-size="12"${quiet}`)}
${text(PAD, H - 16, 'full method and data: bench/RESULTS.md', ` font-size="12"${quiet}`)}
</svg>
`
mkdirSync(dirname(svgFile), { recursive: true })
writeFileSync(svgFile, svg)
console.log(`${svgFile}: ${svg.length} bytes, series ${data.series} read from ${out ?? kept}`)
for (const [, a] of arms) console.log(`  ${a.label}: mean $${mean(a.cost).toFixed(3)} of ${a.cost.length} runs`)
