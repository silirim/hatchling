# Long chat

Every request re-reads the whole conversation. Past about 60k tokens of context, that re-read is most of the bill.

What our bench measured (`bench/RESULTS.md`, Series 4, Opus 5.5, 8 runs per arm): on one long task the style alone (the `style` arm) cost 14.8% less (p 0.0014) and passed the same checks. The two short tasks were run in an earlier series with the style and the diet together, never the style alone: no saving was shown there. Your chats may differ.

- `/pet lean on` turns on the style, a few lines added to the system prompt. Lean is the style and nothing else. It stays on for the next chats.
- In a chat that is already long the style waits for the next compaction or the next chat: switching at once would re-send the whole conversation, which costs more than the style saves for a long while. Meanwhile the note goes: you did your part. The pet cheers when the style is in.
- It is advice and nothing more: the pet loses nothing in a long chat without lean, and gains nothing from lean either.
