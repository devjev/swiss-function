---
bump: patch
---
Consistent scrollbars: every scrollable surface in the library now uses the shared scroll-surface tokens (thin, invisible-until-hover, primary thumb on region hover) via the `scrollable` utility. Previously only DataTable, Pane, Prose and WindowArray did; now Chat, Dialog, Drawer, Explorer, Notebook, Picker, Selector, SplitPane, ThemeBuilder, Timeline, the Combobox dropdown, Markdown code blocks, and the CodeEditor (CodeMirror) scroller match too.
