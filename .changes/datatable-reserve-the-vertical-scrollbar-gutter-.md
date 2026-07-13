---
bump: patch
---
DataTable: reserve the vertical scrollbar gutter (scrollbar-gutter: stable) on the scroll viewport, so the content-box width stays constant whether or not a classic (space-taking) scrollbar is showing and the header/body column tracks can't drift apart when it appears (addresses #70). No-op with overlay scrollbars.
