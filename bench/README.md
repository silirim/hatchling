# Bench

An A/B of what a plugin does to the bill: the same requests, on the same commit of a project, with and without the plugin. What our series showed: [RESULTS.md](RESULTS.md). How the arms are kept comparable: [METHOD.md](METHOD.md).

## What it costs

**Every run is a real, billed Claude Code session.**

| Task | One run on Opus 5.5 | A series we ran |
|---|---|---|
| `tour` | $3 to $4 | 32 runs, about $108 |
| `real` | about $3.15 | 16 runs, $50 |
| `gin` | about $1.92 | 32 runs, $62 |
| `fix`, `short` | about $0.50 | |

On a subscription the runs come out of your usage limit: 32 Opus runs of `tour` use up a 5-hour window. `--wait` waits out a usage limit and then **starts spending again by itself**, for as long as runs are left.

## What you need

- Node 20, git, and the `claude` CLI logged in.
- Go and `gofmt` on the `PATH`: the checks run `go test` and `gofmt`, so the project must be a Go project.
- An out dir with no `CLAUDE.md` or `AGENTS.md` in any folder above it. The bench refuses to start otherwise.
- About 8 GB of free disk for the build cache.

## Run it

```sh
# free: no model. Checks that the task is sound at its commit
node bench/run.mjs <out dir> --work gin --dry

# billed: 5 runs of each arm
node bench/run.mjs <out dir> --work gin --runs 5 --arms clean,leanonly

# free: reads the files and prints the report
node bench/report.mjs <out dir>
```

| Option | Meaning | Default |
|---|---|---|
| `--work <task>` | a folder of `bench/tasks/` | `tour` |
| `--arms a,b` | what to compare, see below | `clean,style` |
| `--runs <n>` | runs of each arm | 5 |
| `--model <id>` | the model | `claude-opus-5-5` |
| `--effort <level>` | passed to the CLI | the CLI's own |
| `--task <git url or path>`, `--ref <commit>` | the project and its commit | the task's own |
| `--caveman <dir>`, `--ponytail <dir>` | the folders of those plugins, for their arms | |
| `--wait` | wait out a usage limit and resume | off |
| `--dry` | check the task, bill nothing | off |

| Arm | What is loaded |
|---|---|
| `clean` | Claude Code alone |
| `leanonly` | the cachito-lean plugin alone |
| `style` | the pet with `/pet lean on` |
| `caveman`, `ponytail` | that plugin alone |

Use one out dir for each task, model and effort. A stopped series resumes with the same command. A long series outlives the terminal only as its own service (`systemd-run --user ...`).

**How many runs.** The cost of equal runs varies by 4% to 9%. 5 an arm is the least that can show a difference of about 10%; take 8 for a smaller one.

## On your own project

The built-in tasks ask about their own projects (VodMax, and gin-gonic/gin for `gin`). For yours, write a task: a folder in `bench/tasks/` with two files.

`prompts.txt`: the requests, one on each line, sent in order to one session.

`task.json`:

```json
{ "about": "what the session does",
  "task": "https://github.com/you/project.git", "ref": "<full commit id>",
  "commits": 1, "testAdded": true, "originalTests": true }
```

- `commits`: how many commits the requests ask for.
- `testAdded`: a test must be added.
- `originalTests`: the tests as they were must still pass on the changed code.

The project's tests must pass at that commit: `--dry` checks it for free. Hidden tests and the other keys: [METHOD.md](METHOD.md).

## Read the output

`report.mjs` prints one block for each arm, then every pair of arms:

```
clean: 8 runs
  cost $2.494 $2.151 $2.564 $2.513 $2.621 $2.590 $2.392 $1.910  mean $2.404 sd $0.250
  answered 8/8, committed 8/8, testsPass 6/8, formatted 7/8, testAdded 8/8, ...; commits 6 7 6 6 6 6 6 6
  defects fixed of 6, by the hidden tests: 6 6 6 6 6 6 6 6  mean 6.00

leanonly against clean: -$0.766 (-31.8%), permutation p = 0.0002 over 8+8 runs: a difference this large is unlikely by chance
```

(Series 7 of [RESULTS.md](RESULTS.md), shortened.)

- **cost**: what the CLI billed for each session (`total_cost_usd`), then the mean and the spread.
- **The checks** (`8/8`): in how many runs every request was answered, the commits were made, the project's tests still pass, the code is formatted, a test was added. A saving with failed checks is not a saving.
- **defects fixed**, for `real` and `gin`: how many of the six each run fixed, by tests the agent never saw.
- **a against b**: the difference of the mean costs, and `p` from an exact permutation test. Over 0.05 nothing is shown: do not quote the percentage. With several pairs, one p just under 0.05 is weak evidence.
- **`left out`**: a run that had something else loaded or did not finish is not counted, and the report says which.
- **`WARNING`**: the plugin's lines were not in the prompt. The arm measured nothing.

In the out dir: `manifest.json` (model, CLI version, commit, hashes), and for each run `<arm>-<n>.result.json` (cost, checks, answers), `<arm>-<n>.events.jsonl` (the raw events) and `<arm>-<n>.patch`. A run that did not finish is `<arm>-<n>.failed.json`.

## What it cannot tell you

- The sessions have no person in them: a saving in your own chats is not shown.
- One task on one project says little about other work.
- The runs of a block share the machine: tests that bind fixed ports disturb each other.
