---
bump: minor
---
ChatDrawer: opt-in `centered` mode floats the chat (or the active view) as a centered column resized symmetrically from either edge, by pointer or arrow keys (`defaultChatWidth`, `minChatWidth`/`maxChatWidth`, `onChatWidthChange`); the side margins are app-ownable slots (`margins={{ left, right }}`, e.g. park zones for widgets dragged out of the chat) whose content auto-hides, mounted, below `marginMinWidth`; also fixed the SplitPane divider losing the seam hit test to the panel content layer, which made the panel-side half of the divider start a text selection instead of a resize
