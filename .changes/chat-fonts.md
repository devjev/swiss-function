---
bump: minor
---
Chat: the faces are the host's to choose. `fonts={{ text, user, code }}` sets the replies and the chrome, the user's text and the editor (the text face when unset), and code, inline code and tool calls (monospace when unset); `--sf-chat-font`, `--sf-chat-font-user` and `--sf-chat-font-code` set them app-wide, and the prop wins for one chat. The default stays monospace throughout. Any face is sized to the system's x-height, a line mixing the text face with code stays one unit tall, and the tree guides stay monospace. `ChatDrawer` forwards `fonts`. Markdown's terminal reading takes `--sf-prose-font` and `--sf-prose-code-font`. Refs #111.
