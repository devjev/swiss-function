---
bump: minor
---
`DataTable` and `Explorer`: `columnShrink` (`"auto"` by default, `"squeeze"`, `"hold"`). On a touch device the columns now keep their width and the table scrolls sideways, where every column used to shrink to its minimum, with each cell cut by an ellipsis, before the table scrolled anyway. A mouse keeps the squeeze. The switch is the `--sf-table-column-hold` token (0, or 1 under `pointer: coarse`), read in the track's minimum; `columnShrink="squeeze"` restores the old behaviour on touch. A dithered fade on the trailing edge shows while there is more to scroll (follows the hold state; `edgeFade={false}` removes it, `edgeFade` on shows it for a mouse too). `Explorer`'s header now follows a sideways scroll of the tree, and a tree column with no `width` holds at 200px.
