---
bump: minor
---
Add CodeEditorInline: a CodeEditor that rests as a single line and expands to a multi-line editor on focus (the code sibling of TextEditInline). Collapsed shows line 1 syntax-highlighted (a live CodeMirror, not a label); focus floats the full editor over the content below (elevation-3), growing to maxRows then scrolling and vertically resizable by drag while active; blur collapses back. Takes every CodeEditor prop plus maxRows / collapsedElevation.
