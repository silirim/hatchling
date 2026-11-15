// One block of the bench: one run of every arm. The sessions run together, so the arms meet the same hour, load and service state.
// The checks do not: a project's tests can bind fixed ports (gin's TestRun* take 8080, 8443 and four more, and a `go test` that hangs
// holds them until its timeout), so a check that runs while another arm's agent runs the same tests fails for a reason that is not
// the work it is checking. It happened in Series 7 (bench/RESULTS.md). The checks of a block start when its last session has ended
// and no process of an ended session is left in a clone, and run one at a time.
import { readdirSync, readlinkSync } from 'node:fs'
import { sep } from 'node:path'

/**
 * The processes whose working folder is one of `dirs` or below it (Linux: /proc; elsewhere none is found). A `go test` runs in the
 * folder of its package, so a test an agent left running is found here.
 * @param {string[]} dirs @returns {number[]}
 */
export function inside(dirs) {
  let pids; try { pids = readdirSync('/proc').filter(p => /^\d+$/.test(p)) } catch { return [] }
  return pids.filter(p => { try { const cwd = readlinkSync(`/proc/${p}/cwd`); return dirs.some(d => cwd === d || cwd.startsWith(d + sep)) } catch { return false } }).map(Number)
}

/**
 * Waits until no process is left in `dirs`; after `ms` it kills what is left (they belong to sessions that have ended).
 * @param {string[]} dirs @param {number} ms @param {number} [every] @returns {Promise<number[]>} the processes it had to kill
 */
export async function emptied(dirs, ms, every = 2000) {
  for (const until = Date.now() + ms; inside(dirs).length && Date.now() < until;) await new Promise(r => setTimeout(r, every))
  const left = inside(dirs)
  for (const p of left) try { process.kill(p, 'SIGKILL') } catch {}
  if (left.length) await new Promise(r => setTimeout(r, 200))
  return left
}

/**
 * One block: every session at once; then, when all have ended and `settle` is done, the check of each, one at a time.
 * A session that returns undefined (a run already done) has no check.
 * @template A, S
 * @param {A[]} arms @param {(arm: A) => Promise<S | undefined>} session @param {(s: S) => void | Promise<void>} check @param {(all: S[]) => unknown} [settle]
 */
export async function block(arms, session, check, settle) {
  const ended = /** @type {S[]} */ ((await Promise.all(arms.map(session))).filter(s => s !== undefined))
  if (ended.length) await settle?.(ended)
  for (const s of ended) await check(s)
}
