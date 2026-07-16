---
bump: patch
---
TableInput: robust resizing. Columns now shrink toward a per-column minWidth (new minWidth column prop + minColumnWidth prop) and the table scrolls horizontally once they can't all fit, instead of collapsing and overlapping when narrow. Cells stretch and their controls fill the column, so end/center-aligned values no longer leave dead space on the left and a control never overflows into the next column. Closes #79.
