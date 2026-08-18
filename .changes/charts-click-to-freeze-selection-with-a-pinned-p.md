---
bump: minor
---
Charts: click-to-freeze selection with a pinned popover. selectable makes a click on a mark pin it and open a popover anchored to it that stays open (unlike the hover tooltip) and tracks the mark through zoom/pan; the mark keeps an accent emphasis. Uniform across the 2D charts (Scatterplot, BarChart, CandlestickChart, BridgeChart, Heatmap) via the shared ChartSelectionProps mixin. Controlled/uncontrolled via selection/defaultSelection/onSelectionChange; renderSelection supplies the popover body (defaults to the tooltip). BridgeChart also gains onPointActivate. Dismiss by clicking the mark again, clicking away, scrolling, Escape, or the popover close button.
