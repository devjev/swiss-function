---
bump: patch
---
VerticalForm: a field with a tall control (a TableInput, an expanded TextEdit) no longer distorts the Minimap rail. Its marker spans the field label height, not the whole control, so a tall table stops dominating the rail's block sizing (with maxBlock set it no longer compresses every other marker into the top).
