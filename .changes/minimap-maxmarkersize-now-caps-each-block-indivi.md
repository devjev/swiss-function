---
bump: minor
---
Minimap: maxMarkerSize now caps each block individually (a gap follows the capped block) instead of rescaling the whole rail; VerticalForm rail blocks span each field's real row height, so a tall TableInput reads as a proportionally tall dither block and grows with its rows (previously capped at 8 label-heights, which rendered unequal tall fields identical and shrank them as the form grew)
