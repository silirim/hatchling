// @ts-check
// The automatic title of a chat (/pet chats titles on, off unless the person turns it on). Claude Code writes lines like
// {"type":"ai-title","aiTitle":"…","sessionId":"…"} into a chat's transcript, and the last one is its title now. Of a transcript
// only such a line is ever parsed: the end of the file comes as one bounded piece, the lines that do not begin as a title line are
// stepped over unread, and the piece is dropped. The title lives in the memory of the chat that asked, in the map it is handed
// here: never in the store, the diary, an export, a picture or a call to a model. Pure but for the `io` it is handed.

import { clip } from './company.js'

export const TITLES = {
  cols: 48, // the widest a title is shown, the ellipsis included
  tailBytes: 262_144, // the piece read from the end of a transcript; a title line is written again every few turns
  moreBytes: 4_000_000, // one longer piece when the short one holds no title line, and never more than this
  lineMax: 4096, // a longer line is no title line
  everyMs: 600_000, // a title is read again after this long
  missMs: 60_000, // a transcript not found is looked for again after this long
  perLook: 8, // transcripts read for one /pet chats; the others keep what was read before, or show none
  timeoutMs: 2_000, // the longest one read may take
  dirs: 64, // project folders tried for a transcript that is not where its chat's folder says
}
const HEAD = '{"type":"ai-title"'

/**
 * The last title in a piece of a transcript, cleaned and cut to TITLES.cols; '' with none. Only the lines that begin as a title
 * line are parsed. The piece may begin in the middle of a line: that part cannot begin as one unless it is a whole line.
 * @param {unknown} piece @returns {string}
 */
export function titleIn(piece) {
  if (typeof piece !== 'string') return ''
  for (let end = piece.length; end > 0;) {
    const start = piece.lastIndexOf('\n', end - 1) + 1
    if (end - start <= TITLES.lineMax && piece.startsWith(HEAD, start)) {
      try {
        const row = JSON.parse(piece.slice(start, end)), title = row && row.type === 'ai-title' ? clip(row.aiTitle, TITLES.cols) : ''
        if (title) return title
      } catch { /* not a line of JSON: stepped over */ }
    }
    end = start - 1
  }
  return ''
}

/** The folder Claude Code keeps a project's transcripts in, named after the working folder. @param {string} cwd */
export const projectOf = (cwd) => cwd.replace(/[^A-Za-z0-9]/g, '-')

/**
 * What a look for titles may do, and nothing else: `stat` says whether a path is a file (and not a link), `list` names the folders
 * of a folder, `tail` hands the last `bytes` of a file as text. Each may reject.
 * @typedef {{ stat: (path: string) => Promise<{ kind: string, isLink: boolean }>, list: (path: string) => Promise<{ name: string, kind: string }[]>, tail: (path: string, bytes: number) => Promise<string> }} TitleIo
 */
/** What is remembered of a chat's title: the title ('' with none), when it was read, where its transcript is ('' when not found). @typedef {{ title: string, at: number, path: string }} Titled */

/**
 * The titles of the chats in `rows`, by chat id: the ones in `kept` that are fresh, and at most TITLES.perLook read anew. `kept`
 * is the caller's, in memory, and is brought up to date here; what it holds of a chat no longer in `rows` is forgotten.
 * A transcript is `<root>/<project>/<id>.jsonl`: where the chat's folder says, else in one of the first TITLES.dirs project folders.
 * Anything that fails (no file, a link, a command that cannot run) gives no title, quietly.
 * @param {TitleIo} io @param {string} root Claude Code's `projects` folder, absolute @param {{ id: string, cwd: string }[]} rows
 * @param {Map<string, Titled>} kept @param {number} now @returns {Promise<Record<string, string>>}
 */
export async function titles(io, root, rows, kept, now) {
  const sound = rows.filter(r => /^[\w-]{1,64}$/.test(r.id) && r.id !== '__proto__')
  for (const id of [...kept.keys()]) if (!sound.some(r => r.id === id)) kept.delete(id)
  const fresh = (/** @type {Titled | undefined} */ k) => !!k && now - k.at >= 0 && now - k.at < (k.path ? TITLES.everyMs : TITLES.missMs)
  const due = /^(\/|[A-Za-z]:[\\/])/.test(root) ? sound.filter(r => !fresh(kept.get(r.id))).slice(0, TITLES.perLook) : []
  const isFile = (/** @type {string} */ path) => io.stat(path).then(s => s.kind === 'file' && !s.isLink, () => false)
  /** @type {string[] | null} */ let dirs = null
  for (const r of due) {
    const name = `${r.id}.jsonl`, was = kept.get(r.id)?.path ?? ''
    let path = was && await isFile(was) ? was : ''
    if (!path) { const p = `${root}/${projectOf(r.cwd)}/${name}`; if (await isFile(p)) path = p }
    if (!path) {
      dirs ??= await io.list(root).then(l => l.filter(e => e.kind === 'dir' && !/[\\/]|^\.\.?$/.test(e.name)).slice(0, TITLES.dirs).map(e => e.name), () => [])
      for (const d of dirs) { const p = `${root}/${d}/${name}`; if (await isFile(p)) { path = p; break } }
    }
    let title = ''
    if (path) {
      title = titleIn(await io.tail(path, TITLES.tailBytes).catch(() => ''))
      if (!title) title = titleIn(await io.tail(path, TITLES.moreBytes).catch(() => ''))
    }
    kept.set(r.id, { title, at: now, path })
  }
  return Object.fromEntries(sound.flatMap(r => { const t = kept.get(r.id)?.title; return t ? [[r.id, t]] : [] }))
}
