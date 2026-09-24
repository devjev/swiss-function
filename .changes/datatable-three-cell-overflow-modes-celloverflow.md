---
bump: minor
---
DataTable: three cell overflow modes, cellOverflow on the table and overflow per column. clamp (one line, an ellipsis, the default), wrap (the value takes the lines the row height holds, then clamps; rows stay uniform), and hash (Excel's #### while a value does not fit, in the mono face and whole glyphs; the value stays in the DOM, the accessibility tree and the cell's title, and returns once the column is wide enough)
