# What Cachito keeps and what it sends

## What is sent

**As installed, nothing.** Neither plugin sends anything anywhere or asks any model. cachito-lean adds its eight lines to the system prompt of your own chat, and reads the token count of each request to know when the chat is long.

**The one exception is comments**, off until you turn them on ([comments.md](comments.md) has the cost). Each comment, and each `/pet say`, is one request to a small model on your own account, with:

- the pet's name, animal, statistics and language, and the rules of a line;
- the name you told the pet with `/pet call me`, when you told one;
- why the pet speaks, the names of the tools used (those of your MCP servers among them) and how many calls each, the program names of commands that failed (`npm`, never its arguments), how many files changed;
- **the last 600 characters of the assistant's reply**, as they are: a file or words of yours quoted there go with them;
- the pet's own last two lines, and at most three lines of the diary;
- when another chat ends a long turn: its folder name and the times;
- with `/pet say`, the first 300 characters of what you typed;
- for the recap, once per pause in an open chat (30 minutes after a turn with no new prompt) and at each resume of a chat left for longer: **up to 16,000 characters of the last turn's text**, as the assistant wrote it, and **the first 300 characters of your last prompt**. Text only: nothing a tool was given or answered.

Never the content of a file, the output or arguments of a command, or a file path. Your prompts to the assistant are never sent either, but for those 300 characters of the last one in a recap.

## What is kept on your machine

In Claude Code's plugin store (`~/.claude/plugins/store/`):

- **The pet**: seed, name, character, affection, days of use, stars, what it owns, how many times you petted it and when last, token totals.
- **Preferences**: lean, comments, chats, language, what is worn.
- **Your name, only if you typed it** after `/pet call me`: the pet never reads one from your account, the system user, git or a path. `/pet call me nobody` forgets it. It is not on the picture of `/pet share`, in the diary or in the marks of the chats.
- **The diary**: at most 40 lines of times, counts and folder names. `/pet diary clear` empties it.
- **Comments' count**: lines, tokens and cost, the time of the last line, the pet's last two lines.
- **One mark for each chat**: the **full path of its working folder**, when its last turn started and ended, when it last gave a sign of life, whether that turn was cut short, the time of the pause a recap was already made for, and since when a tool call has waited for your leave. Not which tool or command. The 30 newest are kept, for 30 days at most.
- **After `/pet adopt`**: three fields of your old `/buddy` (`name`, `personality`, `hatchedAt`).
- **cachito-lean**: whether you turned the lines off.

Never the content of a chat, a prompt or a command.

In `~/.claude/cachito-share/` (or the config folder Claude Code was given), only when you run `/pet share`: one picture a pet name, `cachito-<name>.png`, written over each time (an `.svg` when there is no Node to write the PNG). On it: the pet, its name, animal, stage, character and stars. No folder, path, project, token or cost. Nothing is sent: you attach it to a post yourself.

In the session's own memory, which other plugins could read, the pet keeps no path and no command line: only hashes of the files read and of the commands that failed. The line of a recap is held there until your next prompt; it can name a file. Neither it nor the text sent for it is written to the store.

A headless run (`claude -p`) leaves no chat mark and keeps no diary.

## What is read

- **`/pet adopt`** reads `~/.claude.json`, whole, when you run it and never otherwise. That file also holds your account data and the secrets of your MCP servers. Three fields are kept, the rest is dropped at once, and the file is never written.
- **Skin packs** in `~/.claude/cachito-skins/` are read as data, never run as code.

`/pet chats off` hides this chat from your others; it still leaves its mark, with no sign of life.

## Left by earlier versions

Nothing is written to `~/.claude/cachito-out` any more. If that folder exists, an earlier version saved long command outputs there. They can hold anything a command printed, secrets included: delete it.
