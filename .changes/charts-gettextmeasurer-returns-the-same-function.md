---
bump: patch
---
Charts: getTextMeasurer returns the same function for the same font until the caches are cleared. Charts list it as a memo dependency, so every hover re-render recomputed every label layout; a hover sweep over a 5k-point Scatterplot now holds 33ms frames at p95 (50ms before) and allocates half as much.
