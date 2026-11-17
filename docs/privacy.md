# What Hatchling keeps and what it sends

## What is sent

**As installed, comments, and nothing else.** But for comments, neither plugin sends anything anywhere or asks any model. The work report, the reminders, the watch on your other chats and their titles are made on your machine, with no model. briefox adds its one sentence to the system prompt of your own chat, and reads the token count of each request to know when the chat is long.

**Comments are on as installed**; `/pet comments off` stops them, and then nothing at all is sent ([comments.md](comments.md) has the cost). The pet says so once, in a notice, before the first one is asked for; none is asked for in a headless run. Each comment, and each `/pet say`, is one request to a small model on your own account, with:

- the pet's name, animal, statistics and language, and the rules of a line;
- the name you told the pet with `/pet call me`, when you told one;
- why the pet speaks, the names of the tools used (those of your MCP servers among them) and how many calls each, the program names of commands that failed (`npm`, never its arguments), how many files changed;
- **the last 600 characters of the assistant's reply**, as they are: a file or words of yours quoted there go with them;
- the pet's own last two lines, and at most three lines of the diary, which can carry folder names;
- when another chat ends a long turn: its folder name and the times;
- with `/pet say`, the first 300 characters of what you typed;
- for the recap, once per pause in an open chat (30 minutes after a turn with no new prompt) and at each resume of a chat left for longer: **up to 16,000 characters of the last turn's text**, as the assistant wrote it, and **the first 300 characters of your last prompt**. Text only: nothing a tool was given or answered.

Never the content of a file, the output or arguments of a command, a file path, or a reminder. Your prompts to the assistant are never sent either, but for those 300 characters of the last one in a recap.

## What is kept on your machine

In Claude Code's plugin store (`~/.claude/plugins/store/`):

- **The pet**: seed, name, character, affection, days of use, stars, what it owns, how many times you petted it and when last, token totals.
- **Preferences**: briefox, comments and their model, chats, language, what is worn.
- **Your name, only if you typed it** after `/pet call me`: the pet never reads one from your account, the system user, git or a path. `/pet call me nobody` forgets it. It is not on the picture of `/pet share`, in the diary or in the marks of the chats.
- **The diary**: at most 40 lines of times, counts and folder names. `/pet diary clear` empties it.
- **The work counters**, for 8 days: for each day how many chats opened, the names of their folders (12 at most), how many turns ended and how many files they changed. `/pet diary clear` empties them too.
- **Your routine**: for each of the last 30 days, when your day started and ended (the first and the last thing you did in a chat), whether you said you had coffee and when you said it, and the finish time you gave; for today also which questions were asked, the answer about lunch and when you were last seen doing something. Never sent to the comments model (comments on or off), not on the picture of `/pet share`. It **is** in the file of `/pet export`, as the pet's memory of you. The answers of `/pet routine`, `/pet until`, `/pet yes`, `/pet no` and `/pet answer` are lines of this chat, as with any command, so this chat's assistant can read them; the questions, the buttons and the warnings are drawn locally and are not chat lines. `/pet routine clear` forgets it; `/pet routine off` stops the questions.
- **Your reminders**: at most 20 lines of 200 characters, as you typed them after `/pet remind`, each with when it was written and when it falls due. They stay on this machine: never sent to the comments model (comments on or off), not on the picture of `/pet share`, not in the file of `/pet export`. When you set or list them, the answer is a line of this chat, as with any command, so this chat's assistant can read it; the bubble is drawn locally and is not a chat line.
- **The last look at your sessions**, renewed about every 30 seconds while a chat is open: for each live session its id, the **full path of its working folder**, its status (busy, idle, waiting), whether it waits for an approval, since when, when it was seen ending a turn, and **the name you gave it, when you gave one** (cleaned, 32 columns at most). Not the name Claude Code makes by itself (`workspace-5a`), and not what it waits for. A name is shown in `/pet chats`, in the pet's bubble and in the toast and notification about that chat; it is kept under this one key and nowhere else, and is not sent to the comments model, which is told the folder's name as before.
- **Alerts**: whether you turned `/pet alerts` on.
- **Comments' count**: lines, tokens and cost, the time of the last line, the pet's last two lines.
- **One mark for each chat**: the **full path of its working folder**, when its last turn started and ended, when it last gave a sign of life, whether that turn was cut short, the time of the pause a recap was already made for, and since when a tool call has waited for your leave. Not which tool or command. The 30 newest are kept, for 30 days at most.
- **After `/pet adopt`**: three fields of your old `/buddy` (`name`, `personality`, `hatchedAt`).
- **briefox**: whether you turned the sentence off.

Never the content of a chat, a prompt or a command.

In `~/.claude/hatchling-share/` (or the config folder Claude Code was given), only when you run `/pet share`: one picture a pet name, `hatchling-<name>.png`, written over each time (an `.svg` when there is no Node to write the PNG). On it: the pet, its name, animal, stage, character and stars. No folder, path, project, token or cost. Nothing is sent: you attach it to a post yourself.

In the same folder, only when you run `/pet export` (or `/pet import <path> yes`, which saves the pet that is there first): one JSON file, `hatchling-<name>-<date>.json`, readable by you alone (mode 0600). Nothing is sent: you carry the file yourself.

- **In the file**: the pet (animal, name, character and statistics, birth, days, affection, cuddles, stars, the items, coats and animals it has, what it wears, whether it was born golden, its two all-time token counters), your choices (language, briefox, hidden, the board of the chats, the comments' model, comments on or off and whether you were told), the name you gave with `/pet call me`, and the diary, and the routine it learned (the days above: start, end, coffee, finish time; and whether its questions are off).
- **Not in the file**: your reminders, the work counters, the last look at your sessions, the marks of the chats (full folder paths, times of turns), the pet's last lines, the comments' count, anything of a chat's content.
- **The diary carries folder names**, and the file your `/pet call me` name: look at it before you send it to anyone.
- `/pet import` reads the one file you name and no other, and writes only the pet's own keys in the store. The file is checked like a skin pack before any of it is used: nothing in it can name a path.

In the session's own memory, which other plugins could read, the pet keeps no path and no command line: only hashes of the files read and of the commands that failed. The line of a recap is held there until your next prompt; it can name a file. Neither it nor the text sent for it is written to the store.

A headless run (`claude -p`) leaves no chat mark, keeps no diary and no work counters, and runs no command.

## What is run

- **`claude agents --json`**, Claude Code's own list of your live sessions, about every 30 seconds by one of your open chats, with a limit of 5 seconds. Its output holds each session's name and can hold the text of what it waits for, which can name a tool and its command: that text and a name Claude Code made are dropped as it is read, and only what is listed above is kept. Not with `/pet chats off`, and never again in a chat after it fails once.
- **`/pet alerts on`** lets the pet raise a desktop notification, through Claude Code's own notification channel, when another chat may be waiting for your OK. Its text is the folder's name, or the name you gave that chat, and that line, nothing else.
- **Node**, when it is on the PATH, writes the files of `/pet share` and `/pet export`.

## What is read

- **`/pet adopt`** reads `~/.claude.json`, whole, when you run it and never otherwise. That file also holds your account data and the secrets of your MCP servers. Three fields are kept, the rest is dropped at once, and the file is never written.
- **Skin packs** in `~/.claude/hatchling-skins/` are read as data, never run as code.
- **Titles, only with `/pet chats titles on`** (off as installed; the choice is kept in the store, the titles are not). Hatchling never reads the content of a chat, except, if you turn titles on, each open chat's title line. When you run `/pet chats`, for each of your other open chats that you did not name, `tail -c` hands the last 256 KB of its transcript (`~/.claude/projects/<project>/<session id>.jsonl`), or the last 4 MB once when no title is in those, with a limit of 2 seconds. In that piece only the lines that begin as a title line (`{"type":"ai-title"…`) are parsed, the last one is the title, and the piece is dropped. The title is cleaned, cut to 48 columns and kept in the memory of the chat that asked, for 10 minutes before it is read again: never in the store, the diary, the file of `/pet export`, the picture of `/pet share` or a request to the comments model. It is shown in the answer of `/pet chats`, which is a line of this chat, as with any command, so this chat's assistant can read it. Never this chat's own transcript, at most 8 transcripts for one `/pet chats`, and nothing at all with titles off, under the bench or in a headless run. `/pet chats titles off` stops it and forgets the titles.

`/pet chats off` hides this chat from your others; it still leaves its mark, with no sign of life.

## Left by earlier versions

An earlier version saved long command outputs in a folder of its own, and nothing is written there any more. They can hold anything a command printed, secrets included: [renamed.md](renamed.md) names the folder; delete it.
