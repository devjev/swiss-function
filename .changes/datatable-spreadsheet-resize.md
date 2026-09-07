---
bump: minor
---
DataTable and Explorer column resizing follow the spreadsheet model: dragging a column's trailing edge changes that column alone, its neighbours keep their widths, and the row's total width follows (it scrolls sideways when wider than the viewport and leaves slack to the right when narrower). The first resize freezes every column at its measured width (the last column's `1fr` filler ends and `onColumnWidthsChange` reports every column), so a persisted set of widths restores the exact layout. Every resizable column has a trailing handle, the last one included; the leading-edge handle for a stranded last column is gone. The cascading `resizeBoundary` helper is removed.
