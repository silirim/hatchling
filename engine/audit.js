#!/usr/bin/env node
// @ts-check
// The receipt: where the money of your Claude Code sessions went, read from the local transcripts.
// Usage: node engine/audit.js [--days N] [folder]   (folder: ~/.claude/projects by default)
// Nothing is sent anywhere and no file is changed.

import { createReadStream, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { pathToFileURL } from 'node:url'
import { guessed, price, rates } from './prices.js'
import { tidy } from './width.js'

const UNKNOWN_PRICE = 4 // shortcut: a model missing from prices.js is priced like the mid tier and reported, add it there

export const emptyTotals = () => ({
  sessions: 0, requests: 0, contextTokens: 0, agents: 0, side: 0,
  output: 0, fresh: 0, write: 0, read: 0, // micro-dollars
  pauseShort: 0, pauseShortN: 0, pauseLong: 0, pauseLongN: 0, breakOther: 0, breakOtherN: 0,
  rereads: 0, rereadN: 0, loops: 0, loopN: 0,
  floor: 0, // the first prompt, re-read by every request
  /** @type {Record<string, true>} */ unknown: Object.create(null), // by the model's name, which comes from a file: no name is one an object already has
  /** @type {Record<string, true>} */ guessed: Object.create(null), // priced like their family: not on the price list
  /** @type {{ day: string, usd: number, context: number }[]} */ top: [],
})

// tokens of a tool result, estimated as characters / 4
const size = (/** @type {any} */ c) => Math.round((typeof c === 'string' ? c.length : Array.isArray(c) ? c.reduce((n, b) => n + (b.text?.length ?? 0), 0) : 0) / 4)

/**
 * Adds one transcript to the totals. The main thread and each subagent in it are separate chains:
 * each has its own context and its own cache.
 * @param {AsyncIterable<string> | Iterable<string>} lines
 * @param {ReturnType<typeof emptyTotals>} T
 * @param {number} [since] ignore requests before this time (ms)
 */
export async function addTranscript(lines, T, since = 0) {
  /** @type {Map<string, any>} */ const chains = new Map()
  const chain = (/** @type {string} */ k) => chains.get(k) ?? chains.set(k, {
    reqs: [], rd: [], epochs: [], items: [], rate: {}, ids: new Map(), out: {}, seen: new Set(), blind: {}, tool: {}, prev: 0, lastT: 0, fresh: true, epoch: 0,
  }).get(k)
  let usd = 0, context = 0, requests = 0, day = ''

  for await (const line of lines) {
    let ev; try { ev = JSON.parse(line) } catch { continue }
    if (!ev || typeof ev !== 'object' || Array.isArray(ev)) continue // a line that is JSON and no event (null, a number, a list)
    const c = chain(ev.isSidechain ? ev.agentId ?? 'side' : 'main')
    c.side = !!ev.isSidechain
    if ((ev.type === 'system' && ev.subtype === 'compact_boundary') || ev.isCompactSummary) { c.seen = new Set(); c.epoch++; c.fresh = true; continue }
    const content = ev.message?.content, u = ev.message?.usage
    if (ev.type === 'assistant' && u && ev.message.id) {
      const t = Date.parse(ev.timestamp)
      c.floor ||= (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0) // the chat's first prompt, even when it is before the period
      if (t < since) continue
      const model = tidy(String(ev.message.model ?? ''), 60) // shown in the receipt: a name from a file, cleaned
      if (!c.ids.has(ev.message.id)) {
        const cr = u.cache_read_input_tokens ?? 0, cw = u.cache_creation_input_tokens ?? 0, inp = u.input_tokens ?? 0, prompt = inp + cr + cw
        if (prompt === 0) continue // a synthetic message, not a request
        if (price(model) === undefined) T.unknown[model] = true
        else if (guessed(model)) T.guessed[model] = true
        const R = /** @type {NonNullable<ReturnType<typeof rates>>} */ (rates(model, prompt, UNKNOWN_PRICE))
        const w1 = Math.min(cw, u.cache_creation?.ephemeral_1h_input_tokens ?? 0), wrote = (cw - w1) * R.w5 + w1 * R.w1, input = inp * R.inp + wrote + cr * R.read
        if (cw) c.hour = w1 > 0 // which cache this chat writes to
        const wr = c.hour ? R.w1 : R.w5
        c.ids.set(ev.message.id, c.reqs.length); c.reqs.push(wr); c.rd.push(R.read); c.epochs.push(c.epoch)
        c.rate[ev.message.id] = R.out
        T.requests++; requests++; T.contextTokens += prompt; context += prompt; day ||= String(ev.timestamp).slice(0, 10)
        T.fresh += inp * R.inp; T.write += wrote; T.read += cr * R.read
        usd += input
        if (c.side) T.side += input
        // a cache break: most of the previous prompt was written again instead of read
        if (c.prev && !c.fresh && cr < 0.5 * c.prev && cw > 0.5 * c.prev) {
          const extra = Math.min(c.prev, cw) * (wr - R.read), idle = t - c.lastT
          if (idle > 3600_000) { T.pauseLong += extra; T.pauseLongN++ } else if (idle > 300_000) { T.pauseShort += extra; T.pauseShortN++ } else { T.breakOther += extra; T.breakOtherN++ }
        }
        T.floor += Math.min(c.floor, cr) * R.read
        c.prev = prompt; c.fresh = false
      }
      c.lastT = t
      if (c.rate[ev.message.id] !== undefined) c.out[ev.message.id] = u.output_tokens ?? 0 // streamed copies repeat the id: the last one counts
    }
    if (!Array.isArray(content)) continue
    for (const b of content) {
      if (b.type === 'tool_use') {
        const i = b.input ?? {}, tool = c.tool[b.id] = { name: b.name, cmd: i.command, kind: '' }
        if (b.name === 'Read') { const k = `${i.file_path}#${i.offset ?? ''}+${i.limit ?? ''}`; if (c.seen.has(k)) tool.kind = 'reread'; c.seen.add(k) }
        else if (b.name === 'Edit' || b.name === 'Write') { for (const k of c.seen) if (k.startsWith(i.file_path + '#')) c.seen.delete(k); c.blind = {} }
      } else if (b.type === 'tool_result' && c.tool[b.tool_use_id]) {
        const tool = c.tool[b.tool_use_id]; let kind = tool.kind
        if (tool.name === 'Bash') { if (!b.is_error) delete c.blind[tool.cmd]; else if ((c.blind[tool.cmd] = (c.blind[tool.cmd] ?? 0) + 1) > 1) kind = 'loop' }
        if (kind) c.items.push({ at: c.reqs.length, tokens: size(b.content) + (kind === 'loop' ? size(tool.cmd) : 0), kind })
      }
    }
  }

  for (const c of chains.values()) {
    // a result is written to the cache once, then read by every later request until the next compaction
    const later = new Array(c.reqs.length + 1).fill(0)
    for (let i = c.reqs.length - 2; i >= 0; i--) later[i] = c.epochs[i + 1] === c.epochs[i] ? later[i + 1] + c.rd[i + 1] : 0
    for (const it of c.items) {
      if (it.at >= c.reqs.length) continue
      const cost = it.tokens * (c.reqs[it.at] + later[it.at])
      if (it.kind === 'reread') { T.rereads += cost; T.rereadN++ } else { T.loops += cost; T.loopN++ }
    }
    for (const [id, tokens] of Object.entries(c.out)) {
      const v = tokens * c.rate[id]
      T.output += v; usd += v
      if (c.side) T.side += v
    }
    if (c.side && c.reqs.length) T.agents++
  }
  if (requests) {
    if (chains.get('main')?.reqs.length) T.sessions++
    T.top = [...T.top, { day, usd: usd / 1e6, context: Math.round(context / requests) }].sort((a, b) => b.usd - a.usd).slice(0, 3)
  }
  return T
}

/** The receipt as text. @param {ReturnType<typeof emptyTotals>} T @param {string} [period] */
export function receipt(T, period = 'all time') {
  const total = T.output + T.fresh + T.write + T.read
  if (!total) return 'No Claude Code sessions found.\n'
  const usd = (/** @type {number} */ x) => `$${(x / 1e6).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`.padStart(11)
  const row = (/** @type {string} */ name, /** @type {number} */ x, note = '') => `${name.padEnd(40)}${usd(x)}${`${(100 * x / total).toFixed(1)}%`.padStart(7)}  ${note}`.trimEnd()
  const k = (/** @type {number} */ n) => `${Math.round(n / 1000)}k`
  const unknown = Object.keys(T.unknown), family = Object.keys(T.guessed)
  return [
    `CACHITO RECEIPT · ${period} · ${T.sessions} sessions · ${T.requests.toLocaleString('en-US')} requests`,
    '',
    row('TOTAL at list prices', total),
    row('  carrying the context (cache reads)', T.read, `${k(T.contextTokens / T.requests)} tokens re-sent per request`),
    row('  the answers (output)', T.output),
    row('  new context (cache writes)', T.write),
    row('  uncached input', T.fresh),
    '',
    'Inside that total',
    row('  spent by subagents', T.side, `${T.agents} subagents`),
    row('  cache rebuilt after a pause over 1 h', T.pauseLong, `${T.pauseLongN} times`),
    row('  cache rebuilt after a 5-60 min pause', T.pauseShort, `${T.pauseShortN} times`),
    row('  cache broken mid-session', T.breakOther, `${T.breakOtherN} times`),
    row('  re-reads of unchanged files (est.)', T.rereads, `${T.rereadN} times`),
    row('  repeated failing commands (est.)', T.loops, `${T.loopN} times`),
    '',
    'What would have paid (estimates)',
    row('  coming back within 5 minutes, or /clear first', T.pauseLong + T.pauseShort),
    row('  the first prompt, re-read by every request', T.floor, 'what /context breaks down'),
    '',
    'Costliest sessions',
    ...T.top.map(s => `  ${s.day}  ${usd(s.usd * 1e6).trim().padStart(10)}  ${k(s.context)} tokens of context per request`),
    '',
    'Estimated from local transcripts at list prices; a subscription does not bill these amounts.',
    ...(unknown.length ? [`Priced as mid tier, not in the price table: ${unknown.join(', ')}`] : []),
    ...(family.length ? [`Priced like their family, price not verified: ${family.join(', ')}`] : []),
    '',
  ].join('\n')
}

/** Every .jsonl under a folder. @param {string} dir @returns {string[]} */
function transcripts(dir) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return [] } // a folder that cannot be listed is passed over
  return entries.flatMap(e => e.isDirectory() ? transcripts(join(dir, e.name)) : e.isFile() && e.name.endsWith('.jsonl') ? [join(dir, e.name)] : []) // regular files only: a link, broken or not, is not followed
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2), d = args.indexOf('--days')
  const days = d < 0 ? 0 : Number(args.splice(d, 2)[1])
  if (d >= 0 && !(days > 0)) { console.error('--days needs a number over 0'); process.exit(2) }
  const dir = args[0] ?? join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), '.claude'), 'projects')
  const since = days ? Date.now() - days * 86_400_000 : 0
  const T = emptyTotals()
  for (const file of transcripts(dir)) {
    try {
      if (since && statSync(file).mtimeMs < since) continue
      await addTranscript(createInterface({ input: createReadStream(file) }), T, since)
    } catch { /* a file that went away or cannot be read: the receipt goes on with the others */ }
  }
  process.stdout.write(receipt(T, days ? `last ${days} days` : 'all time'))
}
