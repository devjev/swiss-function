---
bump: minor
---
DataTable: `columnFit="content"` sizes every column to the narrowest width that still shows its content, at mount and again when the data changes, through the same measurement as the double-click on a header edge (so no column lands under its floor or breaks a group title). `headerMenu` adds a right-click Fit this column / Fit all columns on the headers. The menu is lazy-loaded, so a table that does not opt in carries none of it.
