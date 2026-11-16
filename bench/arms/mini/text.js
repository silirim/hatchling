// @ts-check
// The bench arm `mini` (bench/run.mjs): "Be brief." plus only the habits that sentence does not cover, how the agent reads. This file
// is all that tells it from the other arms of this folder: the section's id and its whole text. The three reading lines are those of
// ../leanonly/text.js, word for word (bench/arms.test.mjs): against `leanonly` the arm differs only by what is left out.
export const ID = 'bench:mini'
export const TEXT = `# Working lean
- Be brief.
- Send independent read-only calls (reads, searches, listings) together in one message: every message of yours re-reads the whole conversation.
- Use what is already in context instead of reading an unchanged file again. In a long file, search for the part you need and read that range.
- Prefer commands whose output is bounded (a filter, a count, a head or tail) over printing whole files and logs.`
