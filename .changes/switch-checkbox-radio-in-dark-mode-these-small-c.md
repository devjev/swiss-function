---
bump: patch
---
Switch, Checkbox, Radio: in dark mode these small controls no longer carry the brutalist hard-cast elevation shadow (a zero-blur block stepping to the lower-right), which read as a misaligned rectangle rather than a shadow at their size. They use a soft resting shadow instead; light mode is unchanged. Fixes #78
