---
bump: minor
---
ChatDrawer: a `menu` slot in the header, between the title and the actions, for a bar that takes the room in between. MenuBar: `transparent` drops the fill, the edge rule and the inline padding for a bar set into another surface; `Search` keeps half a unit after the last item and `fill` stretches it across the bar's remaining room; the active title (hovered or open) and the highlighted dropdown row invert to primary with background-coloured text. The maximized drawer seeds the stacking band, so a dropdown, picker or popover opened inside it paints above the panel instead of under it.
