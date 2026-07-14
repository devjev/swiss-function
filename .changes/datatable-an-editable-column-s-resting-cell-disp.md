---
bump: patch
---
DataTable: an editable column's resting cell display now matches what its editor shows — boolean cells read True/False (not true/false), select cells show the option's label (not the raw value), numbers get their decimals + unit, and dates render as ISO — so activating a cell no longer jumps the value's text. Columns with a custom cell renderer are unaffected.
