# Bench results

> **Names.** Since 2026-11-16 the project is Hatchling (plugin `hatchling`). Until then it was Cachito: the plugin `cachito`, and the saving plugin `cachito-lean`, now `briefox`. The history below keeps the names as they were when each series ran.

Not affiliated with caveman, ponytail, gin or their authors. Every figure comes from `node bench/report.mjs`. Run it yourself: [README.md](README.md). Method: [METHOD.md](METHOD.md).

**What ships now (2026-11-16).** The saving plugin is `briefox`, and all it adds is the text of the arm `brief`: one section, `Be brief.` (`briefox/text.js`; `bench/arms.test.mjs` holds the two equal). Why: on the long session of VodMax that sentence cost 12.7% less than Claude Code alone (Series 9, p = 0.0006), and on neither project were the eight lines shown to beat it (Series 8 and 9). The eight lines, shipped until that day as the plugin `cachito-lean` and as the pet's `/pet lean on`, are shipped by nothing any more: they are kept as the bench arm `leanonly` (`bench/arms/leanonly`), and `style` is the pet with that arm beside it, so that the series below can be run again. Not measured: the sentence on gin against Claude Code alone, on a short task, against caveman or ponytail, or with the pet loaded. Everything below is as it was measured and written; where it says `cachito-lean`, `/pet lean` or "the style", it means the eight lines.

In short:

- **The eight lines cost less than Claude Code alone on long sessions.** -14.8% on a read-heavy one (Series 4, p = 0.0014). -31.8% on six real defects of gin (Series 7, p = 0.0002).
- **On six real defects of VodMax the evidence is weaker.** -12.4% on Opus 5.5 (Series 5, p = 0.0485: not shown without one pair of runs). -13.8% on Fable 5.2 at low effort (Series 6, p = 0.0238, 5 runs an arm).
- **They do not beat ponytail.** On gin ponytail saved -38.7% and cost 10.0% less than the lines (p = 0.0141). In Series 1 no difference among Cachito, caveman and ponytail is shown.
- **They are not shown to beat the single sentence "Be brief."**, on either project. On gin the lines read 5.0% lower than a plugin that says only that (Series 8, p = 0.5009: not shown; no arm without a plugin). On the long session of VodMax they read 3.5% higher (Series 9, p = 0.3368: not shown).
- **On that long session "Be brief." alone cost 12.7% less than Claude Code alone** (Series 9, p = 0.0006), the eight lines 9.7% less (p = 0.0022), "Be brief." with the three reading lines 11.1% less (p = 0.0053). No one of the three texts is shown to differ from another.
- **No saving is shown on the two short tasks**, for any arm.
- **The diet showed no saving** (-3.6%, p = 0.3110) and is gone. In the tables the arm `lean` is the diet and the style together; the pet with the eight lines is the arm `style`, and the eight lines alone are `leanonly`.
- **No arm is shown to fix more defects than another.**
- **Do not expect a third on your own work.** The model knows gin well, and in three blocks of eight the agents disturbed each other.
- Two Go projects, two models, 8 runs an arm, no person in the sessions.

## How to read the tables

- The figures of Series 1 to 4 were read from the run files on 2026-11-13, by running `node bench/report.mjs <folder>` again and by reading each `manifest.json` and `*.result.json`; Series 5, 6 and 7 on 2026-11-14 and Series 8 and 9 on 2026-11-16, the same way. Where a fact is not in a file, this page says so.
- Series 1 to 6 and Series 9 are on VodMax, a public Go project of this mod's own author, chosen because it is public and has tests; Series 7 and 8 are on gin-gonic/gin, which is not the author's. caveman and ponytail are compared as any user could install them.
- The series with the arms `diet` and `lean` can be run again only with the copy of the mod kept in the series' own folder (`<out dir>/mod`), not with the mod of today.
- One run of `clean` (Series 5) and one of `caveman` (Series 7) read 1 defect of 6 because the agent put each fix on a branch of its own and the bench reads only the last one; rebuilt from the recorded edits, each fixes the six.
- Costs are US dollars as billed by the CLI (`total_cost_usd`), one figure per session.
- `sd` is the sample standard deviation over the runs of an arm.
- `p` is an exact two-sided permutation test on the difference of means. With 8 runs against 8, the smallest p it can give is 0.0002; with 5 against 5, 0.0079.
- Each series compares several pairs of arms. One p under 0.05 among six pairs is weaker evidence than the same p alone.
- Times are UTC. `manifest.json` is rewritten each time a series starts or resumes, so its `started` is the last resume; the run times below are the times the result files were written.
- The requests of every task are written in Italian.

Arms:

| Arm | What is loaded |
|---|---|
| `clean` | Claude Code alone, no plugin |
| `lean` | Cachito with the diet and the style on (`CACHITO_DIET=1`, `CACHITO_STYLE=1`). Since 2026-11-13 `/pet lean on` in the mod turns on the style only: this arm keeps its name and its meaning |
| `caveman` | caveman 4.0.1 alone, turned on with `CAVEMAN_DEFAULT_MODE=caveman` |
| `ponytail` | ponytail 5.3.3 alone |
| `diet` | Cachito with the diet only (`CACHITO_DIET=1`) |
| `style` | Cachito with the style only (`CACHITO_STYLE=1`) |
| `leanonly` | The `cachito-lean` plugin alone, as installed: the same 8 lines of the style, no pet (Series 7, 8 and 9) |
| `brief` | A plugin of the bench alone (`bench/arms/brief`): one section in the system prompt, `Be brief.` (Series 8 and 9) |
| `mini` | A plugin of the bench alone (`bench/arms/mini`): `Be brief.` and the three lines of the style on how the agent reads (Series 9) |

Common to Series 1, 2 and 3 (Series 4 differs, see there): model `claude-opus-5-5`, Claude Code 2.1.322 (the version each run's own `init` event reports), project `https://github.com/silirim/VodMax.git` at tag `v0.6.17` (commit `902e44e`), mod hash `ca23c928fd00aaba`, 8 runs per arm, every run isolated (the plugin of its arm and nothing else, no MCP server, no hooks module that failed to load).

## Series 1: `tour`, four arms

A long session of ten requests: read, explain, write a test, comment, one commit, then answer from memory.

| | |
|---|---|
| Data | `<out>/opus5` |
| Runs 1 to 7 | 2026-11-11, 19:29 to 20:12 |
| Run 8 | 2026-11-12, 01:31 to 01:32, after a usage limit stopped its first attempt (see Void runs) |
| Prompts hash | `2e5d9d71036354ed` |
| Mod hash | `ca23c928fd00aaba` (style of 8 lines) |
| Runner hash | `b41be9e5d19b0591` at the resume; the hash at the first start is not recorded |
| Go | not installed on the machine: the test the agent wrote was never run |
| Billed | $107.62 for the 32 runs counted |

Cost of each run:

| Run | `clean` | `lean` | `caveman` | `ponytail` |
|---|---|---|---|---|
| 1 | $3.655 | $3.148 | $3.325 | $3.200 |
| 2 | $3.358 | $3.296 | $3.208 | $3.407 |
| 3 | $3.687 | $3.242 | $3.300 | $3.305 |
| 4 | $3.838 | $2.986 | $3.125 | $3.349 |
| 5 | $3.731 | $3.233 | $3.427 | $3.195 |
| 6 | $4.009 | $3.287 | $3.321 | $3.289 |
| 7 | $3.797 | $3.122 | $3.079 | $3.330 |
| 8 | $3.604 | $3.217 | $3.345 | $3.202 |
| **Mean** | **$3.710** | **$3.191** | **$3.266** | **$3.284** |
| sd | $0.190 | $0.103 | $0.118 | $0.079 |

| Pair | Difference | % | p | Shown |
|---|---|---|---|---|
| `lean` against `clean` | -$0.519 | -14.0% | 0.0002 | yes |
| `caveman` against `clean` | -$0.444 | -12.0% | 0.0003 | yes |
| `ponytail` against `clean` | -$0.426 | -11.5% | 0.0003 | yes |
| `caveman` against `lean` | +$0.075 | +2.3% | 0.1972 | no |
| `ponytail` against `lean` | +$0.093 | +2.9% | 0.0578 | no |
| `ponytail` against `caveman` | +$0.018 | +0.6% | 0.7259 | no |

Where the tokens went (mean per run, thousands):

| | `clean` | `lean` | `caveman` | `ponytail` |
|---|---|---|---|---|
| Cache write | 213 | 192 | 198 | 199 |
| Cache read | 7030 | 5969 | 6098 | 6139 |
| Output | 30 | 23 | 23 | 23 |
| Model requests | 69 | 65 | 63 | 62 |
| First prompt (tokens) | 17814 | 18181 | 21582 | 20207 |

Quality checks:

| Check | `clean` | `lean` | `caveman` | `ponytail` |
|---|---|---|---|---|
| Every request answered | 8/8 | 8/8 | 8/8 | 8/8 |
| Commit made | 6/8 | 7/8 | 4/8 | 7/8 |
| Test added | 6/8 | 7/8 | 4/8 | 7/8 |
| Doc comment added | 6/8 | 7/8 | 4/8 | 7/8 |
| Last answer names the function | 6/8 | 7/8 | 4/8 | 7/8 |
| Last answer names the files read | 8/8 | 8/8 | 8/8 | 8/8 |
| Last answer names the build steps | 8/8 | 8/8 | 8/8 | 8/8 |

The missing commits are not a fault of an arm. In the eight runs without one (`clean` 4 and 7, `lean` 8, `caveman` 2, 6, 7 and 8, `ponytail` 3) the agent said it would not commit: the project's rules gate a commit on its tests, and Go was not installed. The runner of that day saved only committed work, so the patch of those runs is empty and the three checks that read the patch fail with the commit. The answers say the test and the comment were written. Whether caveman's four refusals have to do with the plugin was not looked into.

To run it again:

```sh
node bench/run.mjs <out>/<name> --work tour --model claude-opus-5-5 --runs 8 \
  --arms clean,lean,caveman,ponytail \
  --caveman <caveman dir> \
  --ponytail <ponytail dir> --wait
node bench/report.mjs <out>/<name>
```

The command line used on the day is not recorded in any file. The command above is today's equivalent, and it is not the same experiment:

- Request 6 has changed. Then it said Go was not installed and the test was not to be run; now it asks to run the test. Today's `tour` prompts hash is `390448704669f8aa`.
- The runner has changed (today `e408f8da4cea2dd3`): it needs Go, lets the agent run `go` and `gofmt`, and checks that the tests pass.
- The mod has changed (today `e3ce4fbc977c8531`). The 8 lines of the style are the same, byte for byte.

## Series 2: `fix`, four arms

Three defects planted in the project, each caught by its own tests; three commits asked for. Five requests.

| | |
|---|---|
| Data | `<out>/s1/fix`, saved report `<out>/s1/fix.report.txt` |
| Runs 1 to 6 | 2026-11-12, 03:36 to 06:23 |
| Runs 7 and 8 | 2026-11-12, 09:41 to 10:14, after a full disk spoiled their first attempt (see Void runs) |
| Prompts hash | `2e3ee8ee7974753f` (the same as today's `bench/tasks/fix`) |
| Task folder hash | `6842d1f59dabb14c` |
| Mod hash | `ca23c928fd00aaba` |
| Runner hash | `559e62147322925b` at the restart; the hash for runs 1 to 6 is not recorded |
| Go | go1.27.3 linux/amd64 |
| Billed | $18.59 for the 32 runs counted |

Cost of each run:

| Run | `clean` | `lean` | `caveman` | `ponytail` |
|---|---|---|---|---|
| 1 | $0.494 | $0.608 | $0.648 | $0.615 |
| 2 | $0.726 | $0.669 | $0.686 | $0.548 |
| 3 | $0.521 | $0.611 | $0.751 | $0.473 |
| 4 | $0.547 | $0.501 | $0.719 | $0.435 |
| 5 | $0.535 | $0.449 | $0.621 | $0.591 |
| 6 | $0.607 | $0.479 | $0.580 | $0.444 |
| 7 | $0.588 | $0.513 | $0.569 | $0.532 |
| 8 | $0.687 | $0.619 | $0.716 | $0.509 |
| **Mean** | **$0.588** | **$0.556** | **$0.661** | **$0.518** |
| sd | $0.082 | $0.080 | $0.068 | $0.066 |

| Pair | Difference | % | p | Shown |
|---|---|---|---|---|
| `lean` against `clean` | -$0.032 | -5.4% | 0.4390 | no |
| `caveman` against `clean` | +$0.073 | +12.5% | 0.0727 | no |
| `ponytail` against `clean` | -$0.070 | -11.8% | 0.0834 | no |
| `caveman` against `lean` | +$0.105 | +18.9% | 0.0148 | under 0.05, one of six pairs |
| `ponytail` against `lean` | -$0.038 | -6.8% | 0.3150 | no |
| `ponytail` against `caveman` | -$0.143 | -21.6% | 0.0014 | yes |

Tokens (mean per run, thousands): cache write 32 / 28 / 35 / 28, cache read 725 / 731 / 948 / 659, output 9 / 9 / 10 / 8, model requests 28 / 29 / 32 / 26, in the order `clean`, `lean`, `caveman`, `ponytail`.

Quality checks:

| Check | `clean` | `lean` | `caveman` | `ponytail` |
|---|---|---|---|---|
| Every request answered | 8/8 | 8/8 | 8/8 | 8/8 |
| Three commits made | 8/8 | 8/8 | 8/8 | 8/8 |
| Project tests pass | 8/8 | 8/8 | 8/8 | 8/8 |
| Code formatted | 8/8 | 8/8 | 8/8 | 8/8 |
| Tests left untouched | 8/8 | 5/8 | 8/8 | 8/8 |
| Last answer names the files | 8/8 | 8/8 | 8/8 | 8/8 |

The 5/8 of `lean` needs a note. The check fails when a test file changes at all. In the three runs it flags (`lean` 1, 3 and 7) the patch replaces one line of an existing test table and adds 3, 11 and 12 lines to test files. `docs/piano.md` records a check done by hand: the tests as they were pass on the fixed code in 8 runs of 8 in every arm. That hand check is not in a file and was not run again for this page. The runner has since replaced the check with one that does exactly that (`originalTests`); it has not yet run in a finished series.

To run it again: see Series 3, one command ran both.

## Series 3: `short`, four arms

A short chat of three requests: one question, one small feature with its test, one commit. A test the agent never sees is run afterwards.

| | |
|---|---|
| Data | `<out>/s1/short`, saved report `<out>/s1/short.report.txt` |
| Runs | 2026-11-12, 10:33 to 13:02 |
| Prompts hash | `148ae5ffb4ec503b` (the same as today's `bench/tasks/short`) |
| Task folder hash | `d13e4b4b09464d44` |
| Mod hash | `ca23c928fd00aaba` |
| Runner hash | `559e62147322925b` |
| Go | go1.27.3 linux/amd64 |
| Billed | $15.67 for the 32 runs counted |

Cost of each run:

| Run | `clean` | `lean` | `caveman` | `ponytail` |
|---|---|---|---|---|
| 1 | $0.606 | $0.435 | $0.481 | $0.490 |
| 2 | $0.606 | $0.481 | $0.512 | $0.458 |
| 3 | $0.525 | $0.476 | $0.594 | $0.375 |
| 4 | $0.441 | $0.450 | $0.460 | $0.621 |
| 5 | $0.443 | $0.453 | $0.465 | $0.529 |
| 6 | $0.590 | $0.526 | $0.493 | $0.405 |
| 7 | $0.535 | $0.564 | $0.457 | $0.380 |
| 8 | $0.502 | $0.383 | $0.494 | $0.442 |
| **Mean** | **$0.531** | **$0.471** | **$0.494** | **$0.463** |
| sd | $0.067 | $0.056 | $0.044 | $0.083 |

| Pair | Difference | % | p | Shown |
|---|---|---|---|---|
| `lean` against `clean` | -$0.060 | -11.3% | 0.0727 | no |
| `caveman` against `clean` | -$0.037 | -6.9% | 0.2155 | no |
| `ponytail` against `clean` | -$0.068 | -12.9% | 0.0929 | no |
| `caveman` against `lean` | +$0.023 | +5.0% | 0.3711 | no |
| `ponytail` against `lean` | -$0.008 | -1.8% | 0.8199 | no |
| `ponytail` against `caveman` | -$0.032 | -6.4% | 0.3590 | no |

Tokens (mean per run, thousands): cache write 28 / 24 / 28 / 26, cache read 486 / 452 / 482 / 433, output 10 / 9 / 9 / 8, model requests 23 / 23 / 22 / 20, in the order `clean`, `lean`, `caveman`, `ponytail`.

Quality checks:

| Check | `clean` | `lean` | `caveman` | `ponytail` |
|---|---|---|---|---|
| Every request answered | 8/8 | 8/8 | 8/8 | 8/8 |
| Commit made | 8/8 | 8/8 | 8/8 | 7/8 |
| Project tests pass | 8/8 | 8/8 | 8/8 | 8/8 |
| Code formatted | 8/8 | 8/8 | 8/8 | 8/8 |
| Hidden test passes | 8/8 | 8/8 | 8/8 | 8/8 |

To run Series 2 and 3 again, as recorded in the working notes:

```sh
bench/series.sh <out>/<name> \
  <caveman dir> \
  <ponytail dir> \
  claude-opus-5-5 8 "fix short"
```

The prompts are unchanged. The runner (today `e408f8da4cea2dd3`) and the mod (today `e3ce4fbc977c8531`) have changed since.

## Series 4: `tour`, the two levers apart

The same long session as Series 1, with the diet alone, the style alone and both. It is the first `tour` series with Go installed, so the agent runs its test and the runner checks that the project's tests pass.

| | |
|---|---|
| Data | `<out>/split`, log `<out>/split.log` |
| Runs 1 to 6 | 2026-11-12 23:36 to 2026-11-13 00:48 |
| `diet` run 6 | 2026-11-13 01:51, alone, after a usage limit stopped it (see Void runs) |
| Runs 7 and 8 | 2026-11-13, 01:59 to 02:12 |
| Model, project | `claude-opus-5-5`, VodMax `v0.6.17` (`902e44e`) |
| Claude Code | 2.1.323 |
| Prompts hash | `390448704669f8aa` (today's `bench/tasks/tour`: request 6 asks to run the test) |
| Task folder hash | `71602ddd31debb70` |
| Mod hash | `e3ce4fbc977c8531` (style of 8 lines, the same text as Series 1) |
| Runner hash | `e408f8da4cea2dd3` |
| Go | go1.27.3 linux/amd64 |
| Isolation | 32 runs of 32: the plugin of the arm and nothing else |
| Billed | $108.90 for the 32 runs counted |

Cost of each run:

| Run | `clean` | `diet` | `style` | `lean` |
|---|---|---|---|---|
| 1 | $3.839 | $3.427 | $2.552 | $3.545 |
| 2 | $4.016 | $3.440 | $3.126 | $3.308 |
| 3 | $3.524 | $3.398 | $3.447 | $3.337 |
| 4 | $3.975 | $3.204 | $3.204 | $3.301 |
| 5 | $3.430 | $3.827 | $2.753 | $3.488 |
| 6 | $3.236 | $3.849 | $3.156 | $3.263 |
| 7 | $3.724 | $3.492 | $3.230 | $3.177 |
| 8 | $3.447 | $3.496 | $3.388 | $3.305 |
| **Mean** | **$3.649** | **$3.517** | **$3.107** | **$3.340** |
| sd | $0.282 | $0.218 | $0.306 | $0.120 |

| Pair | Difference | % | p | Shown |
|---|---|---|---|---|
| `diet` against `clean` | -$0.132 | -3.6% | 0.3110 | no |
| `style` against `clean` | -$0.542 | -14.8% | 0.0014 | yes |
| `lean` against `clean` | -$0.308 | -8.4% | 0.0137 | under 0.05, one of six pairs |
| `style` against `diet` | -$0.410 | -11.6% | 0.0039 | yes |
| `lean` against `diet` | -$0.176 | -5.0% | 0.0664 | no |
| `lean` against `style` | +$0.233 | +7.5% | 0.0563 | no |

Where the tokens went (mean per run, thousands):

| | `clean` | `diet` | `style` | `lean` |
|---|---|---|---|---|
| Cache write | 210 | 201 | 192 | 190 |
| Cache read | 7150 | 6913 | 5734 | 6725 |
| Output | 27 | 26 | 25 | 24 |
| Model requests | 70 | 70 | 68 | 70 |
| First prompt (tokens) | 17383 | 17383 | 17747 | 17750 |

Quality checks:

| Check | `clean` | `diet` | `style` | `lean` |
|---|---|---|---|---|
| Every request answered | 8/8 | 8/8 | 8/8 | 8/8 |
| Commit made | 8/8 | 8/8 | 8/8 | 8/8 |
| Project tests pass | 8/8 | 8/8 | 8/8 | 8/8 |
| Code formatted | 8/8 | 8/8 | 8/8 | 8/8 |
| Test added | 8/8 | 8/8 | 8/8 | 8/8 |
| Last answer names a changed file | 8/8 | 8/8 | 8/8 | 8/8 |
| Last answer names the files and the build | 8/8 | 8/8 | 8/8 | 8/8 |

What the diet did. Outputs it trimmed in each run, counted as the events of the session that carry its note ("Cachito left out ... characters"), and the characters the notes say were left out:

| Run | `diet`: outputs trimmed | characters left out | `lean`: outputs trimmed | characters left out |
|---|---|---|---|---|
| 1 | 2 | 29604 | 2 | 30279 |
| 2 | 2 | 32112 | 1 | 26075 |
| 3 | 1 | 3564 | 2 | 30823 |
| 4 | 1 | 3601 | 3 | 32689 |
| 5 | 2 | 29145 | 1 | 26043 |
| 6 | 0 | 0 | 1 | 2058 |
| 7 | 1 | 5481 | 0 | 0 |
| 8 | 2 | 30318 | 3 | 13101 |
| **Total** | **11** | | **13** | |

`clean` and `style` have no such note in any run, as expected. The diet acts once or twice in a session of about 70 requests.

How to read this series:

- **The style carries the saving.** Alone it is the cheapest arm and the only lever shown against `clean` and against the diet.
- **The diet is not shown to save.** -3.6% with p = 0.3110. This series cannot tell a small saving from none.
- **`lean` is not shown to beat the style alone.** It read 7.5% dearer than `style` (p = 0.0563): not shown either way. Nothing here says that adding the diet to the style helps, and the direction of the reading is that it does not.
- **`lean` reads lower here than in Series 1** (-8.4% against -14.0%). Series 1 used another mod (`ca23c928fd00aaba`), Claude Code 2.1.322, no Go on the machine, and a request 6 that told the agent not to run its test. Any of these, or chance, may account for the gap. The two series must not be pooled, averaged or compared run by run.
- The spread of equal runs is larger here than in Series 1 (`clean` sd $0.282 against $0.190).

To run it again:

```sh
node bench/run.mjs <out>/<name> --work tour --model claude-opus-5-5 --runs 8 --arms clean,diet,style,lean --wait
node bench/report.mjs <out>/<name>
```

## Series 5: `real`, six real defects, Opus 5.5

Six real defects of VodMax at `v0.6.17`, found and proven by a reviewer on 2026-11-13. One chat, six requests in a row: each is a user's report that names neither the file nor the fix, and asks for the cause, a fix, a test and a local commit. After the chat six hidden tests, which the agent never saw, are copied in one at a time: the result of a run is how many of the six defects it fixed by those tests. Two arms: `clean` and `style` (what `/pet lean on` turns on today).

It is the first series on work that is not reading: finding causes and writing fixes. It is also the first one made with `CACHITO_BENCH` (the mod keeps the pet in memory and touches nothing of the person's store).

| | |
|---|---|
| Data | `<out>/real-opus`, log `<out>/real-opus.log` |
| Run 1 | 2026-11-13, 17:54 to 17:58 (the times the result files were written) |
| Run 2 | 2026-11-13, 21:08 to 21:17, after a usage limit stopped its first attempt (see Void runs) |
| Runs 3 to 8 | 2026-11-13 22:02 to 2026-11-14 02:50 |
| Model, project | `claude-opus-5-5` at the CLI's default effort, VodMax `v0.6.17` (`902e44e`) |
| Claude Code | 2.1.323 in runs 1 and 2, 2.1.325 in runs 3 to 8 (each run's own `init` event); both arms of a run on the same version |
| Prompts hash | `ffc651a8a20b048e` |
| Task folder hash | `0f7dc606c7c4fa26` |
| Mod hash | `303022d69b93d76d` at the last resume; the hash at the earlier starts is not recorded. The style's text in that copy is the same as in Series 4, and in every run the first prompt of `style` is 364 tokens longer than that of `clean`, as it was there |
| Runner hash | `d8113d90ffe2e99c` at the last resume |
| Go | go1.27.3 linux/amd64 |
| Isolation | 16 runs of 16: the plugin of the arm and nothing else |
| Billed | $50.43 for the 16 runs counted |

Cost of each run:

| Run | `clean` | `style` |
|---|---|---|
| 1 | $2.938 | $3.207 |
| 2 | $3.843 | $2.441 |
| 3 | $2.975 | $2.685 |
| 4 | $3.028 | $3.266 |
| 5 | $3.463 | $3.113 |
| 6 | $3.274 | $2.545 |
| 7 | $3.209 | $3.065 |
| 8 | $4.151 | $3.223 |
| **Mean** | **$3.360** | **$2.943** |
| sd | $0.437 | $0.332 |

`style` against `clean`: -$0.417, -12.4%, p = 0.0485.

Where the tokens went (mean per run, thousands):

| | `clean` | `style` |
|---|---|---|
| Cache write | 121 | 109 |
| Cache read | 7215 | 6208 |
| Output | 47 | 41 |
| Model requests | 123 | 118 |
| First prompt (tokens) | 17501 to 17545 | 17865 to 17909 |

Quality checks:

| Check | `clean` | `style` |
|---|---|---|
| Every request answered | 8/8 | 8/8 |
| Six commits on the branch the run ended on | 7/8 | 8/8 |
| Project tests pass | 8/8 | 8/8 |
| Code formatted | 8/8 | 8/8 |
| Test added | 8/8 | 8/8 |
| The tests as they were pass on the fixed code | 8/8 | 8/8 |
| Defects fixed of 6, by the hidden tests, run by run | 6 6 6 6 6 6 6 1 | 6 6 6 6 6 6 6 6 |

How to read this series:

- **The p is at the edge of the threshold.** 0.0485 is under 0.05 by very little. `style` cost less than `clean` in 6 runs of 8, and more in runs 1 and 4. The spread of equal runs is the largest of any series here (`clean` sd $0.437, 13% of its mean).
- **The result leans on one run.** Run 8 of `clean` is the dearest run of the series ($4.151) and also the odd one (see below). `report.mjs` on a copy of the folder without the two runs of block 8 reads -$0.344, -10.6%, p = 0.0752 over 7+7 runs: not shown. Nothing in the files says that run 8 is not a fair run of `clean`: it answered every request and did the work. It is counted. But a result that is shown with it and not shown without it is a weak one.
- **Do not read "the style fixes more defects" in the last row.** The 1 of run 8 is a limit of the measure, not work that was not done: see the next paragraph. On the defects the two arms are equal as far as this series can tell.
- **One task, one project, 8 runs.** This series agrees in direction with Series 4 (-14.8% on `tour`), on a different kind of work. The two must not be pooled or averaged.

**Run 8 of `clean`: 1 defect of 6, and why.** The agent put each fix on a branch of its own, each started from the pinned commit (`fix/argentina-arabo`, `fix/durata-episodi`, `fix/wireguard-righe-ripetute`, `fix/pausa-riproduzione`, `fix/registrazioni-sovrapposte`, `fix/nome-dispositivo-troncato`), where the other 15 runs made six commits in a row. The bench reads the tree the session ends on (`HEAD`) and nothing else: it found the last branch, with one commit and the fix of the sixth defect, and the saved `clean-8.patch` holds that branch alone. The request does not say where the commits go ("a local commit"), so the run did what it was asked, and the bench counted one sixth of it.

**The six branches, checked by hand on 2026-11-14.** The clone of the run is deleted when the run ends, so the branches themselves are gone. They were rebuilt from `clean-8.events.jsonl`: every `Edit` and `Write` call that succeeded, applied in order to a fresh clone at the pinned commit, with the same `gofmt -w` the agent ran, cut at each of its six commits (script and output in `<out>/verify-clean-8`). Then the bench's own hidden tests, run the way `run.mjs` runs them:

| Rebuilt branch | Hidden tests that pass |
|---|---|
| `fix/argentina-arabo` | `country` only |
| `fix/durata-episodi` | `details` only |
| `fix/wireguard-righe-ripetute` | `vpn` only |
| `fix/pausa-riproduzione` | `rangecache` only |
| `fix/registrazioni-sovrapposte` | `conflict` only |
| `fix/nome-dispositivo-troncato` | `sso` only |
| The six merged (no conflict) | all 6; the project's tests pass, `gofmt` is clean |

So each branch fixes its own defect, and together they fix six of six: on the work, this run is like the other fifteen. What this check is and is not: the last rebuilt branch is identical, byte for byte, to the saved `clean-8.patch`, which says the rebuilding is faithful there; for the other five branches there is nothing saved to compare with, and they stand on the recorded edits alone. The table of this series and `report.mjs` still say 1 of 6, because that is what the bench measured: the figure was not changed by hand.

To run it again (about $50 on Opus 5.5 at list prices; the series ran with `--wait`, which starts spending again by itself after a usage limit):

```sh
node bench/run.mjs <out>/<name> --work real --model claude-opus-5-5 --runs 8 --arms clean,style
node bench/report.mjs <out>/<name>
```

## Series 6: `real`, Fable 5.2 at low effort

The same task, requests, mod and runner as Series 5, on another model: `claude-fable-5-2` with `--effort low`. Five runs an arm, not eight.

| | |
|---|---|
| Data | `<out>/real-fable-low`, log `<out>/real-fable-low.log` |
| Runs 1 to 3 | 2026-11-14, 03:43 to 05:22 |
| Runs 4 and 5 | 2026-11-14, 06:34 to 07:23, after the series was started again (see below) |
| Model, project | `claude-fable-5-2`, `--effort low`, VodMax `v0.6.17` (`902e44e`) |
| Claude Code | 2.1.325 |
| Prompts hash | `ffc651a8a20b048e` (the same requests as Series 5) |
| Task folder hash | `0f7dc606c7c4fa26` |
| Mod hash | `303022d69b93d76d` at the last resume. In every run the first prompt of `style` is 364 tokens longer than that of `clean` |
| Runner hash | `d8113d90ffe2e99c` at the last resume |
| Go | go1.27.3 linux/amd64 |
| Isolation | 10 runs of 10: the plugin of the arm and nothing else |
| Billed | $39.79 for the 10 runs counted; no void run |

Cost of each run:

| Run | `clean` | `style` |
|---|---|---|
| 1 | $4.816 | $4.002 |
| 2 | $4.170 | $3.562 |
| 3 | $4.085 | $3.415 |
| 4 | $4.502 | $3.866 |
| 5 | $3.794 | $3.576 |
| **Mean** | **$4.273** | **$3.684** |
| sd | $0.395 | $0.241 |

`style` against `clean`: -$0.589, -13.8%, p = 0.0238.

Where the tokens went (mean per run, thousands):

| | `clean` | `style` |
|---|---|---|
| Cache write | 109 | 95 |
| Cache read | 4536 | 3659 |
| Output | 40 | 36 |
| Model requests | 103 | 87 |
| First prompt (tokens) | 18869 or 18909 | 19233 or 19273 |

Quality checks: every check passed in 5 runs of 5 in both arms (every request answered, six commits, the project's tests, formatting, a test added, the tests as they were on the fixed code), and every run fixed 6 defects of 6 by the hidden tests.

How to read this series:

- **Five runs an arm.** `style` cost less than `clean` in each of the five blocks, and p = 0.0238 is under 0.05. But five runs are few: with 5 against 5 the test has 252 ways to split the runs, and one or two runs that came out differently would move the result across the threshold. Take it as a first reading on this model, to be repeated with more runs before it is quoted as a size.
- **One model at one effort, one task, one project.** Nothing here says what the style does on Fable 5.2 at another effort.
- **Not to be compared with Series 5 by the dollar.** The two models have different prices and write differently. That both series read between -12% and -14% is two readings in the same direction, not one measure.

To run it again (about $40 at list prices):

```sh
node bench/run.mjs <out>/<name> --work real --model claude-fable-5-2 --effort low --runs 5 --arms clean,style
node bench/report.mjs <out>/<name>
```

**What stopped Series 5 and 6, and what it cost.** Both ran one after the other from a small script (`<out>/phase-a.sh`) that restarted the bench after each stop.

- *The usage limit, once.* It stopped both sessions of run 2 of Series 5 mid-chat ("You've hit your 5-hour limit"). The pair was run again when the window reopened; the first attempt was billed $3.34 for nothing (see Void runs). In between, five more attempts 15 minutes apart were refused at once and billed $0.
- *The full disk, 14 times.* The bench stops before a block when less than 8 GB are free. The logs show that stop twice in Series 5 (after runs 1 and 5) and twelve times in Series 6 (after runs 1 and 2, and ten times in a row after run 3). What filled the disk was the bench's own Go build cache: every agent changes the code, each changed package is built again, plain and with the race detector, and nothing is ever removed. The working notes put it at about 3.3 GB for each pair of runs; the caches were emptied before this page was written, so the figure cannot be read from the files any more. The script emptied the cache and restarted; no run was lost, and every run counted passed the project's tests, so none was spoiled by a full disk. After run 3 of Series 6 (05:22) emptying it was not enough ten times in a row and the script gave up; the series was started again at 05:46 and ran to the end. What else held the disk in between is not in the files.
- *What changed in the bench after these series.* `run.mjs` now empties its own Go cache between two blocks when less than 8 GB are free, warms it again, and stops only if that was not enough. This was written after the series and has not yet been through a real one.

## Series 7: `gin`, six real defects of a second project, four arms

The first series on a project that is not the author's: [gin-gonic/gin](https://github.com/gin-gonic/gin) at `v1.12.0` (commit `73726dc`), under the MIT licence. The shape of `real`: one chat, six requests in a row, each a user's report that names neither the file nor the fix and asks for the cause, a fix, a test and a local commit. The six defects are real ones, each fixed by gin's authors after that commit; after the chat six hidden tests, adapted from the authors' own regression tests, are copied in one at a time. It is also the first series that runs the `cachito-lean` plugin alone (`leanonly`: the eight lines, no pet) beside caveman and ponytail. Not affiliated with gin or its authors.

| | |
|---|---|
| Data | `<out>/gin-opus`, log `<out>/gin-opus.log` |
| Runs 1 to 8 | 2026-11-14, 11:07 to 13:10, one start, no resume |
| Model, project | `claude-opus-5-5`, gin `v1.12.0` (`73726dc`) |
| Claude Code | 2.1.325 |
| Arms | `clean`, `leanonly` (cachito-lean alone), `caveman` (4.0.1), `ponytail` (5.3.3) |
| Prompts hash | `8cb837a2daed07a7` |
| Task folder hash | `d7e1a17472b52507` |
| Mod hash | `52a16a2f421d9a04`; cachito-lean `4dc2a98e71aaedd8`. In every run the first prompt of `leanonly` is 371 tokens longer than that of `clean` |
| Runner hash | `9f05e73795e0b203` |
| Go | go1.27.3 linux/amd64, `GOFLAGS=-p=2` (no `-trimpath` on this task), umask 022 |
| Start | 617 tests and packages pass at the pinned commit, none fails; `gofmt` lists `binding/binding_nomsgpack.go` there, not counted against a run |
| Isolation | 32 runs of 32: the plugin of the arm and nothing else |
| Billed | $61.53 for the 32 runs counted; no void run |

Cost of each run:

| Run | `clean` | `leanonly` | `caveman` | `ponytail` |
|---|---|---|---|---|
| 1 | $2.494 | $1.561 | $2.184 | $1.449 |
| 2 | $2.151 | $1.609 | $1.971 | $1.272 |
| 3 | $2.564 | $1.775 | $2.275 | $1.477 |
| 4 | $2.513 | $1.720 | $2.182 | $1.601 |
| 5 | $2.621 | $1.595 | $1.824 | $1.649 |
| 6 | $2.590 | $1.673 | $1.873 | $1.421 |
| 7 | $2.392 | $1.684 | $2.586 | $1.329 |
| 8 | $1.910 | $1.493 | $2.497 | $1.603 |
| **Mean** | **$2.404** | **$1.639** | **$2.174** | **$1.475** |
| sd | $0.250 | $0.091 | $0.277 | $0.136 |

| Pair | Difference | % | p | Shown |
|---|---|---|---|---|
| `leanonly` against `clean` | -$0.766 | -31.8% | 0.0002 | yes |
| `caveman` against `clean` | -$0.230 | -9.6% | 0.1021 | no |
| `ponytail` against `clean` | -$0.929 | -38.7% | 0.0002 | yes |
| `caveman` against `leanonly` | +$0.535 | +32.7% | 0.0002 | yes |
| `ponytail` against `leanonly` | -$0.164 | -10.0% | 0.0141 | yes |
| `ponytail` against `caveman` | -$0.699 | -32.2% | 0.0002 | yes |

Where the tokens went (mean per run, thousands):

| | `clean` | `leanonly` | `caveman` | `ponytail` |
|---|---|---|---|---|
| Cache write | 87 | 63 | 80 | 58 |
| Cache read | 4221 | 2691 | 4004 | 2458 |
| Output | 43 | 30 | 37 | 26 |
| Model requests | 107 | 86 | 104 | 80 |
| First prompt (tokens) | 17335 | 17706 | 21102 | 19204 |

Quality checks, as the bench read them (two of them are corrected by hand below, and the table is not):

| Check | `clean` | `leanonly` | `caveman` | `ponytail` |
|---|---|---|---|---|
| Every request answered | 8/8 | 8/8 | 8/8 | 8/8 |
| Six commits made | 8/8 | 8/8 | 7/8 | 8/8 |
| The project's tests pass | 6/8 | 5/8 | 8/8 | 6/8 |
| Formatted | 7/8 | 8/8 | 7/8 | 8/8 |
| Test added | 8/8 | 8/8 | 8/8 | 8/8 |
| The tests as they were pass on the fixed code | 6/8 | 6/8 | 8/8 | 6/8 |
| Defects fixed of 6, by the hidden tests (each run) | 6 6 6 6 6 6 6 6 | 6 6 6 6 6 6 6 6 | 1 6 6 6 6 6 6 6 | 6 6 6 6 6 6 6 6 |
| Defects fixed, mean | 6.00 | 6.00 | 5.38 | 6.00 |

How to read this series:

- **cachito-lean saved about a third against nothing.** `leanonly` cost less than `clean` in each of the eight blocks: -31.8%, p = 0.0002, the smallest p eight runs against eight can give.
- **ponytail saved a bit more, and cost less than cachito-lean.** -38.7% against `clean`, and -10.0% against `leanonly` (p = 0.0141, lower in 6 blocks of 8). Nothing in this series supports "lean beats ponytail": here it is the other way. That p is one of six pairs; and on the five blocks where no agent disturbed another (see below) the same pair reads -6.8% with p = 0.1905 over 5+5 runs, not shown. Five runs can show less than eight, so this does not take the result away: ponytail read cheaper either way.
- **caveman's saving is not shown.** -9.6% against `clean`, p = 0.1021: chance alone gives that often. It cost more than both `leanonly` and `ponytail` (p = 0.0002 each).
- **The size is the largest of any series here, on a project the model knows.** See the limits. It is not to be pooled with, or averaged into, the 12% to 15% of the VodMax series.
- **The work was done in every arm.** The failed checks of the table are three things, none of them work not done: seven runs whose checks ran while another arm held the ports of gin's tests; one run with its six fixes on six branches; and two runs (`clean` 7, `caveman` 6) that left `gin.go` not formatted by `gofmt`, which is the agent's own and stays.

**Seven runs fail the project's tests in the table, and pass them alone.** Runs 3 and 7 of `clean`, `leanonly` and `ponytail` fail both `testsPass` and `originalTests`; run 4 of `leanonly` fails `testsPass`. What they lost is the same in the six: the package `gin` through `TestRunEmpty`, `TestRunEmptyWithEnv`, `TestRunTLS`, `TestRunQUIC`, `TestRunWithPort` and `TestPusher` (in `leanonly` 4, `TestRunTLS` alone). Those are gin's own tests that start a server on a fixed port (8080, 8443, 8449, 3123, 5150 among them) and never stop it: while one `go test` of the package runs, another one on the same machine cannot bind.

- *What overlapped* (from `run.mjs` and the times in the events). The four sessions of a block run together. The runner of this series checked each run as soon as its own session ended, with the other arms still at work; the checks themselves never ran two at a time. In block 3 the agent of `caveman` ran `go test -race -count=5 .` from 11:31:37 to 11:41:37, when the tool's own 10-minute limit ended it. Every `go test` of gin's package with a count over 1 in this series ran until a limit ended it, in three arms; why it hangs was not looked into. While it hangs, the servers its first pass started keep their ports. The checks of `ponytail` 3, `leanonly` 3 and `clean` 3 ran between 11:33:55 and 11:38:41, inside that window. In block 7 the same: `caveman` ran `go test -race -count=3 ./...` from 12:42:02 to 12:52:02, and the three checks ran between 12:44:27 and 12:48:18. In block 4 `caveman` ran `go test -count=3 .` from 11:50:43 to 11:57:23 and `ponytail` a long `go test -race -count=3` from 11:52:47 to 12:01:07 (with gin's port tests skipped); the check of `leanonly` 4 started at 11:57:23, the second the tool's limit ended caveman's command, and lasted until 12:07:58: one of its tries ran into its own 10-minute limit. Whether caveman's test process outlived the command is not in the files, so for this one run the overlap is likely and not proven. The eight runs of `caveman` pass both checks: in blocks 3, 4 and 7 its session was the last to end, so nothing else was running when it was checked.
- *The checks again, alone* (2026-11-14, no model, nothing billed; script and output in `<out>/verify-gin`: `alone.mjs`, `alone.txt`). For each of the seven runs: a fresh clone at the pinned commit, the saved `<run>.patch` applied, then the same two checks from `bench/checks.mjs`, in the environment of the series, one at a time with nothing else on the machine running gin's tests, and a single try each (the series allowed two). All seven pass `testsPass` and all seven pass `originalTests`: everything that passed at the pinned commit passes, and nothing else fails. `gofmt` still lists `gin.go` for `clean` 7, as in the series.
- *So*: the hypothesis holds: the failures came from the ports, not from the agents' changes. With these seven read as passing, the project's tests pass in 32 runs of 32 and the tests as they were in 32 of 32. The table above and `report.mjs` keep what the bench measured.
- *What the same collisions did to the cost is not corrected, and cannot be.* In blocks 3, 4 and 7 the agents of all four arms saw gin's port tests fail for the same reason during their own sessions (a tool result with `address already in use` in 10 of those 12 runs; the other two, `caveman` 3 and 7, are the ones that held the ports) and spent requests on it. `report.mjs` on a copy of the folder with the other five blocks only reads: `leanonly` against `clean` -32.6% (p = 0.0079, the smallest 5 against 5 can give), `ponytail` against `clean` -37.2% (p = 0.0079), `caveman` against `clean` -12.1% (p = 0.1508, not shown), `ponytail` against `leanonly` -6.8% (p = 0.1905, not shown), `caveman` against `leanonly` +30.5% and `ponytail` against `caveman` -28.6% (p = 0.0079 each). The two savings against `clean` and caveman's place do not depend on the three blocks; the gap between ponytail and cachito-lean is the one figure that moves.
- *What changed in the bench after this series.* The checks of a block now start when its last session has ended and no process of an ended session is left in a clone, and run one at a time (`bench/block.mjs`, with a test). It has not yet been through a real series. The sessions of a block still share the machine's ports: see Limits.

**Run 1 of `caveman`: 1 defect of 6, and why.** The same case as run 8 of `clean` in Series 5. The agent put each fix on a branch of its own, each started from the pinned commit (`fix/context-copy-errors-accepted`, `fix/recovery-record-panic-error`, `fix/save-uploaded-file-chmod`, `fix/html-no-templates`, `fix/tree-405-slice-bounds`, `fix/run-read-header-timeout`), where the other 31 runs made their commits in a row. The bench reads the tree the session ends on: the last branch, one commit, the fix of the sixth defect. So `committed` fails and five hidden tests fail.

The clone is deleted when the run ends. The six branches were rebuilt on 2026-11-14 from `caveman-1.events.jsonl`, as in Series 5: every `Edit` and `Write` call that succeeded, applied in order to a fresh clone at the pinned commit, with the agent's own `git checkout -b`, `git add`, `rm` and `gofmt -w` at the calls where it made them (script and output in `<out>/verify-gin`: `replay.mjs`, `build.txt`, `result.txt`). Then the bench's hidden tests, run the way `run.mjs` runs them:

| Rebuilt branch | Hidden tests that pass |
|---|---|
| `fix/context-copy-errors-accepted` | `copy` only |
| `fix/recovery-record-panic-error` | `recovery` only |
| `fix/save-uploaded-file-chmod` | `upload` only |
| `fix/html-no-templates` | `html` only |
| `fix/tree-405-slice-bounds` | `methodnotallowed` only |
| `fix/run-read-header-timeout` | `slowheader` only |
| The six merged (no conflict) | all 6; everything that passed at the pinned commit passes and nothing else fails; `gofmt` lists nothing more than at the start |

So each branch fixes its own defect, and together they fix six of six: on the work, this run is like the other 31. What this check is and is not: the last rebuilt branch is identical, byte for byte, to the saved `caveman-1.patch`, and the tree was clean after the last rebuilt commit, which says the rebuilding is faithful there; for the other five branches there is nothing saved to compare with, and they stand on the recorded calls alone. The table of this series and `report.mjs` still say 1 of 6 and a mean of 5.38, because that is what the bench measured.

**Do the tests the agents wrote catch the defects?** The saved patches hold fewer test lines in the cheaper arms (mean per run: `clean` 290, `leanonly` 173, `caveman` 236, `ponytail` 97). Lines say nothing of whether a test guards its fix, so that was measured on 2026-11-14 (no model, nothing billed; script, raw output and table in `<out>/verify-tests`: `verify.mjs`, `raw.jsonl`, `table.txt`, `logs/`).

- *Method.* For each of the 32 runs: a fresh clone at the pinned commit; the *fixed* tree is the whole saved patch, the *unfixed* tree is the pinned commit plus only the patch's `_test.go` files. Every test function the patch added or changed is run alone, in its own process, one at a time, with nothing else on the machine running gin's tests, in the environment of the series. A test *guards* when it passes fixed and fails unfixed, twice. To say which defect it guards, the agent's own fix of one defect is taken out of the whole patch (six more trees a run) and the test must fail there, twice. The source changes are split by defect by where they are (`recovery.go`, `tree.go`, `gin.go`, `render/html.go`: one defect each; `context.go`: by the function); that split was checked with the bench's six hidden tests: without the fix of a defect, its hidden test fails and the others pass, in 192 cases of 192 (the hidden test of `slowheader`, which waits a minute, was run only in its own tree). A test that does not compile without the fix, because it names something the fix added, is cut out and counted apart, not as guarding. For run 1 of `caveman` the merge of its six rebuilt branches was read.
- *Why not the upstream fix.* The first plan gave a test to a defect when gin's own later fix, alone, made it pass. That calls a test unmapped whenever the agent's fix behaves otherwise than upstream's (another status, another error): it reads 2.75 to 3.88 of 6 and is given in `table.txt` only.

| Arm | Test functions added or changed, mean per run | Guard (fail without, pass with) | Pass with and without | Do not compile without the fix | Defects guarded of 6, mean | The eight runs | Defects with a test that fails or does not compile without the fix |
|---|---|---|---|---|---|---|---|
| `clean` | 10.5 | 5.1 | 1.4 | 4.0 | 4.00 | 4 4 4 4 4 4 4 4 | 6 in 8 runs of 8 |
| `leanonly` | 8.4 | 5.3 | 1.0 | 2.1 | 4.75 | 4 5 5 5 5 5 4 5 | 6 in 8 runs of 8 |
| `caveman` | 9.5 | 4.8 | 1.0 | 3.8 | 4.00 | 4 4 4 4 4 4 4 4 | 6 in 8 runs of 8 |
| `ponytail` | 6.3 | 4.9 | 0.3 | 1.1 | 4.88 | 5 5 5 5 4 5 5 5 | 6 in 8 runs of 8 |

- **The arms are equal on what matters: in every run of every arm, each of the six defects has a test of the agent's that fails, or does not build, when that fix is taken out.** 6 of 6 in 32 runs of 32. Fewer test lines did not leave a defect without a test.
- *The strict count differs, and for a reason that is not the tests' strength.* `copy`, `recovery`, `upload` and `methodnotallowed` are guarded by a running test in 32 runs of 32. `slowheader` in none: every agent's test names what its fix added (a constant, a field, a method). `html` in 0 runs of `clean` and of `caveman`, 6 of `leanonly`, 7 of `ponytail`: the first two gave the fix a new exported error and tested for it, so their tests do not compile without the fix; the other two mostly tested the response. By the exact permutation test of `report.mjs` on that count: `leanonly` against `clean` +0.75 (p = 0.0070), `ponytail` against `clean` +0.88 (p = 0.0014), `caveman` against `clean` 0.00 (p = 1), `ponytail` against `leanonly` +0.13 (p = 1). A test that does not compile without the fix also stops a removal of the fix; whether it would catch a fix that is there and wrong was not measured. So this is not evidence that `clean` tests worse.
- *Apart.* No test was flaky (none failed once and passed once), none fails on the whole patch. The tests that pass with and without the fix are, in 24 cases of 29, gin's own `TestSaveUploadedFileWithPermission` with its text changed, not a new test.
- *Limits.* A guarding test is not proof of a good test: it fails without the fix, which says nothing of other wrong fixes it would let through. Top-level test functions only, not their sub-cases. One task, one repository, one model.

To run it again ($62 when it was run, at list prices; two hours, inside one 5-hour window):

```sh
node bench/run.mjs <out>/<name> --work gin --model claude-opus-5-5 --runs 8 \
  --arms clean,leanonly,caveman,ponytail \
  --caveman <caveman dir> \
  --ponytail <ponytail dir>
node bench/report.mjs <out>/<name>
```

Today's runner is not the one of this series: it checks a block after its last session (see above). The costs are not touched by that; the sessions wait less for each other.

## Series 8: `gin`, the eight lines against "Be brief."

The objection "just write 'be brief'", measured. The task of Series 7, the same commit of gin, the same requests. Two arms: `leanonly` (the `cachito-lean` plugin alone: the eight lines) and `brief` (a plugin of this bench, `bench/arms/brief`, that adds one section to the system prompt, appended the same way, whose whole text is `Be brief.`). The two arms differ only in that text. There is no `clean` arm in this series. Not affiliated with gin or its authors.

| | |
|---|---|
| Data | `<out>/gin-brief`, log `<out>/gin-brief.log` |
| Runs 1 to 8 | 2026-11-15 23:33 to 2026-11-16 01:06, one start, no resume |
| Model, project | `claude-opus-5-5`, gin `v1.12.0` (`73726dc`) |
| Claude Code | 2.1.325 |
| Arms | `brief` (`Be brief.`), `leanonly` (cachito-lean alone) |
| Prompts hash | `8cb837a2daed07a7` (the requests of Series 7) |
| Task folder hash | `d7e1a17472b52507` (the task of Series 7) |
| Mod hash | `60ce33b9ed42d32a`; cachito-lean `92d9d6e979c4306c`; `brief` `3dba3380b6c40b6f`. The eight lines are those of Series 7: `<out>/gin-brief/lean/style.js` differs from that series' copy only by a constant that is not sent. In every run the first prompt of `leanonly` is 365 tokens longer than that of `brief` |
| Runner hash | `3686761bc1dd82b8`: the checks of a block run after its last session, one at a time |
| Go | go1.27.3 linux/amd64, `GOFLAGS=-p=2`, umask 022 |
| Start | 617 tests and packages pass at the pinned commit, none fails; `gofmt` lists `binding/binding_nomsgpack.go` there, not counted against a run |
| Isolation | 16 runs of 16: the plugin of the arm and nothing else |
| Billed | $27.16 for the 16 runs counted; no void run |

Cost of each run:

| Run | `brief` | `leanonly` |
|---|---|---|
| 1 | $2.086 | $1.400 |
| 2 | $1.783 | $2.097 |
| 3 | $1.606 | $1.529 |
| 4 | $1.573 | $1.506 |
| 5 | $1.737 | $2.037 |
| 6 | $1.418 | $1.368 |
| 7 | $2.014 | $1.514 |
| 8 | $1.709 | $1.783 |
| **Mean** | **$1.741** | **$1.654** |
| sd | $0.223 | $0.284 |

| Pair | Difference | % | p | Shown |
|---|---|---|---|---|
| `leanonly` against `brief` | -$0.087 | -5.0% | 0.5009 | no |

Where the tokens went (mean per run, thousands):

| | `brief` | `leanonly` |
|---|---|---|
| Cache write | 66 | 63 |
| Cache read | 2960 | 2740 |
| Output | 31 | 30 |
| Model requests | 95 | 89 |
| First prompt (tokens) | 17341 | 17706 |

Quality checks:

| Check | `brief` | `leanonly` |
|---|---|---|
| Every request answered | 8/8 | 8/8 |
| Six commits made | 8/8 | 8/8 |
| The project's tests pass | 8/8 | 8/8 |
| Formatted | 8/8 | 8/8 |
| Test added | 8/8 | 8/8 |
| The tests as they were pass on the fixed code | 8/8 | 8/8 |
| Defects fixed of 6, by the hidden tests (each run) | 6 6 6 6 6 6 6 6 | 6 6 6 6 6 6 6 6 |
| Defects fixed, mean | 6.00 | 6.00 |

How to read this series:

- **On gin, the eight lines are not shown to cost less than the single sentence "Be brief."** `leanonly` read 5.0% lower, p = 0.5009: chance alone gives that half the time. It cost less in 5 blocks of 8 and more in 3.
- **Not shown is not "the same".** 8 runs an arm do not show a difference under about 12%: a small one either way is not excluded.
- **The work was done in both arms.** 16 runs of 16 pass the 12 checks and fix 6 defects of 6. The tests the agents wrote were not examined in this series, as they were in Series 7.
- **Against plain Claude Code this series says nothing directly.** It has no `clean` arm. The `clean` of Series 7 cost $2.404 on the same task: another day, another runner, and it is not a paired comparison, so no percentage for "Be brief." against Claude Code alone is given here as a result. The `leanonly` of that series cost $1.639, this one $1.654.
- **Ports.** Three runs of 16 got gin's port tests failing with `address already in use` in a tool result (`brief` 5, `leanonly` 5, `leanonly` 7): the sessions of a block still share the machine's ports. The checks, run after the block, pass in all. Without blocks 5 and 7 the report reads -4.8%, p = 0.5714 over 6+6 runs: not shown either.

Limits of this series:

- No `clean` arm: see above.
- One project, the one the model knows (see Limits), one task, one model.
- That `Be brief.` reaches the system prompt was proven by a separate local probe and by the arm's own test (`bench/arms.test.mjs`), not in every run. What every run records is that the plugin `brief` was loaded alone and no hooks module failed; the first prompt of `brief` is 6 tokens longer than the `clean` one of Series 7.
- One sentence was tried. Other short instructions were not.

To run it again ($27 when it was run, at list prices; under two hours):

```sh
node bench/run.mjs <out>/<name> --work gin --model claude-opus-5-5 --runs 8 --arms brief,leanonly
node bench/report.mjs <out>/<name>
```

## Series 9: `tour`, three texts beside Claude Code alone

The long session of Series 4 on VodMax, with the arm Series 8 lacked: Claude Code alone. Four arms side by side: `clean` (no plugin), `brief` (one section, `Be brief.`), `mini` (`Be brief.` and the three lines of the style on how the agent reads, word for word: `bench/arms/mini/text.js`) and `leanonly` (the `cachito-lean` plugin alone: the eight lines). The three plugin arms differ only in that text.

| | |
|---|---|
| Data | `<out>/tour-mini`, log `<out>/tour-mini.log` |
| Runs 1 to 3 | 2026-11-16, 02:35 to 03:09 |
| Runs 4 to 8 | 2026-11-16, 03:57 to 05:16, after a usage limit stopped the first attempt at block 4 (see Void runs); one start, the bench waited and went on by itself |
| Model, project | `claude-opus-5-5`, VodMax `v0.6.17` (`902e44e`) |
| Claude Code | 2.1.325 |
| Arms | `clean`, `brief` (`Be brief.`), `mini` (`Be brief.` and three reading lines), `leanonly` (cachito-lean alone) |
| Prompts hash | `390448704669f8aa` (the requests of Series 4) |
| Task folder hash | `71602ddd31debb70` (the task of Series 4) |
| Mod hash | `5d9d90a5a8108eff`; cachito-lean `92d9d6e979c4306c`; `brief` `2ea72e610b7ec0e8`; `mini` `38891c7800abada7`. `<out>/tour-mini/lean/style.js` is the file of Series 8, byte for byte. Against `clean`, the first prompt is 6 tokens longer in `brief`, 132 in `mini`, 373 in `leanonly`, in every block |
| Runner hash | `eaf34a6c31d92e21` |
| Go | go1.27.3 linux/amd64, `GOFLAGS="-trimpath -p=2"`, umask 022 |
| Start | 276 tests and packages pass at the pinned commit, none fails; `gofmt` lists no file |
| Isolation | 32 runs of 32: the plugin of the arm and nothing else |
| Billed | $105.86 for the 32 runs counted; $11.75 more for the block that does not count |

Cost of each run:

| Run | `clean` | `brief` | `mini` | `leanonly` |
|---|---|---|---|---|
| 1 | $3.544 | $3.299 | $3.456 | $3.234 |
| 2 | $3.617 | $3.333 | $3.439 | $3.483 |
| 3 | $3.591 | $3.185 | $3.169 | $3.092 |
| 4 | $3.251 | $3.141 | $3.048 | $3.159 |
| 5 | $3.715 | $3.251 | $2.650 | $2.989 |
| 6 | $3.715 | $3.217 | $2.964 | $3.282 |
| 7 | $3.810 | $2.615 | $3.442 | $3.537 |
| 8 | $3.640 | $3.168 | $3.514 | $3.307 |
| **Mean** | **$3.610** | **$3.151** | **$3.210** | **$3.260** |
| sd | $0.168 | $0.226 | $0.307 | $0.186 |

| Pair | Difference | % | p | Shown |
|---|---|---|---|---|
| `brief` against `clean` | -$0.459 | -12.7% | 0.0006 | yes |
| `mini` against `clean` | -$0.400 | -11.1% | 0.0053 | yes |
| `leanonly` against `clean` | -$0.350 | -9.7% | 0.0022 | yes |
| `mini` against `brief` | +$0.059 | +1.9% | 0.6608 | no |
| `leanonly` against `brief` | +$0.109 | +3.5% | 0.3368 | no |
| `leanonly` against `mini` | +$0.050 | +1.6% | 0.7038 | no |

Where the tokens went (mean per run, thousands):

| | `clean` | `brief` | `mini` | `leanonly` |
|---|---|---|---|---|
| Cache write | 205 | 192 | 198 | 191 |
| Cache read | 7055 | 6043 | 5871 | 6379 |
| Output | 28 | 22 | 26 | 23 |
| Model requests | 69 | 65 | 65 | 66 |
| First prompt (tokens, runs 2 to 8; run 1 is 40 more in every arm) | 17399 | 17405 | 17531 | 17772 |

Quality checks:

| Check | `clean` | `brief` | `mini` | `leanonly` |
|---|---|---|---|---|
| Every request answered | 8/8 | 8/8 | 8/8 | 8/8 |
| Commit made | 8/8 | 8/8 | 8/8 | 8/8 |
| Project tests pass | 8/8 | 8/8 | 7/8 | 8/8 |
| Code formatted | 8/8 | 8/8 | 8/8 | 8/8 |
| Test added | 8/8 | 8/8 | 8/8 | 8/8 |
| Last answer names a changed file | 8/8 | 8/8 | 8/8 | 8/8 |
| Last answer names the files and the build | 8/8 | 8/8 | 8/8 | 8/8 |

How to read this series:

- **Each of the three texts cost less than Claude Code alone.** `brief` -12.7% (p = 0.0006), `mini` -11.1% (p = 0.0053), `leanonly` -9.7% (p = 0.0022). Each cost less than `clean` in 8 blocks of 8.
- **No text is shown to differ from another.** `mini` against `brief` +1.9% (p = 0.6608), `leanonly` against `brief` +3.5% (p = 0.3368), `leanonly` against `mini` +1.6% (p = 0.7038): chance alone gives each often.
- **The eight lines read 3.5% higher than the single sentence "Be brief." here.** `leanonly` cost less than `brief` in 3 blocks of 8 and more in 5. In Series 8, on gin, they read 5.0% lower. Neither is shown: on neither project are the eight lines shown to beat "Be brief.".
- **The three reading lines added to "Be brief." are not shown to do anything.** `mini` cost less than `brief` in 4 blocks of 8.
- **Not shown is not "the same".** A difference of a few percent between two texts, either way, is not excluded by 8 runs an arm.
- **The eight lines saved 9.7% here, and 14.8% in Series 4 on the same task.** There the arm was `style` (the pet with the same eight lines), on another day, with Claude Code 2.1.323; here it is `leanonly`, with Claude Code 2.1.325, another mod and another runner. No series separates these, and the two must not be pooled or averaged. `clean` cost $3.649 there and $3.610 here.
- **The checks: 7 of 7 in 31 runs of 32.** The one that is not is run 5 of `mini`, 6 of 7: the project's tests fail on its own new test. Its `TestYoutubeID` (`internal/library/nfo_test.go`, 15 cases) has one case that the code as it is does not pass (`watch?dev=1&v=<id>` gives no id): a real limit of `youtubeID`, which reads only the first `v=`. The agent ran the test, saw it fail, said so in its answer, left the test file out of its commit (which only changes the function's comment, and names the limit) and offered to fix the function. The file is in the working tree, so the check, which runs the tests there, fails on that test and on nothing else. It is also the cheapest run of the arm ($2.650).

Limits of this series:

- One task, one project (the author's own), one model.
- One sentence and one mix of lines were tried. Other short instructions were not.
- That the text of `brief` and of `mini` reaches the system prompt is proven by the arms' own test (`bench/arms.test.mjs`) and, for `brief`, by a separate local probe, not in every run. What every run records is the plugin loaded alone, no hooks module that failed, and the length of the first prompt.
- The saving of a text is the saving on this session: long, read-heavy, about 65 to 70 requests. The short tasks were not run with these arms.
- Six pairs are compared: see How to read the tables.

To run it again ($106 when it was run, at list prices, and $12 more for a block cut by the usage limit; three hours with the wait: 32 Opus runs of `tour` do not fit in what was left of one 5-hour window):

```sh
node bench/run.mjs <out>/<name> --work tour --model claude-opus-5-5 --runs 8 --arms clean,brief,mini,leanonly --wait
node bench/report.mjs <out>/<name>
```

## An earlier series: `tour`, two arms, older style

The first series made with the bench. It is valid, and it measured a shorter style: 6 lines, without the two that protect tests and ask to declare what was skipped.

| | |
|---|---|
| Data | `<out>/opus` |
| Runs | 2026-11-11, 14:06 to 14:55 |
| Model, CLI, project | `claude-opus-5-5`, Claude Code 2.1.322, VodMax `v0.6.17` (`902e44e`) |
| Prompts hash | `2e5d9d71036354ed` (the same requests as Series 1) |
| Mod hash | `5e6f2a58c6126937` (style of 6 lines) |
| Runner hash | `0e42093a53505bef` |
| Go | not installed |
| Billed | $54.39 |

| Run | `clean` | `lean` |
|---|---|---|
| 1 | $3.800 | $3.286 |
| 2 | $4.071 | $3.204 |
| 3 | $3.643 | $3.149 |
| 4 | $3.443 | $2.946 |
| 5 | $3.487 | $3.431 |
| 6 | $3.579 | $2.977 |
| 7 | $3.813 | $2.959 |
| 8 | $3.657 | $2.945 |
| **Mean** | **$3.687** | **$3.112** |
| sd | $0.204 | $0.185 |

`lean` against `clean`: -$0.575, -15.6%, p = 0.0002. All 16 runs isolated, every request answered, commit made 8/8 in both arms. "Test added" reads 7/8 and 6/8: `docs/piano.md` records that the three patches were read and the test was there, added to an existing test file, which the check of that day did not see. That reading was not repeated for this page.

Command, as recorded in the working notes: `node bench/run.mjs <out>/opus --model claude-opus-5-5 --runs 8 --arms clean,lean`. The same caveats as Series 1 apply to running it today.

## What is proven

The first five points on one task (`tour`, a long read-heavy session), one project, Opus 5.5; the last on one task of a second project. What Series 5 and 6 add is in the next section: it is weaker.

- **The style saves.** Alone it cost 14.8% less than Claude Code alone (Series 4, p = 0.0014) and 11.6% less than the diet alone (p = 0.0039). Since 2026-11-13 this is what `/pet lean on` turns on in the mod.
- **`lean` costs less than Claude Code alone.** Three series, three mods, the same direction each time: -15.6% (earlier series, 6-line style, p = 0.0002), -14.0% (Series 1, p = 0.0002), -8.4% (Series 4, today's mod, p = 0.0137). The size is not settled: the figure for the mod as it is today is the last and smallest one, and its p is one of six pairs.
- **caveman and ponytail also cost less than Claude Code alone**: -12.0% and -11.5% (Series 1, p = 0.0003 each).
- **A single "Be brief." saves too, and the eight lines alone again.** In Series 9 `brief` cost 12.7% less than Claude Code alone (p = 0.0006), `mini` 11.1% less (p = 0.0053), `leanonly` 9.7% less (p = 0.0022). The eight lines saved less there than the 14.8% of Series 4: another day, another Claude Code version (2.1.325 against 2.1.323), the plugin alone instead of the pet.
- **The checks hold.** In Series 4 every arm passed every check in 8 runs of 8, the project's tests included. On `fix` and `short` every arm passed the project's tests and the formatting check in 8 runs of 8, and on `short` the hidden test too. Series 1 and the earlier series measured their saving without running the tests.

- **On gin, the eight lines alone and ponytail each cost less than Claude Code alone, and ponytail less than the lines** (Series 7, Opus 5.5, 8 runs an arm). `leanonly` -31.8% and ponytail -38.7% against `clean` (p = 0.0002 each), with every run of both at 6 defects of 6; ponytail against `leanonly` -10.0% (p = 0.0141, one of six pairs; -6.8% and not shown on the five blocks where no agent disturbed another). caveman cost more than both (p = 0.0002 each). The two savings against `clean` hold with or without the three disturbed blocks. One task, one model, a project the model knows: the size is that task's, not a general one.

## What reads the same way, with weaker evidence

On one task (`real`: six real defects to find and fix in one chat), one project.

- **Opus 5.5: the style read 12.4% lower** (Series 5, 8 runs an arm, p = 0.0485). Under 0.05 by very little, and it depends on one pair of runs: without block 8 the same report reads -10.6% with p = 0.0752, not shown.
- **Fable 5.2 at low effort: the style read 13.8% lower** (Series 6, p = 0.0238). Lower in each of the five blocks, and five runs an arm are few.
- **The work was done in both arms.** Every run answered the six requests, added tests, and left the project's tests passing, the tests as they were included. By the hidden tests every run of Series 5 and 6 fixed 6 defects of 6, except run 8 of `clean` in Series 5, which the bench reads as 1 of 6 because its fixes are on six branches; rebuilt by hand from the recorded edits, they fix all six (see Series 5).

Two readings in the same direction as Series 4, on different work and on a second model. Neither is strong alone, and they are not one experiment with Series 4.

## What is not proven

- **The size of the saving on `real`, and that there is one on Opus 5.5 beyond doubt.** See above: one result at the edge, one on five runs.
- **That the style changes how many defects get fixed**, either way. With all runs but one at 6 of 6, and that one a limit of the measure, the task as it is cannot show a difference.

- **That the diet saves anything.** Alone it read -3.6% (p = 0.3110): chance alone gives that often. It trimmed 11 outputs in 8 sessions. Eight runs do not exclude a small saving, and they do not show one.
- **That `lean` is better than the style alone.** In Series 4 `lean` read 7.5% dearer than `style` (p = 0.0563). Not shown either way; nothing measured supports turning the diet on for the sake of the bill.
- **A saving on short tasks.** On `fix` and `short` no arm is shown to cost less than Claude Code alone: the smallest p against `clean` is 0.0727. `lean` reads -5.4% and -11.3%, and chance alone gives that often. The style alone and the diet alone were never run on a short task.
- **An order among the lines, caveman and ponytail that holds across tasks.** On `tour` the three are within 2.9% of each other and no pair is shown to differ (p from 0.0578 to 0.7259). On `short` neither. On `fix` ponytail cost less than caveman (-21.6%, p = 0.0014) and `lean` read lower than caveman (p = 0.0148, one of six pairs): one task, 8 runs, and neither differs from `clean` there. On `gin` (Series 7, the only series with the lines alone beside the other two) ponytail cost less than the lines and both less than caveman. Nothing here supports "Cachito saves more than the other two": where a difference from ponytail is shown, it is ponytail that costs less.
- **That caveman saves on `gin`.** It read -9.6% against `clean` (p = 0.1021): chance alone gives that often.
- **That the eight lines save more than the sentence "Be brief."**, on either project. On `gin` they read 5.0% lower (Series 8, p = 0.5009), on `tour` 3.5% higher (Series 9, p = 0.3368): chance alone gives each often. Nor is it shown that they save the same: 8 runs an arm do not exclude a small difference either way. Series 8 has no `clean` arm, so what "Be brief." saves against Claude Code alone was measured in a paired way on `tour` only (-12.7%).
- **That the three reading lines add anything to "Be brief."** `mini` read 1.9% higher than `brief` (Series 9, p = 0.6608).
- **That a third is what the lines save elsewhere.** Series 7 is one task on a project the model knows; the VodMax series read 10% to 15%, on other work, with the pet loaded in all but Series 9.
- **Why `lean` reads lower in Series 4 than in Series 1.** The mod, the Claude Code version, the presence of Go and request 6 all changed between them. No series separates these.
- **The completeness and correctness of the explanations the agent gave.** The checks only cover what needs no judgement.

No series is running for these points.

## Limits

- **The series up to Series 4 wrote in the store of the person who started them.** Every run that loaded Cachito used the person's own store: it read the saved preferences (which is why the runner of those days refused to start with a lever on) and added its turns, tokens and sessions to that person's pet; the diet arms wrote their files in `~/.claude/cachito-out`. The costs in this page do not depend on the pet's counters. One thing is not checked: runs of one block shared that store and that folder while they ran. Since 2026-11-13 a run under the bench keeps all of it in memory and in the out dir (`CACHITO_BENCH`, see [METHOD.md](METHOD.md)): Series 5 and 6 ran with that protection.
- **What the clones of these series held beyond the pinned commit: seven commits, none of them a fix, none read.** Checked on 2026-11-14 on the copies of the project the runs were cloned from, which are still in the series' folders (Series 1 to 6: `opus5`, `s1/fix`, `s1/short`, `split`, `real-opus`, `real-fable-low`). In each, the project's branch `main` ended at the pinned commit `902e44e` (v0.6.17): the public `main` had not moved when they were cloned (11 to 13 November; it is at v0.6.18 since). Each also held seven commits that are not ancestors of `902e44e`: the tips of seven dependabot branches of 7 November 2026, which change two workflow files under `.github/workflows` and no code. A run's clone had no branch for them (a clone copies the local branches of its source, and the remote was removed), so they were there only as objects that no `git log` shows. The saved tool calls of all 154 runs were searched for a command that lists such objects, other branches, a reflog, or reads the folder the clones were made from: none did. The clones themselves were deleted after each run, so this is read from how git clones a folder and from the events, not from the clones. The six defects of `real` were found on 13 November and no fix of them was in any clone. Since 2026-11-14 the bench fetches the pinned commit alone and refuses a clone that holds any other (`bench/clone.mjs`); a series resumed in one of those old folders is refused until its `task` folder is deleted.
- **Two projects, both in Go.** Series 1 to 6 and Series 9 are on VodMax at one tag, Series 7 and 8 on gin at one tag. Five tasks on two Go projects say little about other languages or kinds of work.
- **The model knows gin** (Series 7 and 8). gin is one of the most used Go libraries and its code is in the training data of any model, so finding the place is easier than on VodMax; the reports name public concepts of the library, and the one for `methodnotallowed` carries the routes that reproduce it, as the public issue did. For a model trained up to June 2026, three of the six fixes are near that date (`copy`, `recovery` and `upload`: proposed between 4 and 11 June 2026, merged on 22 June; the report behind `upload` is of April) and three after it (`html`, `methodnotallowed`, `slowheader`: July to September). The clone holds nothing made after the pinned commit, but a model can recall a fix it was trained on. All four arms had the same model, so this bears on the size of a saving more than on its sign.
- **The sessions of a block share the machine's ports** (Series 7). gin's own tests bind six fixed ports. In blocks 3, 4 and 7 one agent's hung `go test` held them for minutes: the agents of the other arms saw those tests fail and spent requests on it, and the checks of seven runs failed on them (they pass alone: see the series). The checks are now run after every session of the block has ended; the sessions still run together, and nothing keeps one agent's tests from another's ports. The pairs of that series read on the other five blocks are given there. In Series 8, with the checks after the block, three runs of 16 still saw those tests fail during their sessions.
- **Two models, unevenly.** Every series is on Opus 5.5, except Series 6: Fable 5.2 at low effort, one task, 5 runs an arm. Series 7, 8 and 9 are on Opus 5.5 alone.
- **The bench reads only the branch a run ends on.** The checks and the saved patch are taken from `HEAD` and the working tree when the session ends. A run that puts its commits on other branches is read as not having made them: it happened twice, run 8 of `clean` in Series 5 and run 1 of `caveman` in Series 7; both were rebuilt by hand from the recorded calls and fix 6 of 6. No request of the tasks says where to commit.
- **A resumed series records the mod and the runner of its last resume.** The mod is copied again and `manifest.json` rewritten at every start. Series 5 and 6 were resumed several times: that the mod was the same throughout is not recorded (the 364 tokens the style adds to the first prompt are the same in every run).
- **What 8 runs can see.** On the short tasks the cost of equal runs varies a lot (sd from $0.044 to $0.083 on means near $0.50): there, differences of 11% to 13% against `clean` came out with p from 0.07 to 0.09. With 8 runs an arm the floor is about 12%. In Series 4 a 7.5% difference on `tour` came out with p = 0.0563.
- **Series are not comparable with each other.** Each one is a comparison among its own arms, started together. Series 1 and Series 4 differ in mod, Claude Code version, Go and one request; their `clean` arms are not the same baseline. Series 4 and Series 9 share the task and its requests and differ in day, Claude Code version, mod and runner.
- **The thresholds are not measured.** The pet counts a chat as long once its context has grown by 40k tokens since its first request, or since the first after a compaction (`RULES.heavyGrowth` in `engine/engine.js`), and holds a mid-chat style switch back once it has grown by 15k (`STYLE_SWITCH_UNDER` in `hooks/register.js`, `SWITCH_UNDER` in `briefox/hooks/register.js`). Until 17 November 2026 the two were sizes, 60k and 30k of context, which called every chat of the desktop app long from its first turn; the growths are those sizes less the 17k a chat of the bench started at. Both were chosen, not measured: no series compares chats on either side of them.
- **The style of the day.** Series 1 to 9 used the 8-line style, the same text throughout (for Series 5 and 6: the text in the copy of the mod left by the last resume equals that of Series 4; for Series 7: the text in `<out>/gin-opus/lean/style.js` is the same, byte for byte; for Series 8: the eight lines in `<out>/gin-brief/lean/style.js` are the same, and the file has one more constant, which is not sent; for Series 9: `<out>/tour-mini/lean/style.js` is the file of Series 8, byte for byte). Only the earlier two-arm series used the 6-line style. The rest of the mod, the diet's code included, changed between Series 1 to 3 (hash `ca23c928fd00aaba`) and Series 4 (`e3ce4fbc977c8531`). The short tasks have not been run with the later mod.
- **Series 1 ran without Go.** The agent was told not to run its test, and a quarter of the runs (8 of 32) ended without a commit. Series 4 does not have this limit.
- **Mixed conditions inside a series.** Run 8 of Series 1 ran five hours after runs 1 to 7. Runs 7 and 8 of `fix` ran after a restart; the working notes say they used a shared Go build cache and runs 1 to 6 did not. In those cases all four arms of a run started together. In Series 4 run 6 of `diet` was redone alone, about an hour after the other three arms of run 6.
- **The budget lever was never in the bench, and is gone.** A headless session cannot compact on the mod's request. `/pet budget` and the automatic compaction were removed from the mod on 2026-11-13.

## Void runs

Runs that were billed and do not count, and why.

**Series 1, first attempt at run 8.** A usage limit ("You've hit your 5-hour limit") stopped all four sessions before the last request. Saved as `*.failed.json` in `<out>/opus5`: `clean` $2.406, `lean` $2.656, `caveman` $2.696, `ponytail` $2.414, $10.17 in all. Run again on resume.

**Series 4, `diet` run 6, three attempts.** `<out>/split.log` shows the usage limit ("You've hit your 5-hour limit") stopping `diet` run 6 three times: the first attempt was billed $3.7471 and passed 4 checks of 7, the next two, 15 minutes apart, were billed $0.0000 with no session. Each attempt overwrote the same `diet-6.failed.json`, so only the last ($0) is on file and the $3.7471 is in the log alone. The other three arms of run 6 had finished and count. The fourth attempt is the run counted. This is one run stopped three times, not three runs.

**Series 5, first attempt at run 2.** A usage limit ("You've hit your 5-hour limit") stopped both sessions mid-chat. `<out>/real-opus.log` shows them billed $1.8753 (`clean`, 7 checks of 12) and $1.4618 (`style`, 8 of 12): $3.34 in all. Five more attempts, 15 minutes apart, were refused at once and billed $0.0000; each overwrote the same `clean-2.failed.json` and `style-2.failed.json`, so only the last ($0) is on file and the two amounts are in the log alone. The seventh attempt is the pair counted. Series 6, 7 and 8 have no void run.

**Series 9, first attempt at run 4.** A usage limit ("You've hit your 5-hour limit") stopped all four sessions at request 8 of 10. Saved as `*-4.failed.json` in `<out>/tour-mini`: `clean` $3.049, `brief` $2.664, `mini` $2.890 (3 checks of 7 each), `leanonly` $3.148 (4 of 7), $11.75 in all. The bench waited 15 minutes and ran the whole block again: those four are the runs counted.

**`opus4`, the first attempt at four arms** (`<out>/opus4`, 2026-11-11, 17:46 to 18:01). The usage limit hit during run 1; the runner of that day did not stop and saved 32 result files. Run 1 was billed $0.906, $0.240, $0.798 and $0.261; runs 2 to 8 are $0.000 with no session at all. $2.20 in all, no run answered every request.

**Series 2, first attempt at runs 7 and 8; Series 3, first attempt at run 1** (`<out>/s1/void`, 2026-11-12, 06:44 to 07:30). The Go build cache filled the disk (`No space left on device` in `<out>/s1.log`), so the project's tests failed in every arm alike.

| Run | `clean` | `lean` | `caveman` | `ponytail` |
|---|---|---|---|---|
| `fix` 7 | $0.690 | $0.779 | $0.901 | $0.699 |
| `fix` 8 | $0.642 | $0.580 | $0.720 | $0.549 |
| `short` 1 | $0.382 | $0.354 | $0.355 | $0.376 |

$7.03 in all. Run again after the bench got its own bounded cache.

**Everything measured before the bench existed** (a folder of hand-made runs, 2026-11-11, 3 runs per arm, a hand-written driver). The `init` event of each run shows what was loaded:

| Arms | Model | Costs | Mean | Loaded besides the arm |
|---|---|---|---|---|
| `plain` | Haiku 5.5 | $0.583 $0.566 $0.617 | $0.589 | caveman, ponytail, and the machine's other plugins, skills and MCP servers |
| `cap` (compaction at 90k) | Haiku 5.5 | $0.228 $0.221 $0.259 | $0.236 | the same |
| `keep` (same, with instructions) | Haiku 5.5 | $0.225 $0.231 $0.225 | $0.227 | the same |
| `budget` (the mod's own budget) | Haiku 5.5 | $0.621 $0.653 $0.660 | $0.645 | the same |
| `oplain` | Opus 5.5 | $3.546 $3.306 $3.427 | $3.426 | the same |
| `ocap` (compaction at 90k) | Opus 5.5 | $3.879 $3.761 $3.603 | $3.748 | the same |
| `clean` | Opus 5.5 | $3.859 $3.815 $4.066 | $3.913 | the machine's other plugins and skills, MCP servers in 5 runs of 6 |
| `lean` | Opus 5.5 | $3.586 $3.851 $3.595 | $3.677 | the same |

Why they are void:

- **caveman and ponytail were loaded in both arms** of every row down to `ocap`. A difference there holds "with caveman and ponytail on", not for someone who installs Cachito alone.
- All ran in folders under the home folder of the machine, so that folder's own `CLAUDE.md` was in every session.
- Three runs per arm: the smallest p a permutation test can give is 0.1.
- The context cap was applied by the driver with `/compact`, not by the mod: a headless session cannot compact on the mod's request. `budget`, the mod's own lever, therefore measured nothing.

What had been read into them, and must not be quoted:

- **"The budget saves 60%"**: `cap` against `plain` on Haiku 5.5, -60.0%. Void as above, and the working notes attribute most of it to a price step of Haiku at 100k tokens of prompt.
- **"The budget costs 9% more on Opus"**: `ocap` against `oplain`, +9.4% ($3.748 against $3.426). Void for the reasons above, and not a reason for anything: it has not been measured cleanly, and the bench cannot measure it. `/pet budget` and the automatic compaction were removed from the mod on 2026-11-13 because no valid run showed that they pay, and because a sum on paper from the price list said that on a large model a compaction costs more than the re-reads it spares. That sum is an estimate, not a measurement.
- **"caveman plus ponytail save 12%"**: `oplain` against `clean`, -12.5%. Runs made hours apart, in different environments.
- **"Diet and style save 6%"**: `lean` against `clean`, -6.0%, superseded by the bench series above.

**Runs of 2026-11-10** (16 folders `<tmp>/cachito-real-plain-*` and `cachito-real-rules-*`): Haiku, a block of rules in `CLAUDE.md` that no longer exists in the mod. The working notes record no saving (p = 0.31). Their costs were not read again for this page.

**Pilots.** `pilot`, `haiku`, `pilot4`, `p-fix`, `p-short`, `p2-short`, `p-split` and `gin-brief-pilot` under `<out>` are one run per arm on Haiku 5.5, made to try the bench itself. They are not evidence of anything. In `pilot` the first prompt of `lean` equals that of `clean` (18567 tokens): the copy of the mod did not load, which is why the bench now validates it before starting.
