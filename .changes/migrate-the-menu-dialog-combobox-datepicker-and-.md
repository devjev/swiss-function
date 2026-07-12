---
bump: patch
---
Migrate the Menu, Dialog, Combobox, DatePicker, and Map popups off the legacy --sf-shadow-* scale onto the --sf-elevation-* tokens everything else uses (Dialog to elevation-5, the dropdowns to elevation-3, the Map tooltip to elevation-2), and remove the now-unused, undocumented --sf-shadow-sm/md/lg/xl tokens (light and dark). Closes #68.
