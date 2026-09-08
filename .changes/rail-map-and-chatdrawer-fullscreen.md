---
bump: minor
---
Minimap and VerticalForm: the per-block cap (maxMarkerSize / maxBlock) is now a piecewise mapping. An outsized block is compressed to the cap in place and what follows moves up; no other block is shrunk (the 2.27 whole-rail scale) and no hole is left behind (2.29 to 2.34), and the viewport band, presses, drags and header labels use the same map. ChatDrawer: expanded / defaultExpanded / onExpandedChange control the fullscreen state from outside. WindowArray: WindowArrayHandle (the apiRef type) is exported.
