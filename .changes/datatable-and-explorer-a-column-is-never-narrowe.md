---
bump: minor
---
DataTable and Explorer: a column is never narrower than its title. The header floor is measured off the rendered header (padding, chevron, funnel, a reserved sort arrow, the title on one line) and raises the declared minimum on every path: the grid template (a container squeeze scrolls instead of wrapping a title), the pointer drag, the keyboard step, double-click auto-fit, frozen tracks and the handle's aria-valuemin. A sortable column keeps room for its arrow at rest, so sorting never moves a column edge
