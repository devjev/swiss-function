---
bump: minor
---
DataTable: Excel-style full row/column selection. rowNumbers adds a frozen numbered gutter (click a number selects the row, drag sweeps a span, the corner selects everything), every leaf header gains a slim top-edge select zone (click selects the column; the label still sorts), and Shift+Space / Ctrl+Space select the active row/column. selectionMode="row"/"column" makes a plain cell click select its whole row or column instead of one cell. Full rows and columns report as ordinary ranges through onSelectionChange.
