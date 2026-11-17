# Comments

On as installed. A small model writes one short line in the pet's character: a reaction to what just happened in the turn. Each line is a request on your own tokens, and sends what is listed below.

`/pet comments off` stops them: the pet then says fixed lines only and no model is asked. `/pet comments on` brings them back. `/pet comments` shows your own figures.

The pet says so once, right after it hatches, in a notice that stays in the bubble until you do something: comments are on, what a line costs, and the command that stops them. It has one button, `turn off`. No comment is asked for before that notice has been in front of you. Never in a headless run.

A choice you already made stands: if you answered `stay quiet` in an earlier version, or ran `/pet comments off`, they stay off, and a pet you import keeps its own setting.

## What it costs

- Each line is one request to a small model, through Claude Code's own client, on your own tokens. The model is the alias `haiku` unless you choose another: `/pet model`, below.
- Measured in November 2026: about 650 tokens in and 75 out a line, the average of the 112 lines in our own store (72,880 in, 8,563 out).
- The line itself is about 12 tokens. The rest of the 75 out is the model's thinking: a mod cannot switch it off, it can only ask for low effort, and Hatchling does.
- The recap after a pause is a larger request: about 1,300 to 2,000 tokens in and 570 to 750 out a recap, measured on three recaps on 16 November 2026. Nearly all of the tokens out are the model's thinking.
- At most 40 lines a day over all your chats.
- The cost is said in tokens, as each call reports them. In November 2026 that was under one cent a day at Haiku 5.5's list price. If `haiku` leads to another model on your account, or you chose another with `/pet model`, the money differs.
- A call that fails, or whose line is not shown, is paid and counted all the same.
- `/pet comments` shows your measured tokens a line, the lines left today, and the tokens spent today and in all.

## The model

- `/pet model` shows the model in use. As installed it is the alias `haiku`, which Claude Code resolves.
- `/pet model <alias or id>` sets another: an alias (`sonnet`) or a full model id. Only its shape is checked (one word, letters, digits and `. _ : / @ - [ ]`, at most 100 characters); whether there is such a model is Claude Code's to say.
- A larger model costs more tokens per line.
- `/pet model default` goes back to `haiku`.
- The card, `/pet comments` and `/pet help` show the model in use.

## If the model goes away

- The pet never switches model by itself.
- When a call fails because the model is not available (Claude Code refuses it as blocked or unknown, or the API answers that there is no such model), the pet stays silent, as for any failed call, and tells you in a toast, once a day: `the model <name> did not answer. Choose another with /pet model.`
- Any other failure (the network, an overload, a call out of time) stays silent.
- Until you choose another, each call that fails is still counted in the day's 40 lines; it uses no tokens.

## What is sent

A summary of the turn made on your machine: tool names and counts, the program names of commands that failed, how many files changed, and **the last 600 characters of the assistant's reply**, as they are. With it the pet's character, its last two lines, at most three lines of the diary, and the name you told it with `/pet call me`, when you told one.

Never the content of a file, the output or arguments of a command, a file path, or your prompts to the assistant. The one exception is the recap, below.

The complete list: [privacy.md](privacy.md). With comments off none of it is sent.

## When it speaks

- At the end of a turn, at most one line every 10 minutes.
- Sooner when a command or a test failed, when the turn changed 5 files or more, and when you pet it.
- During a turn that has run for 10 minutes.
- Never while the prompt box holds text, never with the band hidden, never in a headless run (`claude -p`).
- It never blocks: a call that takes more than 4 seconds is dropped and the fixed line stays.

A line is shown only if it is at most 60 columns wide and names no file or path.

## Where we left off

When you come back to a chat after a pause, the pet says once where the work got to and what is left: `yesterday: parser tests are green, the README is still to do. shall we go on?`

- A pause is 30 minutes after a turn ended with no new prompt. In a chat left open the line comes when they pass; in a chat closed and resumed, at the start.
- One recap per pause while the chat stays open. A chat closed and resumed gets one at each resume, also for a pause already recapped: the line was in memory only and went with the chat. It stays in the bubble until your next prompt, and the time word is worked out when it is drawn, so it is still right the day after.
- **What it sends, each time**: up to 16,000 characters of the last turn's text (what the assistant wrote, the newest kept; nothing a tool was given or answered) and the first 300 characters of your last prompt. The two together are never more than 16,000.
- It counts in the day's 40 lines and in the tokens like any other line. It is a larger request than a comment: about 1,300 to 2,000 tokens in and 570 to 750 out, measured on three recaps on 16 November 2026.
- Nothing of it is kept on disk: not what is sent, not the line. The chat's mark keeps only the time of the pause it was made for, so that an open chat is not asked twice.
- A turn that was interrupted is told as stopped midway, not as finished.
- It may be up to 120 columns wide and may name a file. The model is asked for 100 characters at most; a longer line is cut at the last whole word that fits and ends with an ellipsis, never thrown away. If the call fails, takes more than 20 seconds or answers nothing with a word in it, the pet stays silent.
- With comments off no recap is made and nothing is read.

## Talking to the pet

`/pet say <text>` speaks to the pet; it answers in its bubble with one line.

- With comments on, the first 300 characters of your text go to the small model. It counts in the day's 40 lines.
- It is not a turn of the chat: neither your words nor the answer enter the chat's context, and your text is not kept.
- With comments off no model is asked: the pet says a fixed line.
- The pet gives no technical advice and does no work: that is the assistant's job, and it says so.
- At the day's cap it says so (`comments sold out today. restock tomorrow`).
