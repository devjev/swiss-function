---
bump: minor
---
Add Stack, a resize-aware fill/stretch layout primitive (Stack + Stack.Fill): a column/row where a Fill region stretches to absorb the remaining space and locks to the edge as the container resizes, encapsulating the flex + min-*-size:0 chain. Adds a fill prop to TextEdit (stretch to a flexible parent, drop the resize handle), and makes Dialog.Popup a flex column so a Stack fill body works directly. Closes #74.
