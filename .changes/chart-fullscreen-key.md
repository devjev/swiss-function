---
bump: patch
---
Charts: the fullscreen key of BarChart, BridgeChart, BoxPlot, DotPlot, BulletChart and Marimekko sat against the nearest positioned ancestor (often the page's top-right corner) instead of its own chart, and their full screen was a strip of the chart's own height at the top of the window: the chart's root height outranked the scaffold's full-screen rule, depending on stylesheet order. The six roots are positioned, and the full-screen rule outranks any chart root. Found with GridOverlay, whose positioned region moved the stray keys. Refs #112.
