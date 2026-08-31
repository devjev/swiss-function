---
bump: patch
---
Drag and drop: SfDndProvider host handlers and overlay fire only for host-owned drags; widget dnd ids are namespaced per instance so equal consumer ids cannot collide under one provider; Explorer's column and tree regions no longer cross-talk, rows are not draggable while sorted, and releasing a drag outside the tree cancels instead of appending to root; a collapsed DataTable column group drags as one unit and keeps its position on expand; AgentComposer keeps its keyboard model under a provider and can drag out to other widgets; TableInput and Explorer drag activators set touch-action; drag settle animations respect prefers-reduced-motion; WindowArray shows the drop indicator next to popped-out windows
