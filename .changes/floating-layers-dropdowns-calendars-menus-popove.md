---
bump: minor
---
Floating layers (Picker/Selector/Combobox and MenuBar dropdowns, the DatePicker calendar, Menu/ContextMenu, Popover, and the Graph right-click menu) opened from inside a Dialog, Drawer, Popover, or expanded Fullscreen/Graph now paint above it automatically, via a cross-portal stacking context (issue #82). Consumers can drop app-side z-index lifts for library floaters. Root behaviour is unchanged.
