// The project a run works on: a commit and its ancestors, and nothing that came after.
// A plain clone of a public repository holds every branch and tag of today: `git log master` would show the agent the fixes
// the authors made later. So the bench builds its own copy (`seed`), into which only the pinned commit is fetched, and checks it.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'

const git = (/** @type {string} */ dir, /** @type {string[]} */ ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 }).trim()
const lines = (/** @type {string} */ text) => text.split('\n').filter(Boolean)

/**
 * The commits a repository holds that are not `commit` or one of its ancestors: by any ref, by a reflog, or as objects no ref
 * reaches any more. Empty for a clone a run may be given.
 * @param {string} dir @param {string} commit @returns {string[]}
 */
export function strays(dir, commit) {
  const past = new Set(lines(git(dir, 'rev-list', commit)))
  const held = lines(git(dir, 'cat-file', '--batch-all-objects', '--batch-check=%(objecttype) %(objectname)')).filter(l => l.startsWith('commit ')).map(l => l.slice(7))
  return [...new Set([...held, ...lines(git(dir, 'rev-list', '--all', '--reflog'))])].filter(id => !past.has(id))
}

/**
 * Throws when the repository holds a commit that is not `commit` or an ancestor of it.
 * @param {string} dir @param {string} commit
 */
export function onlyPast(dir, commit) {
  const found = strays(dir, commit)
  if (found.length) throw new Error(`${dir} holds ${found.length} commit${found.length > 1 ? 's' : ''} that came after ${commit.slice(0, 7)} or beside it (${found.slice(0, 3).map(id => id.slice(0, 7)).join(', ')}${found.length > 3 ? ', ...' : ''}): the agent could read them. Delete that folder and start again: the bench then fetches the pinned commit alone`)
}

/**
 * Makes `seed`: a repository with `ref` of `task` checked out, its ancestors, the tags on them, and one branch (named as the
 * project's own default branch) that ends at it. The whole project is cloned to a folder next to `seed`, read, and deleted.
 * A seed that is already there is checked and kept. Returns the commit's id.
 * @param {string} task a git url or path @param {string} ref @param {string} seed
 */
export function seedOf(task, ref, seed) {
  if (!existsSync(seed)) {
    const whole = mkdtempSync(join(dirname(seed), 'whole-'))
    try {
      execFileSync('git', ['clone', '-q', '--', task, whole]) // `--`: a task that starts with a dash is a path or a url, never an option of git
      const commit = git(whole, 'rev-parse', `${ref}^{commit}`)
      const branch = git(whole, 'rev-parse', '--abbrev-ref', 'HEAD').replace(/^HEAD$/, 'main')
      git(whole, 'update-ref', 'refs/bench/base', commit)
      execFileSync('git', ['init', '-q', '-b', 'bench-unborn', seed])
      // only what the pinned commit reaches is asked for: a branch or a tag that came later is never transferred
      git(seed, 'fetch', '-q', '--no-tags', whole, `refs/bench/base:refs/heads/${branch}`, ...lines(git(whole, 'tag', '--merged', commit)).map(t => `refs/tags/${t}:refs/tags/${t}`))
      git(seed, 'checkout', '-q', branch) // on the branch, as a fresh clone of the project is: a run's clone of it then has that branch too
    } catch (e) { rmSync(seed, { recursive: true, force: true }); throw e } finally { rmSync(whole, { recursive: true, force: true }) }
  }
  const commit = git(seed, 'rev-parse', `${ref}^{commit}`)
  onlyPast(seed, commit)
  return commit
}
