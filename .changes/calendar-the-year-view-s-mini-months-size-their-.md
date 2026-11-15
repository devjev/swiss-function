---
bump: patch
---
Calendar: the year view's mini months size their day columns as minmax(0, 1fr), so switching to the year view no longer measures all 504 day buttons before laying them out (layout 50ms to 40ms at 4x CPU throttling).
