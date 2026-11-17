# Long chat

Every request re-reads the whole conversation. Once a chat has grown by about 40k tokens, that re-read is most of the bill.

Long is what a chat grew by, not where it started. The first request of a chat already carries the system prompt and the tool definitions: in the desktop app, or with many MCP servers and skills, that is 60k tokens and more before a word is said, and it is no conversation. The pet takes the first request of a chat (after a compaction, the first one after it) as the start, and calls the chat long when a request re-reads 40k more than that. A chat resumed here starts from the first request the pet sees.

What our bench measured (`bench/RESULTS.md`, Series 9, Opus 5.5, 8 runs per arm): on one long task the single sentence `Be brief.` in the system prompt (the `brief` arm) cost 12.7% less (p 0.0006) and passed the same checks. It was not run on a short task. Your chats may differ.

- `/pet briefox on` adds that sentence to the system prompt, and nothing else. It stays on for the next chats.
- In a chat that has already grown (by 15k tokens or more) the sentence waits for the next compaction or the next chat: switching at once would re-send the whole conversation, which costs more than the sentence saves for a long while. Meanwhile the note goes: you did your part. The pet cheers when the sentence is in.
- It is advice and nothing more: the pet loses nothing in a long chat without briefox, and gains nothing from briefox either.
