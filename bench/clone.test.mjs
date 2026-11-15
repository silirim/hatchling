// @ts-check
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { seedOf, strays, onlyPast } from './clone.mjs'

const git = (/** @type {string} */ dir, /** @type {string[]} */ ...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@localhost', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...a], { encoding: 'utf8' }).trim()

/** A project like a public one: the pinned commit C with a past, a tag on it, and after it a fix on the default branch, a later tag and a side branch. */
function project() {
  const root = mkdtempSync(join(tmpdir(), 'bench-clone-')), up = join(root, 'upstream')
  execFileSync('git', ['init', '-q', '-b', 'master', up])
  const commit = (/** @type {string} */ text, /** @type {string} */ subject) => { writeFileSync(join(up, 'code.txt'), text); git(up, 'add', '-A'); git(up, 'commit', '-q', '-m', subject); return git(up, 'rev-parse', 'HEAD') }
  const first = commit('one', 'first'); git(up, 'tag', 'v0.9')
  const c = commit('defect', 'release'); git(up, 'tag', '-a', 'v1.0', '-m', 'v1.0')
  const fix = commit('fixed', 'fix: the defect the bench asks about'); git(up, 'tag', 'v1.1')
  git(up, 'checkout', '-q', '-b', 'side', c); const side = commit('other', 'side work'); git(up, 'checkout', '-q', 'master')
  return { root, up, first, c, fix, side }
}

test('the seed holds the pinned commit and its past, and nothing that came after: no later commit, branch, tag or object', () => {
  const p = project()
  try {
    const seed = join(p.root, 'out', 'task')
    execFileSync('mkdir', ['-p', join(p.root, 'out')])
    assert.equal(seedOf(p.up, p.c, seed), p.c)
    assert.deepEqual(strays(seed, p.c), [])
    assert.equal(git(seed, 'rev-parse', 'HEAD'), p.c)
    assert.equal(git(seed, 'log', '--all', '--reflog', '--format=%s'), 'release\nfirst')
    assert.equal(git(seed, 'for-each-ref', '--format=%(refname)'), 'refs/heads/master\nrefs/tags/v0.9\nrefs/tags/v1.0') // the project's own branch name, ending at C; the tags of the past
    assert.equal(git(seed, 'rev-parse', 'master'), p.c)
    for (const id of [p.fix, p.side]) assert.throws(() => git(seed, 'cat-file', '-e', id)) // not even as an object
    assert.deepEqual(execFileSync('ls', [join(p.root, 'out')], { encoding: 'utf8' }).trim(), 'task') // the whole clone it read from is gone

    // a run's clone, made as run.mjs makes it, is as clean as the seed
    const run = join(p.root, 'out', 'run-1')
    execFileSync('git', ['clone', '-q', '--', seed, run]); git(run, 'checkout', '-q', '--detach', p.c); git(run, 'remote', 'remove', 'origin')
    assert.doesNotThrow(() => onlyPast(run, p.c))
    assert.equal(git(run, 'log', 'master', '--format=%s'), 'release\nfirst')
    // a second start keeps the seed, and a ref by tag name resolves in it
    assert.equal(seedOf(p.up, 'v1.0', seed), p.c)
  } finally { rmSync(p.root, { recursive: true, force: true }) }
})

test('the check fails on a clone that holds the future: by a branch, by a tag, by a reflog, and by an object no ref reaches', () => {
  const p = project()
  try {
    // the old way: a whole clone with the pinned commit checked out. The default branch still ends at the fix
    const plain = join(p.root, 'plain')
    execFileSync('git', ['clone', '-q', '--', p.up, plain]); git(plain, 'checkout', '-q', '--detach', p.c)
    assert.deepEqual(strays(plain, p.c).sort(), [p.fix, p.side].sort())
    assert.throws(() => onlyPast(plain, p.c), /holds 2 commits that came after/)
    // refs deleted, reflog kept: the fix is still one `git reflog` away
    git(plain, 'remote', 'remove', 'origin'); git(plain, 'branch', '-D', 'master'); git(plain, 'tag', '-d', 'v1.1')
    assert.ok(strays(plain, p.c).includes(p.fix))
    // reflog emptied, nothing pruned: the commits are objects that `git fsck` lists
    git(plain, 'reflog', 'expire', '--expire=now', '--all')
    assert.deepEqual(strays(plain, p.c).sort(), [p.fix, p.side].sort())
    git(plain, 'gc', '-q', '--prune=now')
    assert.deepEqual(strays(plain, p.c), [])
    // an old seed, made before this check: a second start refuses it and says what to do
    const old = join(p.root, 'old')
    execFileSync('git', ['clone', '-q', '--', p.up, old])
    assert.throws(() => seedOf(p.up, p.c, old), /Delete that folder and start again/)
  } finally { rmSync(p.root, { recursive: true, force: true }) }
})
