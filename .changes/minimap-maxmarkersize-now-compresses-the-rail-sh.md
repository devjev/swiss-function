---
bump: patch
---
Minimap: maxMarkerSize now compresses the rail (shrinks the content height so the capped blocks pack together) instead of only clamping each block's rendered height and leaving the rail full-height with gaps. VerticalForm's maxBlock inherits this
