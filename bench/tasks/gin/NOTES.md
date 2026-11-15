# Task `gin`: six real defects of gin-gonic/gin v1.12.0

- Repository: https://github.com/gin-gonic/gin (about 89.5k stars on 2026-11-14). Licence: MIT (`LICENSE`: "The MIT License (MIT) Copyright (c) 2014 Manuel Martínez-Almeida"; GitHub API spdx_id MIT).
- Commit C: `73726dc606796a025971fe451f0aa6f1b9b847f6`, tag `v1.12.0` (2026-02-28). go.mod: `go 1.25.0`; tested with Go 1.27.3. Pure Go, no cgo, no services; the tests use only loopback.
- Run with: `node bench/run.mjs <out> --work gin ...`: `task.json` names the repository and the commit. Proof fixes are outside the task folder: `/var/tmp/cachito-bench/public-task/out/fixes/` (for `--dry --fixes`).

## The six defects (all hidden tests in package `gin`, repository root, `dir: "."`)

| id | upstream fix | PR opened / merged | issue | hidden test |
|---|---|---|---|---|
| copy | 293ad7e `fix(context): Copy() copies Errors and Accepted fields` | #4695, 2026-06-04 / 06-22 | - | `TestAcceptCopy*` |
| recovery | 4a3eb31 `fix(recovery): record recovered panics in c.Errors` | #4698, 2026-06-09 / 06-22 | - | `TestAcceptRecovery*` |
| upload | d9307db `fix(context): skip chmod on pre-existing dirs in SaveUploadedFile` | #4702, 2026-06-11 / 06-22 | #4622 (2026-04-07) | `TestAcceptUpload*` |
| html | 5c6a15f `fix(context): handle missing HTML renderer` | #4805, 2026-08-11 / 09-16 | - | `TestAcceptHTML*` |
| methodnotallowed | 3b08cd7 `fix: reset skipped-nodes stack on getValue entry ...` | #4819, 2026-08-27 / 09-19 | #4818 (2026-08-27) | `TestAcceptMethodNotAllowed*` |
| slowheader | d8f2d58 `fix(engine): add default ReadHeaderTimeout ...` | #4800, 2026-08-08 / 09-19 | #4760 (2026-07-25) | `TestAcceptSlowHeader` |

Each `fix-<id>.diff` is the non-test part of the upstream commit, applied with no change to C (context lines rebased by `git apply -3`). Files touched: copy and upload `context.go` (different functions: `Copy`, `SaveUploadedFile`), html `context.go` (`HTML`) and `render/html.go`, recovery `recovery.go`, methodnotallowed `tree.go`, slowheader `gin.go`. The six apply together in any order.

Hidden tests are the upstream regression tests, made self-contained (only `CreateTestContext` from `test_helpers.go`, testify, httptest) and loosened where the upstream test fixed an implementation choice:
- html: upstream asserts the exact message `html renderer is not configured` and the status kept; here only "no panic, and an error on `c.Errors`" (engine without Recovery, so the recovery defect cannot make it pass).
- recovery: the error text must contain the panic value; the error type is not checked.
- upload: the upstream test (pre-existing dir keeps 0700) plus one case that a newly created dir still gets the perm asked for (the original suite asserts that too).
- slowheader: not the upstream test (that one reads a new field `ReadHeaderTimeout` and a private getter). Behavioural: a TCP client sends unfinished headers to a server started by `RunListener` and by `Run`; the server must close it within 65 s. Any timeout up to a minute passes; a fix only in `RunTLS` would not.

## Proof (`prove.sh`, 2026-11-14)

```
. env.sh   # PATH with Go 1.27, GOCACHE/GOMODCACHE under /var/tmp/cachito-bench/public-task, GOFLAGS=-p=2
cd repo; cp ../out/task/accept_<id>_test.go .; go test . -run '^TestAccept<Id>' -count=1   # fails
git apply ../out/fixes/fix-<id>.diff; go test . -run '^TestAccept<Id>' -count=1            # passes
```
Result: every test fails at C for the reported reason (empty copy; no error recorded; dir chmod'd to 0755; nil pointer panic; `slice bounds out of range [:7] with capacity 6`; connection open after 65 s) and passes with its fix. All six fixes + six hidden tests + `go test ./...`: ok; all six fixes with the original suite: ok; suite at C: ok. `go test ././` (the form run.mjs uses for `dir: "."`) works.

Times on this machine (-p=2): `go test ./...` cold 32 s (with module download), warm 2 s; `-race ./...` cold 51 s. Each hidden test about 2 s, except slowheader: 12 s when fixed, 65 s when not (130 s with run.mjs' retry). Disk: Go build cache 917 MB after plain + race builds, module cache 170 MB, clone 13 MB.

## The environment of the bench against gin's own tests (found on 2026-11-14, after a pilot)

A pilot of one run an arm on Haiku (`/var/tmp/cachito-bench/p-gin`) fixed 6 of 6 in both arms and failed `testsPass`, `formatted` and `originalTests` in both. Three causes, none of them the agent's:

- **`GOFLAGS=-trimpath`**: at C, untouched, `go test ./...` fails in `TestCustomRecovery`, `TestCustomRecoveryWithWriter`, `TestRecoveryWithWriterWithCustomRecovery` and `TestPanicInHandler`, which look for file paths in a stack. `task.json` now has `"trimpath": false`: the agent and the checks get `GOFLAGS=-p=2`. The build cache without it: 563 MB warmed, 37 MB for each further clone (measured, no model).
- **gofmt of Go 1.27** lists `binding/binding_nomsgpack.go` at C. `formatted` now counts only files listed beyond those listed at C.
- **umask**: `TestSaveUploadedFileWithPermission` saves a file with mode 0755 in the package folder and then asserts that the folder itself is 0755. At C that holds on any machine, because the defect `upload` is exactly that `SaveUploadedFile` chmods the folder. With the defect fixed it holds only when the clone's folder was made 0755, that is under umask 022; this machine's shell has 002 (folders 0775), and the test then fails on every correct fix. The sentence above, "all six fixes with the original suite: ok", was true in a folder where the suite had already been run on the defect, which had chmod-ed it. `run.mjs` now sets umask 022 for itself, the clones, the agent and the checks.

`--dry --fixes` now also runs the checks of a run on the fixed code. Result on 2026-11-14 with the six upstream fixes: 617 packages and tests pass at C; the six hidden tests fail at C and pass with the fixes; with the fixes everything that passed at C still passes and gofmt lists nothing more.

## What could bias a cost comparison

- **The fixes were in the clone; closed on 2026-11-14.** A whole clone with C checked out leaves the branch `master` at the tip: `git log master` showed the six upstream fixes with their titles. `bench/clone.mjs` now fetches C alone into the copy the runs are cloned from (its ancestors and the tags on them, one branch `master` ending at C) and `run.mjs` refuses a clone that holds any other commit, at every start and for every run.
- **Training data** (cutoff June 2026): issue #4622 (upload) is from April 2026, before it; PRs copy, recovery and upload were opened 4-11 June 2026 and merged 22 June, at the edge; html, methodnotallowed and slowheader (issues and PRs July-September 2026) are after it. gin itself is very well known, so the model knows its code well: unlike VodMax.
- The reports name public concepts of the library (copy of the context, recovery, templates, 405 handling, starting the server), so finding the place is easier than on VodMax; the methodnotallowed report includes the reproducing routes, as the upstream issue did.
- Network: closed on 2026-11-14. `run.mjs` downloads the modules once into `<out>/gomodcache` before the runs, and the runs have `GOPROXY=off`.
- Rejected candidates: d75fcd4 (Hijack/CloseNotify panic, #4645): its fix inverts an existing test that asserts the panic, so the `originalTests` check would fail every correct fix. ea9fab9 (#4852): same function as methodnotallowed, fixes overlap. 1bd0ecf (#4854): shows only under `-race`.
