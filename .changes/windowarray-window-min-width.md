---
bump: minor
---
`WindowArray` in a narrow container: the vertical orientation no longer squeezes the windows of a column side by side under the width of a title bar. `windowMinWidth` (px, default 240) is the least a window is wide there; a band wraps its windows onto further lines of the same height, so a five-window column on a phone is five full-width windows in order. The order, the keyboard and the reported `WindowMove` are unchanged; a band keeps one resize gutter, which sets its lines' height; the horizontal strip is untouched.
