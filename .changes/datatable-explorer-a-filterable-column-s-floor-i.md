---
bump: patch
---
DataTable, Explorer: a filterable column's floor is its title again, not the width it happened to have. The funnel is pushed to the trailing edge with an `auto` margin, and `getComputedStyle` reports what that margin absorbed rather than `auto`, so the header measurement counted the column's whole leftover as a need: a filterable table could not be narrowed, and one that fitted its container still grew a horizontal scrollbar. The header is measured at its natural width now, where an auto margin is zero and every real margin still counts.
