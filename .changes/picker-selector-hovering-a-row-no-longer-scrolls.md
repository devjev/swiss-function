---
bump: patch
---
Picker, Selector: hovering a row no longer scrolls the dropdown or takes the highlight from the keyboard. A pointer highlight scrolled the hovered row into view, which slid another row under the cursor and scrolled again, so a stray mouse movement jumped the list. Hover now reads through CSS `:hover` while `data-highlighted` stays where the keyboard left it.
