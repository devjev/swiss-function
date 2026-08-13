---
bump: minor
---
Graph: new layoutOptions prop to tune the active layout without leaving it, force layout accepts `iterations` plus the full ForceAtlas2 settings (gravity, scalingRatio, strongGravityMode, linLogMode, outboundAttractionDistribution, adjustSizes, edgeWeightInfluence, slowDown, barnesHutOptimize, barnesHutTheta), radial/concentric scale, tree rootId/direction/levelGap, and grid columns. Each field defaults to today's size-derived value; changing it re-runs the layout.
