# Cache rebuilt

The start of the prompt changed, or the cache expired, so the conversation was sent again in full once. Cachito shows it as a note: it costs the pet nothing.

## What it means

- "tools changed mid-chat": an MCP server or a plugin was turned on or off.
- "system prompt changed mid-chat": `CLAUDE.md`, a memory file or the output style was edited.
- "idle over 5 minutes" (an hour on some plans): the cache expired during the pause.
- "probably server side": nothing to change.

## If you want to avoid it

1. Edit `CLAUDE.md`, memory files, tools and MCP servers between chats.
2. After a long pause, `/clear` or `/compact` first makes the re-send smaller.

There is no fix button on this note: there is nothing to tell the agent.

## Cache expired in a large chat

When you send a prompt after a pause of more than an hour and the chat holds 100k tokens or more, the bubble says `cache expired: 120k sent again in full`. It is advice only: Cachito compacts nothing on its own.

- **fix** puts `/compact` in the prompt box. You send it, or not. The requests after it then carry a summary and not the whole chat.
- If the task is done, `/clear` costs less still.
- Under 100k the pet says nothing: there is little to gain.

The hour is an assumption: the documented cache life is 1 hour on a subscription and 5 minutes with an API key, and the mod cannot tell which. Claude Code already compacts on its own, when idle, a chat over 200k tokens.
