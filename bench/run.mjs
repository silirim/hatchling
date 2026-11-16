// Reproducible A/B of Cachito's levers: the same requests, on the same commit of a public project,
// one headless Claude Code session per run, with nothing of this machine's own setup loaded.
// Usage: node bench/run.mjs <out dir> [--work tour|fix|short|real|gin] [--model claude-opus-5-5] [--effort low|medium|high|xhigh|max] [--runs 5] [--arms clean,style] [--task <git url or path>] [--ref <commit>] [--wait]
//        node bench/run.mjs <out dir> --work real --dry [--fixes <folder of .diff>]   no model, nothing billed: the project's own tests at the pinned commit (they must pass), the hidden tests on the code as it is (they must fail), then with the fixes applied (they must pass)
// --wait: when a run hits the account's usage limit, wait and resume until every run is done
// Every run is a real, billed session. Read the numbers with: node bench/report.mjs <out dir>
import { execFileSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statfsSync, writeFileSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { createInterface } from 'node:readline'
import { seedOf, onlyPast } from './clone.mjs'
import { goflags, baseline, tested, unformatted, against, added } from './checks.mjs'
import { block, emptied } from './block.mjs'

// an arm differs from `clean` only in what is listed here
/** @type {Record<string, { plugin: string, env: Record<string, string> }>} */
const ARMS = {
  clean: { plugin: '', env: {} }, // no plugin at all
  observe: { plugin: 'cachito', env: {} }, // Cachito as installed: it watches and adds nothing
  style: { plugin: 'cachito', env: { CACHITO_STYLE: '1' } }, // the pet with what /pet lean on turns on
  leanonly: { plugin: 'cachito-lean', env: {} }, // the cachito-lean plugin alone, as installed: the same lines, no pet
  // the arms `diet` and `lean` (diet and style) of the past series are gone with the diet: the mod has no such lever any more.
  // Those series can be run again only with the copy of the mod kept in each series' folder (bench/RESULTS.md)
  // two other plugins, each alone, for comparison: their folders come from --caveman <dir> and --ponytail <dir>
  caveman: { plugin: 'caveman', env: { CAVEMAN_DEFAULT_MODE: 'caveman' } }, // it stays off in a headless session unless this is set
  ponytail: { plugin: 'ponytail', env: {} },
  // "just write 'be brief'": a plugin of this folder (arms/brief) that adds one section, `Be brief.`, the way cachito-lean adds its lines
  brief: { plugin: 'brief', env: {} },
  // `Be brief.` plus the three reading lines of the style, the habits that sentence does not cover (arms/mini), added the same way
  mini: { plugin: 'mini', env: {} },
}
const TEXT_ARMS = ['brief', 'mini'] // the plugins of bench/arms: the same module, each with its own text (arms/<name>/text.js)
// user settings (plugins, hooks, permissions) and MCP servers of the machine stay out; the sessions are not saved among the person's own
const ISOLATE = ['--setting-sources', 'project', '--strict-mcp-config', '--no-session-persistence']
const ALLOW = ['Bash(git:*)', 'Bash(ls:*)', 'Bash(grep:*)', 'Bash(find:*)', 'Bash(cat:*)', 'Bash(wc:*)', 'Bash(head:*)', 'Bash(sort:*)', 'Bash(go:*)', 'Bash(gofmt:*)']
const QUIET_MS = 12_000 // a turn is over when nothing has arrived for this long

// What a child process gets of this one's environment: what it needs to find its programs, its home and its account, and nothing
// else. A token or a setting of the person's shell that has no part in the run does not go to the agent, its tools or the tests.
const KEEP = ['PATH', 'HOME', 'USER', 'LOGNAME', 'SHELL', 'LANG', 'LC_ALL', 'LC_CTYPE', 'TERM', 'TZ', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_CACHE_HOME', 'XDG_RUNTIME_DIR', 'SystemRoot', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HTTPS_PROXY', 'HTTP_PROXY', 'NO_PROXY', 'SSL_CERT_FILE', 'NODE_EXTRA_CA_CERTS']
const BASE_ENV = Object.fromEntries(Object.entries(process.env).filter(([k]) => KEEP.includes(k) || /^(ANTHROPIC_|CLAUDE_|AWS_|GOOGLE_|VERTEX_)/.test(k)))
const [outArg, ...flags] = process.argv.slice(2)
const opt = (/** @type {string} */ name, /** @type {any} */ def = undefined) => { const i = flags.indexOf(`--${name}`); return i < 0 ? def : flags[i + 1] }
if (!outArg) { console.error('usage: node bench/run.mjs <out dir> [--model m] [--runs n] [--arms a,b] [--task repo] [--ref ref]'); process.exit(2) }
const out = resolve(outArg), model = opt('model', 'claude-opus-5-5'), runs = Number(opt('runs', 5)), arms = /** @type {string[]} */ (opt('arms', 'clean,style').split(','))
const work = opt('work', 'tour'), wait = flags.includes('--wait')
// the effort the model is asked for, as the CLI's own --effort takes it; none: the CLI's default for the model
const effort = opt('effort'), dry = flags.includes('--dry'), fixes = opt('fixes')
if (effort && !['low', 'medium', 'high', 'xhigh', 'max'].includes(effort)) throw new Error(`--effort is low, medium, high, xhigh or max, not "${effort}"`)
const HERE = dirname(new URL(import.meta.url).pathname), ROOT = dirname(HERE), WORK = join(HERE, 'tasks', work)
const spec = JSON.parse(readFileSync(join(WORK, 'task.json'), 'utf8')) // what this work asks for, and so what is checked
// The project is pinned by the id of a commit, not by a tag, which can be moved. A task names its own project (`task` and `ref` in
// its task.json); one that names none is on VodMax v0.6.17. --task and --ref run the same series on any other project
const task = opt('task', spec.task ?? 'https://github.com/silirim/VodMax.git'), ref = opt('ref', spec.ref ?? '902e44ef6887488767f3ac898e3feecf100c9407')
const armOf = (/** @type {string} */ a) => { const arm = ARMS[a]; if (!arm) throw new Error(`no arm "${a}": ${Object.keys(ARMS).join(', ')}`); return arm }
for (const a of arms) armOf(a)
/** @type {Record<string, string | undefined>} */ const dirs = { caveman: opt('caveman'), ponytail: opt('ponytail') } // cachito's is set below
for (const a of arms) if (armOf(a).plugin in dirs && !dirs[armOf(a).plugin]) throw new Error(`arm "${a}" needs --${armOf(a).plugin} <the plugin's folder>`)

// Claude Code reads CLAUDE.md and AGENTS.md from every folder above the project: a run below one is not a clean run
for (let d = out; ; d = dirname(d)) {
  const found = ['CLAUDE.md', 'AGENTS.md', '.claude/CLAUDE.md'].find(f => existsSync(join(d, f)))
  if (found) throw new Error(`${join(d, found)} would be loaded into every run: choose an out dir with no such file above it`)
  if (d === dirname(d)) break
}
// Every folder and file the bench and the agent make has the modes of the usual umask, whatever the shell that starts the bench has:
// a clone made under 002 has folders others of the group can write (775), and a test of gin (TestSaveUploadedFileWithPermission) reads
// the mode of the clone's own folder: with 775 it fails on a correct fix of the `upload` defect and passes on the defect
process.umask(0o022)
mkdirSync(join(out, 'tmp'), { recursive: true })
// the task is a Go project whose rules gate a commit on its tests: without Go the agent rightly refuses to commit
const go = execFileSync('go', ['version'], { encoding: 'utf8' }).trim()
// builds and tests write here, not in a /tmp that may be small; the build cache is the bench's own. -trimpath lets every clone share it (without it each clone rebuilds all: 28 GB filled a disk on VodMax, and four cold race builds at once ran out of memory); -p=2 bounds each build.
// A task turns -trimpath off ("trimpath": false) when it breaks the project's own tests: the agent and the checks get the same flags (checks.mjs)
// the modules the project needs are downloaded once, before the runs, into the series' own folder (not ~/go/pkg/mod): after that
// nothing asks the network for a module (GOPROXY=off), so a run builds the same with the network up or down
const MODS = { TMPDIR: join(out, 'tmp'), GOCACHE: join(out, 'gocache'), GOMODCACHE: join(out, 'gomodcache'), GOFLAGS: goflags(spec) }
const TMP = { ...MODS, GOPROXY: 'off' }

// the mod under test is copied once: the runs use that copy, and the copy stays as the record of what was tested
// (lean/style.js is the style's text, which the pet takes from the cachito-lean plugin's folder; engine/stub is for a Node test only)
const mod = join(out, 'mod'), leanMod = join(out, 'lean')
const own = (/** @type {string} */ p) => !/\.test\.[jt]sx?$/.test(p) && !p.includes('.claude-plugin/types') && !p.includes('engine/stub')
for (const f of ['.claude-plugin/plugin.json', 'engine', 'hooks', 'types', 'sprites/zoo.js', 'lean/style.js']) cpSync(join(ROOT, f), join(mod, f), { recursive: true, filter: own })
// the cachito-lean plugin is its folder and nothing else, as an install copies it
cpSync(join(ROOT, 'lean'), leanMod, { recursive: true, filter: own })
for (const a of TEXT_ARMS) cpSync(join(HERE, 'arms', a), dirs[a] = join(out, a), { recursive: true, filter: own }) // the arms `brief` and `mini`
for (const d of [mod, leanMod, ...TEXT_ARMS.map(a => join(out, a))]) execFileSync('claude', ['plugin', 'validate', d], { stdio: 'ignore' }) // a copy that does not load would run as `clean` without a word
dirs.cachito = mod
dirs['cachito-lean'] = leanMod
/** @type {(d: string) => string[]} */ const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]).sort()
const sha = (/** @type {(string | Buffer)[]} */ ...texts) => texts.reduce((h, t) => h.update(t), createHash('sha256')).digest('hex').slice(0, 16)
const prompts = readFileSync(join(WORK, 'prompts.txt'), 'utf8').split('\n').filter(Boolean)

// the project as the runs get it: the pinned commit and its past only (clone.mjs), checked at every start
const seed = join(out, 'task')
const commit = seedOf(task, ref, seed)
execFileSync('go', ['mod', 'download'], { cwd: seed, stdio: 'ignore', env: { ...BASE_ENV, ...MODS } })
/** A clone as a run gets it: the pinned commit checked out, no remote, and no commit made after it. @param {string} dir */
function cloneAt(dir) {
  rmSync(dir, { recursive: true, force: true })
  execFileSync('git', ['clone', '-q', '--', seed, dir])
  execFileSync('git', ['-C', dir, 'checkout', '-q', '--detach', commit])
  execFileSync('git', ['-C', dir, 'remote', 'remove', 'origin']) // nothing a run does can be pushed
  onlyPast(dir, commit) // what the agent is given holds no commit made after the pinned one
}
// The start the checks measure against (checks.mjs): the project's own tests and gofmt on the pinned commit, with the environment
// of a run, at every start and with --dry. Tests that fail there stop the bench here, before a run is billed
const BASE = (() => {
  const dir = join(out, 'base')
  cloneAt(dir)
  try { return baseline(dir, { ...BASE_ENV, ...TMP }) } finally { rmSync(dir, { recursive: true, force: true }) }
})()
console.log(`at ${commit.slice(0, 7)}, before any run, with GOFLAGS="${TMP.GOFLAGS}": ${BASE.tests.pass.length} tests and packages pass, none fails; gofmt lists ${BASE.unformatted.length ? `${BASE.unformatted.join(', ')} already: not counted against a run` : 'no file'}`)
writeFileSync(join(out, 'manifest.json'), JSON.stringify({
  started: new Date().toISOString(), work, spec, goflags: TMP.GOFLAGS, umask: '022', baseline: { passing: BASE.tests.pass.length, unformatted: BASE.unformatted }, workHash: sha(...walk(WORK).map(f => readFileSync(f))), model, effort: effort ?? null, runs, arms: Object.fromEntries(arms.map(a => [a, armOf(a)])), task, ref, commit,
  claude: execFileSync('claude', ['--version'], { encoding: 'utf8' }).trim(), node: process.version, go, platform: process.platform,
  others: Object.fromEntries(Object.entries(dirs).flatMap(([k, d]) => !k.startsWith('cachito') && !TEXT_ARMS.includes(k) && d ? [[k, { dir: d, version: JSON.parse(readFileSync(join(d, '.claude-plugin/plugin.json'), 'utf8')).version }]] : [])),
  prompts: sha(prompts.join('\n')), mod: sha(...walk(mod).map(f => readFileSync(f))), lean: sha(...walk(leanMod).map(f => readFileSync(f))), ...Object.fromEntries(TEXT_ARMS.map(a => [a, sha(...walk(join(out, a)).map(f => readFileSync(f)))])), runner: sha(readFileSync(new URL(import.meta.url).pathname)),
  flags: [...(effort ? ['--effort', effort] : []), ...ISOLATE, '--permission-mode', 'acceptEdits', '--allowedTools', ...ALLOW],
}, null, 1))

/**
 * One session: the requests go in one at a time, each after the previous turn's result.
 * @param {string} dir @param {string} arm
 */
async function session(dir, arm) {
  mkdirSync(join(out, 'cachito-out', basename(dir)), { recursive: true })
  const child = spawn('claude', ['-p', '--model', model, ...(effort ? ['--effort', effort] : []), '--input-format', 'stream-json', '--output-format', 'stream-json', '--verbose', ...ISOLATE,
    '--permission-mode', 'acceptEdits', '--allowedTools', ...ALLOW, ...(armOf(arm).plugin ? ['--plugin-dir', /** @type {string} */ (dirs[armOf(arm).plugin])] : [])],
  { cwd: dir, stdio: ['pipe', 'pipe', 'pipe'], env: { ...BASE_ENV, CACHITO_STYLE: '', CACHITO_PLAIN: '1', CAVEMAN_DEFAULT_MODE: '', CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1', ...TMP, ...armOf(arm).env, CACHITO_BENCH: join(out, 'cachito-out', basename(dir)) } })
  // CACHITO_BENCH: the mod then keeps its pet, preferences and marks in memory, one per run:
  // nothing of the person's store is read or written, so the lever is the arm's variable and nothing else
  // background commands are off: one that ends later starts a turn of its own, and the answers no longer line up with the requests
  /** @type {string[]} */ const events = []
  /** @type {any[]} */ const results = []
  /** @type {(ev: any) => void} */ let onResult = () => {}
  /** @type {any} */ let init
  let last = Date.now(), first = 0, stderr = '', ended = 0
  child.stderr.on('data', (d) => { stderr += d })
  createInterface({ input: child.stdout }).on('line', (line) => {
    let ev; try { ev = JSON.parse(line) } catch { return }
    last = Date.now(); events.push(line)
    if (ev.type === 'system' && ev.subtype === 'init') init ??= ev
    const u = ev.type === 'assistant' && !ev.parent_tool_use_id && ev.message?.usage
    if (u) first ||= (u.input_tokens ?? 0) + (u.cache_read_input_tokens ?? 0) + (u.cache_creation_input_tokens ?? 0)
    if (ev.type === 'result') { ended++; onResult(ev) }
  })
  child.on('exit', () => onResult({ is_error: true, result: 'the process ended' }))
  for (const p of prompts) {
    results.push(await new Promise((done) => { onResult = done; child.stdin.write(JSON.stringify({ type: 'user', message: { role: 'user', content: p } }) + '\n') }))
    if (results.at(-1).result === 'the process ended') break
    do await new Promise(r => setTimeout(r, 2000)); while (Date.now() - last < QUIET_MS)
  }
  child.stdin.end()
  // what the run really had loaded, read from the session itself and not assumed from the flags
  const loaded = { version: init?.claude_code_version, plugins: (init?.plugins ?? []).map((/** @type {any} */ p) => p.name).filter((/** @type {string} */ n) => !n.startsWith('cc-plugin-')), mcp: (init?.mcp_servers ?? []).map((/** @type {any} */ m) => m.name), tools: init?.tools?.length, skills: init?.skills?.length, firstPrompt: first,
    failed: stderr.split('\n').filter(l => /did not load|hook skipped|failed/i.test(l)) } // a hooks module that fails to load only says so here
  return { events, results, loaded, ended }
}

/**
 * What can be checked without judgement: the work asked for is there, the project's tests pass, and the last answer (given from memory) names it.
 * @param {string} dir @param {string} base @param {any[]} results @param {number} turns
 */
function grade(dir, base, results, turns) {
  const git = (/** @type {string[]} */ ...a) => execFileSync('git', ['-C', dir, ...a], { encoding: 'utf8' }).trim()
  const env = { ...BASE_ENV, ...TMP }
  const passes = (/** @type {string[]} */ ...a) => { try { execFileSync('go', ['test', ...a], { cwd: dir, stdio: 'ignore', env, timeout: 600_000 }); return true } catch { return false } }
  const commits = Number(git('rev-list', '--count', `${base}..HEAD`))
  git('add', '-A') // work left uncommitted counts as work: `committed` is its own check
  const changed = git('diff', '--cached', '--name-only', base).split('\n').filter(Boolean), code = changed.filter(f => f.endsWith('.go') && !f.endsWith('_test.go'))
  const last = String(results.at(-1)?.result ?? '')
  // against the start (checks.mjs): what passed at the pinned commit still passes and nothing else fails; no file listed by gofmt that was not listed then
  const suite = against(BASE.tests, tested(dir, env)), listed = unformatted(dir, env), unformattedNow = listed && added(BASE.unformatted, listed)
  /** @type {Record<string, unknown>} */ const why = {} // what a failed check found, kept in the result
  if (!suite.ok) why.testsPass = { lost: suite.lost, broken: suite.broken }
  if (!unformattedNow || unformattedNow.length) why.formatted = unformattedNow ?? 'gofmt failed: a file does not parse'
  /** @type {Record<string, boolean>} */ const checks = {
    answered: results.length === prompts.length && results.every(r => !r.is_error && r.result) && turns === prompts.length, // every request got an answer, and no turn started by itself
    committed: commits >= spec.commits,
    testsPass: suite.ok, // the project's own tests, with whatever the agent added; tried twice: a timing test can fail once while other runs load the machine
    formatted: !!unformattedNow && !unformattedNow.length,
  }
  if (spec.testAdded) checks.testAdded = /^\+func Test/m.test(git('diff', '--cached', base, '--', '*_test.go'))
  if (spec.recallChanged) checks.recallsChanged = code.some(f => last.includes(basename(f)))
  if (spec.recall) checks.recalls = spec.recall.every((/** @type {string} */ r) => new RegExp(r).test(last))
  if (spec.accept) { // a test the agent never saw, copied in after the session
    copyFileSync(join(WORK, spec.accept.file), join(dir, spec.accept.dir, spec.accept.file))
    checks.accepted = passes(`./${spec.accept.dir}/`, '-run', spec.accept.run)
    rmSync(join(dir, spec.accept.dir, spec.accept.file))
  }
  // the defects of the task, each with a test the agent never saw, copied in for the check and taken out again: one result each
  if (spec.defects) Object.assign(checks, defects(dir))
  if (spec.originalTests) { // a fix that passes only by editing the test is not a fix: the tests as they were, on the code as the agent left it. Adding cases is fine
    const was = git('ls-tree', '-r', '--name-only', base).split('\n').filter(f => f.endsWith('_test.go'))
    git('restore', `--source=${base}`, '--worktree', '--', ...was)
    for (const f of changed) if (f.endsWith('_test.go') && !was.includes(f)) rmSync(join(dir, f), { force: true })
    const original = against(BASE.tests, tested(dir, env))
    checks.originalTests = original.ok
    if (!original.ok) why.originalTests = { lost: original.lost, broken: original.broken }
    git('checkout-index', '-a', '-f')
  }
  return { checks, commits, ...(Object.keys(why).length && { why }), ...(spec.defects && { fixed: spec.defects.filter((/** @type {{ id: string }} */ d) => checks[`fixed.${d.id}`]).length, of: spec.defects.length }) }
}

/**
 * Which defects of the task are fixed in a clone, by the hidden test of each: `fixed.<id>` true when it passes. A test file is
 * copied in, run alone (once more when it fails: a timing test can fail once on a loaded machine) and removed.
 * @param {string} dir @returns {Record<string, boolean>}
 */
function defects(dir) {
  const env = { ...BASE_ENV, ...TMP }
  /** @type {Record<string, boolean>} */ const got = {}
  for (const d of /** @type {{ id: string, dir: string, file: string, run: string }[]} */ (spec.defects)) {
    const at = join(dir, d.dir, d.file)
    copyFileSync(join(WORK, d.file), at)
    const once = () => { try { execFileSync('go', ['test', `./${d.dir}/`, '-run', d.run, '-count=1'], { cwd: dir, stdio: 'ignore', env, timeout: 300_000 }); return true } catch { return false } }
    got[`fixed.${d.id}`] = once() || once()
    rmSync(at)
  }
  return got
}

let stopped = ''
/** The session of one run; its checks are `checked`, after every session of the block (block.mjs). @param {string} arm @param {number} n */
async function once(arm, n) {
  const name = `${arm}-${n}`, dir = join(out, name)
  if (existsSync(join(out, `${name}.result.json`))) return // an interrupted bench resumes where it stopped
  cloneAt(dir)
  const g = (/** @type {string[]} */ ...a) => execFileSync('git', ['-C', dir, '-c', 'user.name=bench', '-c', 'user.email=bench@localhost', ...a], { encoding: 'utf8' }).trim()
  if (existsSync(join(WORK, 'setup.patch'))) g('apply', join(WORK, 'setup.patch'))
  if (spec.orphan) { // one commit with no history: the agent cannot find what the setup changed with git
    g('checkout', '-q', '--orphan', 'work'); g('add', '-A'); g('commit', '-q', '-m', 'import')
    for (const t of g('tag').split('\n').filter(Boolean)) g('tag', '-d', t)
    g('reflog', 'expire', '--expire=now', '--all'); g('gc', '-q', '--prune=now')
  } else if (existsSync(join(WORK, 'setup.patch'))) g('commit', '-q', '-am', 'setup')
  const base = g('rev-parse', 'HEAD')
  const { events, results, loaded, ended } = await session(dir, arm)
  writeFileSync(join(out, `${name}.events.jsonl`), events.join('\n')) // kept at once: the session is billed whatever happens to its checks
  return { arm, n, name, dir, base, results, loaded, ended }
}
/** The checks of one run, and its result. @param {NonNullable<Awaited<ReturnType<typeof once>>>} run */
function checked({ arm, n, name, dir, base, results, loaded, ended }) {
  const want = armOf(arm).plugin
  const r = { arm, n, cost: results.at(-1)?.total_cost_usd, turns: results.reduce((s, x) => s + (x.num_turns ?? 0), 0), loaded,
    isolated: loaded.plugins.join() === want && loaded.mcp.length === 0 && loaded.failed.length === 0, ...grade(dir, base, results, ended), modelUsage: results.at(-1)?.modelUsage, answers: results.map(x => x.result) }
  writeFileSync(join(out, `${name}.patch`), execFileSync('git', ['-C', dir, 'diff', '--cached', base], { encoding: 'utf8', maxBuffer: 1 << 26 }))
  // a run that did not answer every request (a usage limit, a crash) is not a result: it is kept apart, run again on resume, and the bench stops after this block
  if (!r.checks.answered) stopped = `${name}: ${String(results.find(x => x.is_error || !x.result)?.result ?? 'no answer').slice(0, 120)}`
  writeFileSync(join(out, `${name}.${r.checks.answered ? 'result' : 'failed'}.json`), JSON.stringify(r, null, 1))
  rmSync(dir, { recursive: true, force: true }) // the clone this run made; its work stays in the .patch
  console.log(`${name} $${r.cost?.toFixed(4)} turns ${r.turns} first prompt ${loaded.firstPrompt} plugins [${loaded.plugins}] ${r.isolated ? '' : 'NOT ISOLATED '}checks ${Object.values(r.checks).filter(Boolean).length}/${Object.keys(r.checks).length}`)
}

// one block = one run of every arm, started together: the arms meet the same hour, load and service state (block.mjs)
// warm the shared build cache once, alone: four cold race builds at the same time need more memory than a small machine has
if (dry) {
  // No model and nothing billed: the start was checked above; then a clone as a run gets it, the hidden tests on the code as it is, then with the proof fixes applied
  if (!spec.defects) throw new Error(`--dry is for a task with hidden tests of its defects (real, gin), not "${work}"`)
  const dir = join(out, 'dry')
  cloneAt(dir)
  const before = defects(dir)
  console.log(`as it is at ${commit.slice(0, 7)} (every test must fail): ${Object.entries(before).map(([k, ok]) => `${k.slice(6)} ${ok ? 'PASSES' : 'fails'}`).join(', ')}`)
  let bad = Object.values(before).some(Boolean)
  if (fixes) {
    for (const f of readdirSync(fixes).filter(f => f.endsWith('.diff')).sort()) execFileSync('git', ['-C', dir, 'apply', '--', resolve(fixes, f)])
    const after = defects(dir)
    console.log(`with the fixes of ${fixes} (every test must pass): ${Object.entries(after).map(([k, ok]) => `${k.slice(6)} ${ok ? 'passes' : 'FAILS'}`).join(', ')}`)
    bad ||= Object.values(after).some(ok => !ok)
    // the checks of a run, on the fixed code: a correct fix must not fail them
    const env = { ...BASE_ENV, ...TMP }, suite = against(BASE.tests, tested(dir, env)), listed = unformatted(dir, env), extra = listed ? added(BASE.unformatted, listed) : ['(gofmt failed)']
    console.log(`with the fixes, the checks of a run: the tests that passed at the start ${suite.ok ? 'still pass' : `DO NOT all pass (${[...suite.lost, ...suite.broken].slice(0, 6).join(', ')})`}; gofmt lists ${extra.length ? `MORE than at the start: ${extra.join(', ')}` : 'nothing more than at the start'}`)
    bad ||= !suite.ok || extra.length > 0
  }
  rmSync(dir, { recursive: true, force: true })
  console.log(bad ? 'dry check: NOT as expected' : 'dry check: as expected')
  process.exit(bad ? 1 : 0)
}
const warm = () => { for (const race of [[], ['-race']]) execFileSync('go', ['test', ...race, '-run', '^$', './...'], { cwd: seed, stdio: 'ignore', env: { ...BASE_ENV, ...TMP } }) }
const LOW = 8e9, room = () => { const free = statfsSync(out); return free.bavail * free.bsize }
warm()
for (let tries = 0; ; ) {
  stopped = ''
  for (let n = 1; n <= runs && !stopped; n++) {
    // a full disk makes every agent fail the same way and looks like a result. The build cache grows with every block (the agents
    // change the code, and each changed package is built again: about 3.3 GB a block of two arms on `real`): between two blocks,
    // when no build is running, the bench empties its own cache and warms it again, and stops only when that was not enough
    if (room() < LOW) {
      execFileSync('go', ['clean', '-cache'], { stdio: 'ignore', env: { ...BASE_ENV, ...TMP } })
      console.error(`less than 8 GB free on the disk of the out dir: the bench emptied its Go build cache, ${(room() / 1e9).toFixed(1)} GB free now`)
      if (room() < LOW) { console.error('stopped: less than 8 GB free on the disk of the out dir'); process.exit(1) }
      warm()
    }
    // every session of the block, then the checks one at a time, when no agent is running the project's tests any more: a `go test`
    // an agent left behind is given 11 minutes to end (its own default timeout is 10) and then killed
    await block(arms, a => once(a, n), checked, async (all) => { const left = await emptied(all.map(r => r.dir), 11 * 60_000); if (left.length) console.error(`block ${n}: ${left.length} process(es) left in the clones by ended sessions were killed before the checks`) })
  }
  if (!stopped) break
  const limit = /limit/i.test(stopped)
  if (!wait || (!limit && ++tries >= 3)) { console.error(`stopped, run again to resume: ${stopped}`); process.exit(1) }
  console.error(`${new Date().toISOString()} waiting 15 minutes, then resuming: ${stopped}`)
  await new Promise(r => setTimeout(r, 15 * 60_000))
}
console.log('done')
