---
bump: patch
---
Charts: the pinned selection popover has room for its controls. Its close key sits a quarter unit inside the frame's corner (it hung over the frame), and the hover tooltip of the pinned mark stays hidden while the popover is open (it sat on the popover and covered the content). `data-density` on the root element no longer changes the root font size, so `data-density="compact"` on `<html>` keeps the 20px unit.
