---
bump: minor
---
Add SfDndProvider (@tarassov-ch/swiss-function/lib/dnd): a shared drag-and-drop context so DataTable, Explorer, WindowArray, TableInput, ContextEditor and AgentComposer join one dnd-kit runtime instead of each owning its own (no nested DndContext). Auto-detected, existing call sites unchanged. The host can drag its own elements onto a widget's rows/nodes via the new per-widget onExternalDrop.
