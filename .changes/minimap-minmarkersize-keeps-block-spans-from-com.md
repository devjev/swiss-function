---
bump: minor
---
Minimap: minMarkerSize keeps block spans from compressing below a floor; when the content is too dense the rail's inner content grows taller than the rail and the rail itself scrolls, auto-following the viewport band (so more labels survive). maxMarkerSize caps block height for sparse content. jumpAlign='center' lands a label-click jump (and the active anchor) at the viewport middle rather than the top. In the scrollable-rail mode, dragging the viewport band to the rail's top/bottom edge keeps the rail (and the content) scrolling, so the drag can reach content beyond the visible rail
