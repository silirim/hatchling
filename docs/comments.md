# Comments

Off by default. As installed the pet says fixed lines only and no model is asked.

`/pet comments on` lets a small model write one short line in the pet's character: a reaction to what just happened in the turn. `/pet comments off` goes back to the fixed lines. `/pet comments` shows your own figures.

The pet asks once, right after it hatches, with two buttons: `comments on` and `stay quiet`. Unanswered, comments stay off and it does not ask again.

## What it costs

- Each line is one request to a small model (the alias `haiku`), through Claude Code's own client, on your own tokens.
- About 600 tokens a line: 567 in and 19 out, the average of 12 live lines on 13 November 2026.
- At most 40 lines a day over all your chats.
- The cost is said in tokens, as each call reports them. In November 2026 that was under one cent a day at Haiku 5.5's list price. If `haiku` leads to another model on your account, the money differs.
- A call that fails, or whose line is not shown, is paid and counted all the same.
- `/pet comments` shows your measured tokens a line, the lines left today, and the tokens spent today and in all.

## What is sent

A summary of the turn made on your machine: tool names and counts, the program names of commands that failed, how many files changed, and **the last 600 characters of the assistant's reply**, as they are. With it the pet's character, its last two lines, at most three lines of the diary, and the name you told it with `/pet call me`, when you told one.

Never the content of a file, the output or arguments of a command, a file path, or your prompts to the assistant.

The complete list: [privacy.md](privacy.md). With comments off none of it is sent.

## When it speaks

- At the end of a turn, at most one line every 10 minutes.
- Sooner when a command or a test failed, when the turn changed 5 files or more, and when you pet it.
- During a turn that has run for 10 minutes.
- Never while the prompt box holds text, never with the band hidden, never in a headless run (`claude -p`).
- It never blocks: a call that takes more than 4 seconds is dropped and the fixed line stays.

A line is shown only if it is at most 60 columns wide and names no file or path.

## Talking to the pet

`/pet say <text>` speaks to the pet; it answers in its bubble with one line.

- With comments on, the first 300 characters of your text go to the small model. It counts in the day's 40 lines.
- It is not a turn of the chat: neither your words nor the answer enter the chat's context, and your text is not kept.
- With comments off no model is asked: the pet says a fixed line.
- The pet gives no technical advice and does no work: that is the assistant's job, and it says so.
- At the day's cap it says so (`comments sold out today. restock tomorrow`).
