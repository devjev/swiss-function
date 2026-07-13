---
bump: patch
---
Selector (layout=compact): a width set on the control (className or inline style) now fills the field again, instead of leaving the input group at its content width in empty space (regression, issue #69). The compact root shrinks to content so it still tucks into a toolbar, but an explicit width wins and the group fills it.
