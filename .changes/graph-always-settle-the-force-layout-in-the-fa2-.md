---
bump: patch
---
Graph: always settle the force layout in the FA2 worker when one can spawn, instead of only above a 2000-node threshold. Below that threshold the layout previously ran synchronously on the main thread, freezing the tab for the full iteration budget and popping in the already-settled result with no visible motion (worse UX than the async, animated large-graph path). The sync block is now only the no-Worker fallback.
