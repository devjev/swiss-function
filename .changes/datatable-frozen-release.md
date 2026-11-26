---
bump: patch
---
`DataTable`: frozen columns that take more than half of the table's width stop being pinned and scroll with the rest, on any device, and pin again when the table widens (the `rowNumbers` gutter stays). A 192px frozen column left 134px for everything else on a phone. On touch, the last column's resize handle no longer reaches past the grid, which gave every fitting table a few px of sideways scroll.
