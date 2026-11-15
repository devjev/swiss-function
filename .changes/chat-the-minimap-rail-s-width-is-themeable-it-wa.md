---
bump: patch
---
Chat: the minimap rail's width is themeable. It was always passed as a prop, which lands as an inline custom property and left no way to set it in CSS; unset, the rail now reads `--sf-chat-minimap-width` (5u by default), so a theme can retune every rail in an app, and `minimap={{ width }}` still overrides it for one chat. The default is a fallback at the point of use, not a declaration on the chat root, which would have shadowed the value an ancestor sets.
