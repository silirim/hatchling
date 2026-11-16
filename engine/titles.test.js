// @ts-check
// The automatic titles: only a title line of a transcript is parsed, from a bounded piece of its end; what is hostile is cleaned,
// what is missing is quiet, and the reads are few.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { titleIn, titles, projectOf, TITLES } from './titles.js'
import { cols } from './width.js'

const line = (/** @type {unknown} */ aiTitle, more = {}) => JSON.stringify({ type: 'ai-title', aiTitle, sessionId: 's1', ...more })
const other = (/** @type {string} */ text) => JSON.stringify({ type: 'user', message: { role: 'user', content: text } })

test('the title: the last title line of the piece, and no other line is parsed', () => {
  assert.equal(titleIn([other('hi'), line('First title'), other('more'), line('Fix the login bug'), other('bye'), ''].join('\n')), 'Fix the login bug')
  assert.equal(titleIn(line('No line break at the end')), 'No line break at the end')
  for (const none of ['', '\n\n', other('x'), undefined, null, 7, {}, [line('x')]]) assert.equal(titleIn(none), '')
  // a piece that begins in the middle of a line: the cut part is no line, and the title before it is not there to find
  assert.equal(titleIn(`${line('whole').slice(5)}\n${other('x')}`), '')
  // a chat that only talks about title lines has none: the text sits inside another line, which is stepped over
  assert.equal(titleIn(other(`{"type":"ai-title","aiTitle":"quoted in a prompt"}`)), '')
  assert.equal(titleIn(`  ${line('indented')}`), '')
  // lines that begin as one and are not: broken JSON, another type hidden behind the same start, a title that is no text or empty, a line too long
  const bad = ['{"type":"ai-title","aiTitle":"cut', '{"type":"ai-title","type":"user","aiTitle":"x"}', line(7), line(null), line(''), line(' \n '), line({ a: 1 }), line('x'.repeat(TITLES.lineMax))]
  assert.equal(titleIn(bad.join('\n')), '')
  assert.equal(titleIn([line('Good one'), ...bad].join('\n')), 'Good one') // the last sound one
  // what is not parsed is not touched: a getter on any other line would throw
  let parsed = 0
  const parse = JSON.parse
  JSON.parse = /** @type {typeof JSON.parse} */ ((text, ...rest) => { parsed++; return parse(text, ...rest) })
  try { assert.equal(titleIn([...Array.from({ length: 500 }, (_, i) => other(`secret ${i}`)), line('Only this'), other('after')].join('\n')), 'Only this') } finally { JSON.parse = parse }
  assert.equal(parsed, 1)
})

test('the title is text from outside: no escape or control character, one line, at most 48 columns with an ellipsis', () => {
  assert.equal(titleIn(line('\x1b[31mred\x1b[0m\x07 \u202eeman\u200b\n\r\ttwo\x00')), 'red eman two')
  assert.equal(titleIn(line('\x1b]8;;http://evil\x07click\x1b]8;;\x07')), 'click')
  assert.equal(titleIn(line('\x1b[2J\x1b[H')), '') // nothing left: no title
  assert.equal(titleIn(line('t'.repeat(300))), `${'t'.repeat(TITLES.cols - 1)}…`)
  assert.equal(titleIn(line('t'.repeat(TITLES.cols))), 't'.repeat(TITLES.cols))
  const wide = titleIn(line('标题'.repeat(100)))
  assert.ok(cols(wide) <= TITLES.cols && wide.endsWith('…'), wide)
  assert.equal(TITLES.cols, 48)
})

/** A home of transcripts in memory: `files` by path, and what was asked of it. */
function disk(/** @type {Record<string, string | 'link'>} */ files, dirs = ['-w-gin', '-w-other']) {
  const asked = { stat: /** @type {string[]} */ ([]), list: /** @type {string[]} */ ([]), tail: /** @type {[string, number][]} */ ([]) }
  /** @type {import('./titles.js').TitleIo} */ const io = {
    stat: async path => { asked.stat.push(path); if (!Object.hasOwn(files, path)) throw new Error('ENOENT'); return { kind: 'file', isLink: files[path] === 'link' } },
    list: async path => { asked.list.push(path); return [...dirs.map(name => ({ name, kind: 'dir' })), { name: 'a-file', kind: 'file' }, { name: '..', kind: 'dir' }, { name: 'x/y', kind: 'dir' }] },
    tail: async (path, bytes) => { asked.tail.push([path, bytes]); return String(files[path]).slice(-bytes) },
  }
  return { io, asked }
}
const ROOT = '/home/me/.claude/projects', NOW = Date.UTC(2026, 10, 17, 12)

test('titles: a transcript is found by its chat id, read from its end, and read again only after ten minutes', async () => {
  assert.equal(projectOf('/home/me/my work/gin_2'), '-home-me-my-work-gin-2')
  const files = { [`${ROOT}/-w-gin/s1.jsonl`]: [other('a'), line('Fix the login bug'), other('b')].join('\n'), [`${ROOT}/-w-other/s2.jsonl`]: line('Moved elsewhere') }
  const { io, asked } = disk(files), kept = new Map()
  const rows = [{ id: 's1', cwd: '/w/gin' }, { id: 's2', cwd: '/w/gone' }, { id: 's3', cwd: '/w/gin' }]
  assert.deepEqual(await titles(io, ROOT, rows, kept, NOW), { s1: 'Fix the login bug', s2: 'Moved elsewhere' }) // s2 is not where its folder says: found by its id; s3 has no transcript
  assert.deepEqual(asked.tail, [[`${ROOT}/-w-gin/s1.jsonl`, TITLES.tailBytes], [`${ROOT}/-w-other/s2.jsonl`, TITLES.tailBytes]])
  assert.deepEqual(asked.list, [ROOT]) // the folders are listed once for a look
  assert.ok(asked.stat.every(p => p.startsWith(`${ROOT}/`) && /\/s[123]\.jsonl$/.test(p) && !p.includes('..')), asked.stat.join())
  // soon after: nothing is asked for the ones read; the missing one is looked for again after a minute, the titles after ten
  const n = () => asked.stat.length + asked.list.length + asked.tail.length
  let before = n()
  assert.deepEqual(await titles(io, ROOT, rows, kept, NOW + 30_000), { s1: 'Fix the login bug', s2: 'Moved elsewhere' })
  assert.equal(n(), before)
  files[`${ROOT}/-w-gin/s1.jsonl`] += `\n${line('Login fixed, now the tests')}`
  await titles(io, ROOT, rows, kept, NOW + TITLES.missMs)
  assert.equal(asked.tail.length, 2) // only s3 was looked for, and it is still missing
  assert.deepEqual(await titles(io, ROOT, rows, kept, NOW + TITLES.everyMs), { s1: 'Login fixed, now the tests', s2: 'Moved elsewhere' })
  assert.equal(asked.tail.length, 4)
  // a chat no longer listed is forgotten
  await titles(io, ROOT, [{ id: 's1', cwd: '/w/gin' }], kept, NOW + TITLES.everyMs + 1)
  assert.deepEqual([...kept.keys()], ['s1'])
  before = n()
  assert.deepEqual(await titles(io, ROOT, [], kept, NOW + 2 * TITLES.everyMs), {})
  assert.deepEqual([n(), kept.size], [before, 0])
})

test('titles: a huge transcript costs two bounded pieces at most, and a look reads eight transcripts at most', async () => {
  // 40 MB of other lines after the only title: the short piece misses it, the longer one too, and nothing more is read
  const filler = `${other('x'.repeat(1000))}\n`
  const huge = `${line('Far from the end')}\n${filler.repeat(40_000)}`
  assert.ok(huge.length > 40_000_000)
  const path = `${ROOT}/-w-gin/s1.jsonl`, { io, asked } = disk({ [path]: huge }), kept = new Map()
  assert.deepEqual(await titles(io, ROOT, [{ id: 's1', cwd: '/w/gin' }], kept, NOW), {})
  assert.deepEqual(asked.tail, [[path, TITLES.tailBytes], [path, TITLES.moreBytes]])
  assert.ok(TITLES.moreBytes <= 4 * 1024 * 1024 && TITLES.tailBytes < TITLES.moreBytes)
  // a title within the longer piece is found there; one in the short piece costs one read
  const near = disk({ [path]: `${huge}${line('Three megabytes back')}\n${filler.repeat(3000)}` })
  assert.deepEqual(await titles(near.io, ROOT, [{ id: 's1', cwd: '/w/gin' }], new Map(), NOW), { s1: 'Three megabytes back' })
  assert.equal(near.asked.tail.length, 2)
  const end = disk({ [path]: `${huge}${line('At the end')}\n${filler.repeat(100)}` })
  assert.deepEqual(await titles(end.io, ROOT, [{ id: 's1', cwd: '/w/gin' }], new Map(), NOW), { s1: 'At the end' })
  assert.equal(end.asked.tail.length, 1)
  // twenty chats: eight are read now, the next eight at the next look
  const many = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`${ROOT}/-w-gin/c${i}.jsonl`, line(`Chat ${i}`)]))
  const rows = Object.keys(many).map((_, i) => ({ id: `c${i}`, cwd: '/w/gin' })), lot = disk(many), held = new Map()
  assert.equal(Object.keys(await titles(lot.io, ROOT, rows, held, NOW)).length, TITLES.perLook)
  assert.equal(lot.asked.tail.length, TITLES.perLook)
  assert.equal(Object.keys(await titles(lot.io, ROOT, rows, held, NOW + 1)).length, 2 * TITLES.perLook)
})

test('titles: a missing file, a link, a hostile id, a root that is no path, and an io that fails give no title and no error', async () => {
  const path = `${ROOT}/-w-gin/s1.jsonl`
  assert.deepEqual(await titles(disk({}).io, ROOT, [{ id: 's1', cwd: '/w/gin' }], new Map(), NOW), {})
  const link = disk({ [path]: 'link' })
  assert.deepEqual(await titles(link.io, ROOT, [{ id: 's1', cwd: '/w/gin' }], new Map(), NOW), {})
  assert.deepEqual(link.asked.tail, []) // a link is not followed
  const ids = disk({ [path]: line('x') })
  assert.deepEqual(await titles(ids.io, ROOT, [{ id: '../../etc/passwd', cwd: '/w/gin' }, { id: '__proto__', cwd: '/w/gin' }, { id: 'a b', cwd: '/w/gin' }, { id: '', cwd: '/w/gin' }], new Map(), NOW), {})
  assert.deepEqual([ids.asked.stat, ids.asked.list, ids.asked.tail], [[], [], []])
  for (const root of ['', 'projects', '../x', '~/.claude/projects']) { const d = disk({ [path]: line('x') }); assert.deepEqual(await titles(d.io, root, [{ id: 's1', cwd: '/w/gin' }], new Map(), NOW), {}); assert.equal(d.asked.stat.length, 0) }
  const boom = async () => { throw new Error('EACCES') }
  assert.deepEqual(await titles({ stat: boom, list: boom, tail: boom }, ROOT, [{ id: 's1', cwd: '/w/gin' }], new Map(), NOW), {})
  assert.deepEqual(await titles({ stat: async () => ({ kind: 'file', isLink: false }), list: boom, tail: boom }, ROOT, [{ id: 's1', cwd: '/w/gin' }], new Map(), NOW), {})
  assert.deepEqual(await titles({ stat: async () => ({ kind: 'dir', isLink: false }), list: async () => [], tail: boom }, ROOT, [{ id: 's1', cwd: '/w/gin' }], new Map(), NOW), {})
})
