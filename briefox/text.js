// @ts-check
// What the two plugins of this repository add to the system prompt, and the one place it is written.
// briefox (this folder) sends it as installed; the pet (the repository's root) sends it with /pet briefox on.
// It is the text the bench arm `brief` was measured with (bench/arms/brief; bench/arms.test.mjs holds the two equal).

// One id for both plugins: whichever composes second finds the section there and adds nothing.
export const ID = 'briefox'

// The whole section: no heading, no list.
export const TEXT = 'Be brief.'

// What the bench showed of that sentence (bench/RESULTS.md, Series 9), and the one place the figure is written in English:
// /briefox, /pet briefox, the pet's card and its note all say this sentence.
export const BENCH = 'In our bench "Be brief." made a long task cost 12.7% less, on one project; short tasks were not measured'
