// @ts-check
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { goflags, results, merged, against, added, baseline, tested, unformatted } from './checks.mjs'

const ev = (/** @type {Record<string, unknown>} */ e) => JSON.stringify(e)
const P = 'example.com/p'

test('-trimpath is on unless the task turns it off; gin turns it off, the tasks on VodMax do not', () => {
  assert.equal(goflags({}), '-trimpath -p=2')
  assert.equal(goflags({ trimpath: true }), '-trimpath -p=2')
  assert.equal(goflags({ trimpath: false }), '-p=2')
  const spec = (/** @type {string} */ work) => JSON.parse(readFileSync(new URL(`tasks/${work}/task.json`, import.meta.url), 'utf8'))
  assert.equal(goflags(spec('gin')), '-p=2')
  for (const work of ['real', 'fix', 'short', 'tour']) assert.equal(goflags(spec(work)), '-trimpath -p=2', work)
})

test('what go test -json reported: packages and top-level tests, passed or failed; a subtest, a skip, an output line and a line that is no JSON are not results', () => {
  const out = [
    ev({ Action: 'start', Package: P }), ev({ Action: 'run', Package: P, Test: 'TestA' }), ev({ Action: 'output', Package: P, Test: 'TestA', Output: '--- FAIL: not a result\n' }),
    ev({ Action: 'pass', Package: P, Test: 'TestA' }), ev({ Action: 'pass', Package: P, Test: 'TestB/sub' }), ev({ Action: 'fail', Package: P, Test: 'TestB/other' }), ev({ Action: 'fail', Package: P, Test: 'TestB' }),
    ev({ Action: 'skip', Package: P, Test: 'TestC' }), ev({ Action: 'fail', Package: P }), ev({ Action: 'pass', Package: 'example.com/q' }), ev({ Action: 'skip', Package: 'example.com/none' }),
    ev({ ImportPath: 'example.com/broken [example.com/broken.test]', Action: 'build-fail' }), ev({ Action: 'fail', Package: 'example.com/broken', FailedBuild: 'example.com/broken [example.com/broken.test]' }),
    '# example.com/broken', '{ not json', '',
  ].join('\n')
  assert.deepEqual(results(out), { pass: ['example.com/p.TestA', 'example.com/q'], fail: ['example.com/broken', 'example.com/p', 'example.com/p.TestB'] })
  assert.deepEqual(results(''), { pass: [], fail: [] })
})

test('two tries are one result: what passed once passed, what never passed failed', () => {
  const first = { pass: ['p.TestA'], fail: ['p', 'p.TestFlaky', 'p.TestBroken'] }, second = { pass: ['p.TestA', 'p.TestFlaky'], fail: ['p', 'p.TestBroken'] }
  assert.deepEqual(merged([first, second]), { pass: ['p.TestA', 'p.TestFlaky'], fail: ['p', 'p.TestBroken'] })
  assert.deepEqual(merged([first, { pass: ['p', 'p.TestA', 'p.TestBroken', 'p.TestFlaky'], fail: [] }]).fail, [])
})

test('the tests against the start: what passed then must pass now, nothing new may fail, and what failed then is not counted', () => {
  const base = { pass: ['p', 'p.TestA', 'p.TestB'], fail: ['q', 'q.TestRed'] }
  assert.deepEqual(against(base, base), { ok: true, lost: [], broken: [] })
  // the agent added a test that passes; the one that failed at the start still fails
  assert.equal(against(base, { pass: [...base.pass, 'p.TestNew'], fail: base.fail }).ok, true)
  // a test that passed is now failing, with its package
  assert.deepEqual(against(base, { pass: ['p.TestA'], fail: ['p', 'p.TestB', 'q', 'q.TestRed'] }), { ok: false, lost: ['p', 'p.TestB'], broken: ['p', 'p.TestB'] })
  // a test that passed was deleted: nothing fails, and it does not pass any more
  assert.deepEqual(against(base, { pass: ['p', 'p.TestA'], fail: base.fail }), { ok: false, lost: ['p.TestB'], broken: [] })
  // the agent's own test fails
  assert.deepEqual(against(base, { pass: ['p.TestA', 'p.TestB'], fail: ['p', 'p.TestNew', 'q', 'q.TestRed'] }), { ok: false, lost: ['p'], broken: ['p', 'p.TestNew'] })
  // nothing ran at all (go test itself failed)
  assert.deepEqual(against(base, { pass: [], fail: ['(go test)'] }), { ok: false, lost: base.pass, broken: ['(go test)'] })
})

test('formatted counts the files listed beyond those listed at the start', () => {
  assert.deepEqual(added(['binding/binding_nomsgpack.go'], ['binding/binding_nomsgpack.go']), [])
  assert.deepEqual(added(['binding/binding_nomsgpack.go'], ['binding/binding_nomsgpack.go', 'context.go']), ['context.go'])
  assert.deepEqual(added(['binding/binding_nomsgpack.go'], []), []) // the agent formatted it: fine
  assert.deepEqual(added([], ['a.go']), ['a.go'])
})

// The rest runs Go on a small module made here: left out where Go is not installed
const hasGo = spawnSync('go', ['version']).status === 0
/** A module with one package: a file gofmt lists already, one test that passes and, when asked, one that reads the file path of its own frame as -trimpath changes it. */
function project(/** @type {{ stack?: boolean }} */ { stack } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'bench-checks-'))
  writeFileSync(join(dir, 'go.mod'), 'module example.com/p\n\ngo 1.21\n')
  writeFileSync(join(dir, 'p.go'), 'package p\n\nfunc Two() int { return 2 }\n')
  writeFileSync(join(dir, 'ugly.go'), 'package p\n\nfunc   Ugly( ) int {return 1}\n')
  writeFileSync(join(dir, 'p_test.go'), `package p\n\nimport (\n\t"path/filepath"\n\t"runtime"\n\t"testing"\n)\n\nfunc TestTwo(t *testing.T) {\n\tif Two() != 2 {\n\t\tt.Fatal("not two")\n\t}\n}\n\nfunc TestStack(t *testing.T) {\n\t_, file, _, _ := runtime.Caller(0)\n\tif ${stack ? '!' : 'false && !'}filepath.IsAbs(file) {\n\t\tt.Fatalf("not a path on this machine: %s", file)\n\t}\n}\n`)
  const env = { ...process.env, GOFLAGS: '-p=2', GOPROXY: 'off', GOCACHE: join(dir, '.cache'), GOWORK: 'off' }
  return { dir, env, done: () => { execFileSync('chmod', ['-R', 'u+w', dir]); rmSync(dir, { recursive: true, force: true }) } }
}

test('the start of a sound project: its tests pass, the file gofmt lists already is noted; after it a run is measured against that', { skip: !hasGo }, () => {
  const p = project()
  try {
    const base = baseline(p.dir, p.env)
    assert.deepEqual(base, { tests: { pass: ['example.com/p', 'example.com/p.TestStack', 'example.com/p.TestTwo'], fail: [] }, unformatted: ['ugly.go'] })
    // untouched: both checks hold, with the file that was listed at the start still listed
    assert.equal(against(base.tests, tested(p.dir, p.env)).ok, true)
    assert.deepEqual(added(base.unformatted, unformatted(p.dir, p.env) ?? ['?']), [])
    // a change that breaks a test and leaves a second file unformatted
    writeFileSync(join(p.dir, 'p.go'), 'package p\n\nfunc Two( ) int { return 3 }\n')
    assert.deepEqual(against(base.tests, tested(p.dir, p.env)), { ok: false, lost: ['example.com/p', 'example.com/p.TestTwo'], broken: ['example.com/p', 'example.com/p.TestTwo'] })
    assert.deepEqual(added(base.unformatted, unformatted(p.dir, p.env) ?? ['?']), ['p.go'])
    // a file that does not parse: gofmt fails, and that is not "nothing listed"; the package does not build
    writeFileSync(join(p.dir, 'p.go'), 'package p\n\nfunc Two( int {\n')
    assert.equal(unformatted(p.dir, p.env), null)
    assert.deepEqual(against(base.tests, tested(p.dir, p.env, 1)).lost, base.tests.pass)
  } finally { p.done() }
})

test('the bench refuses a start that is not sound: a test that fails at the pinned commit in the environment of a run, as with -trimpath on a test that reads a stack', { skip: !hasGo }, () => {
  const p = project({ stack: true })
  try {
    assert.equal(baseline(p.dir, p.env).tests.fail.length, 0) // without -trimpath the test passes
    assert.throws(() => baseline(p.dir, { ...p.env, GOFLAGS: goflags({}) }), /the project's tests fail at the pinned commit, before any run, with GOFLAGS="-trimpath -p=2": example\.com\/p, example\.com\/p\.TestStack\. .*set "trimpath": false in the task's task\.json/)
    // a project that does not parse, and one with no test at all
    writeFileSync(join(p.dir, 'p.go'), 'package p\n\nfunc Two( int {\n')
    assert.throws(() => baseline(p.dir, p.env), /the project's tests fail at the pinned commit/)
    writeFileSync(join(p.dir, 'p.go'), 'package p\n\nfunc Two() int { return 2 }\n')
    rmSync(join(p.dir, 'p_test.go'))
    assert.throws(() => baseline(p.dir, p.env), /no test of the project passes at the pinned commit/)
  } finally { p.done() }
})
