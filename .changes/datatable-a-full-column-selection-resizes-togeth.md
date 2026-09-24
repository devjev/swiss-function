---
bump: minor
---
DataTable: a full-column selection resizes together (every selected column takes the dragged width, each no lower than its floor; double-click or Enter fits each), Shift+drag moves the edge between two columns with the row's total held, a group title never wraps either (a leaf stops where the group's title would need more than its leaves hold), and apiRef.autoFitColumns(ids?) fits columns to their content. Auto-fit now reads the content's run, so it shrinks a wide column as well as growing a narrow one
