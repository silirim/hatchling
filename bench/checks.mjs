// What the bench checks of a project, measured against the project as it was at the pinned commit, in the environment the agent gets.
// A public project is not always clean under this machine's tools: at its pinned commit gin has one file that the gofmt of Go 1.27
// lists. A check that asked for "no file listed" or "go test passes" would then fail in every arm, whatever the agent did.
// So: `formatted` asks for no file listed beyond those listed at the start, and the tests ask that what passed at the start still
// passes and that nothing else fails. The start itself must be sound: the bench refuses a project whose tests fail before any run.
import { spawnSync } from 'node:child_process'

/**
 * The flags every `go` of a task gets, by the agent and by the checks alike. -p=2 bounds each build. -trimpath lets every clone
 * share one build cache; a task whose project has tests that read file paths from a stack (gin's recovery tests) turns it off
 * with `"trimpath": false` in its task.json, and each clone then builds the project's own packages again.
 * @param {{ trimpath?: boolean }} spec
 */
export const goflags = (spec) => spec.trimpath === false ? '-p=2' : '-trimpath -p=2'

/**
 * What `go test -json` reported: the packages and the top-level tests that passed and that failed. A subtest is in its parent's
 * result. A package is named by its path, a test by `<package>.<Test>`.
 * @param {string} out @returns {{ pass: string[], fail: string[] }}
 */
export function results(out) {
  /** @type {Set<string>} */ const pass = new Set(), fail = new Set()
  for (const line of out.split('\n')) {
    if (!line.startsWith('{')) continue
    let ev; try { ev = JSON.parse(line) } catch { continue }
    if (!ev.Package || ev.Test?.includes('/') || (ev.Action !== 'pass' && ev.Action !== 'fail')) continue
    ;(ev.Action === 'pass' ? pass : fail).add(ev.Test ? `${ev.Package}.${ev.Test}` : ev.Package)
  }
  return { pass: [...pass].sort(), fail: [...fail].sort() }
}

/**
 * Several tries of the same tests as one result: what passed in any try passed (a timing test can fail once while other runs load
 * the machine), and what failed is what never passed.
 * @param {{ pass: string[], fail: string[] }[]} tries
 */
export function merged(tries) {
  const pass = [...new Set(tries.flatMap(t => t.pass))].sort()
  return { pass, fail: [...new Set(tries.flatMap(t => t.fail))].filter(k => !pass.includes(k)).sort() }
}

/**
 * The tests now against the tests at the start: `lost` passed then and do not pass now (failing, or no longer there), `broken`
 * fail now and did not fail then (the agent's own tests among them).
 * @param {{ pass: string[], fail: string[] }} base @param {{ pass: string[], fail: string[] }} now
 */
export function against(base, now) {
  const lost = base.pass.filter(k => !now.pass.includes(k)), broken = now.fail.filter(k => !base.fail.includes(k))
  return { ok: !lost.length && !broken.length, lost, broken }
}

/** The files listed now that were not listed at the start. @param {string[]} base @param {string[]} now */
export const added = (base, now) => now.filter(f => !base.includes(f))

/**
 * `go test -json ./...` in a folder, once more when anything failed. A `go test` that fails with no test or package named as
 * failed (a go.mod that does not load) fails as `(go test)`.
 * @param {string} dir @param {NodeJS.ProcessEnv} env @param {number} [tries]
 */
export function tested(dir, env, tries = 2) {
  /** @type {{ pass: string[], fail: string[] }[]} */ const got = []
  for (let i = 0; i < tries; i++) {
    const r = spawnSync('go', ['test', '-json', './...'], { cwd: dir, env, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 600_000, stdio: ['ignore', 'pipe', 'ignore'] })
    const one = results(r.stdout ?? '')
    if (r.status !== 0 && !one.fail.length) one.fail.push('(go test)')
    got.push(one)
    if (!one.fail.length) break
  }
  return merged(got)
}

/**
 * The files `gofmt -l .` lists in a folder; null when gofmt itself fails (a file that does not parse).
 * @param {string} dir @param {NodeJS.ProcessEnv} env @returns {string[] | null}
 */
export function unformatted(dir, env) {
  const r = spawnSync('gofmt', ['-l', '.'], { cwd: dir, env, encoding: 'utf8', maxBuffer: 1 << 26, stdio: ['ignore', 'pipe', 'ignore'] })
  return r.status === 0 ? r.stdout.split('\n').filter(Boolean).sort() : null
}

/**
 * The start every run is measured against: the project at the pinned commit, in the environment a run gets. Throws when that
 * start is not sound: a test that fails there fails for every arm and says nothing of the agent's work.
 * @param {string} dir a clone at the pinned commit, as it is before a task's setup @param {NodeJS.ProcessEnv} env
 */
export function baseline(dir, env) {
  const tests = tested(dir, env), files = unformatted(dir, env)
  if (tests.fail.length) throw new Error(`the project's tests fail at the pinned commit, before any run, with GOFLAGS="${env.GOFLAGS}": ${tests.fail.slice(0, 8).join(', ')}${tests.fail.length > 8 ? `, and ${tests.fail.length - 8} more` : ''}. Every arm would fail the same checks. If the tests read file paths from a stack, set "trimpath": false in the task's task.json`)
  if (!tests.pass.length) throw new Error('no test of the project passes at the pinned commit: go test reported none')
  if (!files) throw new Error('gofmt fails on the project at the pinned commit: a file does not parse')
  return { tests, unformatted: files }
}
