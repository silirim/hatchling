#!/bin/sh
# The full comparison: every task in bench/tasks, four arms, on one model. Waits out usage limits and resumes; run it again to resume by hand.
# Usage: bench/series.sh <out root> <caveman dir> <ponytail dir> [model] [runs] [tasks]
root=$1; model=${4:-claude-opus-5-5}; runs=${5:-8}
for work in ${6:-fix short tour}; do
  node "$(dirname "$0")/run.mjs" "$root/$work" --work "$work" --model "$model" --runs "$runs" --arms clean,style,caveman,ponytail --caveman "$2" --ponytail "$3" --wait || exit 1
  node "$(dirname "$0")/report.mjs" "$root/$work" > "$root/$work.report.txt"
done
