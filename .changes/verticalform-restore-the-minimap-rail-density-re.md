---
bump: patch
---
VerticalForm: restore the Minimap rail density read. Field markers are sized by the real row height again (fields read as contiguous filled blocks), reverting the c532d9e label-height regression that made forms look super-sparse. A single outsized field (a tall TableInput) is now capped at a few label-heights instead, so it still can't dominate the rail scaling (#87).
