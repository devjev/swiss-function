---
bump: patch
---
DataTable: rework the columnFill / fillHeight dither into one continuous backdrop behind the grid (was two measured, absolutely-positioned panels). Removes the L-shaped seam, halves the animated WebGL contexts to one, and drops all fill geometry measurement
