---
bump: minor
---
Explorer: the resize gestures match DataTable's. A live drag shows the width readout under the handle (min at the floor, where the cursor turns one-way and the wrapper keeps the resize cursor); a focused handle takes Page Up / Down, Home (the floor), End / Enter / Space (auto-fit) and Escape (restore), and announces aria-valuemax and aria-valuetext; auto-fit reads the content's run, so it shrinks a wide column too. DataTable: hovering a clipped clamp or wrap cell reveals the whole value in the cell's title
