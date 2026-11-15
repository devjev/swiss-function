---
bump: patch
---
DataTable: sorting a text column computes each row's sort key once instead of on every comparison. Sorting 100k rows by a text column takes 32ms instead of 414ms; the order is unchanged.
