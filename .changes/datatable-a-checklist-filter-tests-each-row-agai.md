---
bump: patch
---
DataTable: a checklist filter tests each row against a Set built once per filtering pass. Unchecking one of 10k distinct values tested every row against a 9,999-entry array; the toggle took 240ms in a production build and now takes 31ms. Tree tables get the same through table-core's `resolveFilterValue`. DataTable and Explorer share the filter tests in `lib/filter`.
