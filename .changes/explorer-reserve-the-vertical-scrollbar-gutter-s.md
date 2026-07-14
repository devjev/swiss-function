---
bump: patch
---
Explorer: fix the header/body column borders drifting out of alignment when a vertical scrollbar is present (issue #70). The sticky header spans the full scroll width while the body shrank to the scrollbar-reduced client width, so the columns fell progressively out of line toward the right. The body is now mirrored to the header's measured width (the same mechanism DataTable already uses), keeping every column aligned regardless of the scrollbar.
