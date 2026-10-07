---
bump: patch
---
Minimap: a cut heading label stops at the blocks' own right edge instead of against the rail's border. The label was capped at the full rail width from a start inset of a quarter unit, so a long heading ran that same quarter unit past the edge and was clipped flush on the border, ellipsis and all, invading the gutter the dither blocks leave. Both ends are written in the stylesheet now, from one indent variable, so the cap moves in with a deeper level as the text does.
