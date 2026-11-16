# Context almost full

The context window is nearly full. Claude Code will compact on its own soon, maybe in the middle of a task. Hatchling shows it as a note: it costs the pet nothing.

## What to do

1. Press **fix** in the band, then Enter: it runs `/compact`.
2. Or type `/compact keep the open task and the failing test` to choose what survives.
3. Starting something unrelated? Use `/clear`.

`/compact` is here to keep room in the window, not to save money. Hatchling never compacts on its own: in our A/B on Opus 5.5 compacting at a threshold cost 9% more (3 runs per arm, not a clean measure).
