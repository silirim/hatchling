# Long chat

Every request re-reads the whole conversation. Past about 60k tokens of context, that re-read is most of the bill.

What our bench measured (`bench/RESULTS.md`, Series 9, Opus 5.5, 8 runs per arm): on one long task the single sentence `Be brief.` in the system prompt (the `brief` arm) cost 12.7% less (p 0.0006) and passed the same checks. It was not run on a short task. Your chats may differ.

- `/pet briefox on` adds that sentence to the system prompt, and nothing else. It stays on for the next chats.
- In a chat that is already long the sentence waits for the next compaction or the next chat: switching at once would re-send the whole conversation, which costs more than the sentence saves for a long while. Meanwhile the note goes: you did your part. The pet cheers when the sentence is in.
- It is advice and nothing more: the pet loses nothing in a long chat without briefox, and gains nothing from briefox either.
