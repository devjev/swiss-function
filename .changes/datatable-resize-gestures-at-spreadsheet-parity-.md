---
bump: minor
---
DataTable: resize gestures at spreadsheet parity. A drag shows a width readout under the handle (unit multiples and px, min at the floor); the pointer keeps the resize cursor over the body while a drag is captured, and at the floor the handle and a clamped drag show the one-way e-resize arrow. On a focused handle: Page Up / Down jump 96px, Home goes to the floor, End and Enter / Space auto-fit, Escape restores the width the handle had at focus; the handle announces aria-valuemax and aria-valuetext
