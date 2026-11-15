---
bump: patch
---
Graph: layout transitions and layout writes update all node positions in one batched graph update per frame instead of one event per node and coordinate (20k events per frame on 10k nodes). A Concentric switch on 10k nodes draws its transition at 67ms per frame instead of 83ms at 4x CPU throttling.
