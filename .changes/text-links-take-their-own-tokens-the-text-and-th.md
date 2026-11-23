---
bump: minor
---
Text links take their own tokens, the text and the decoration apart: --sf-link-color, -font-weight, -font-style, -decoration-line, -decoration-style, -decoration-color, -decoration-thickness, -underline-offset and three hover tokens, with a set per kind (wiki links, #tags, external links) that falls back to the base. By default a link is set in the text colour around it under a thin accent rule, an external link carries a ↗ marker, a #tag reads as accent text without a rule, and a focused link shows the focus ring (#109).
