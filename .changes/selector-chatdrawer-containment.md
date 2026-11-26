---
bump: patch
---
`Selector layout="compact"` is never narrower than its count, Clear and chevron (a tight flex row cut them off); in `layout="inline"` the chips hidden behind the overflow mark are `inert`, so an unseen remove key takes no tap and no Tab stop. `ChatDrawer`'s `menu` slot clips and keeps room for a folded `MenuBar`'s overflow key instead of letting the bar draw under the action keys.
