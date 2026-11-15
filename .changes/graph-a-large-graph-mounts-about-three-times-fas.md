---
bump: patch
---
Graph: a large graph mounts about three times faster (369ms to 121ms for 10k nodes and 20k edges). Attribute writes go out in one batched update and only when a value changes; Sigma was refreshing once per written node or edge (150k refreshes per mount). Settings are written only when they differ, and the first resize callback no longer redraws.
