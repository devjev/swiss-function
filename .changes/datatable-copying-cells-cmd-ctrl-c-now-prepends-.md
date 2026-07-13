---
bump: minor
---
DataTable: copying cells (Cmd/Ctrl+C) now prepends the selected columns' header names as the first row, so a paste into a spreadsheet or document is self-labelling. Controlled by the new copyWithHeaders prop (default true); set it false for a values-only copy.
