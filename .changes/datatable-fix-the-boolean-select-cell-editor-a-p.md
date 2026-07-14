---
bump: patch
---
DataTable: fix the boolean/select cell editor (a Picker) overflowing a narrow cell into the next column. The Picker's 12rem standalone min-width floor (added in 2.3.1 for issue #69) leaked into the inline editor; the editor now zeroes that floor and fills the cell.
