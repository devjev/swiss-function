---
bump: minor
---
Chat, Minimap: the chat rail's blocks keep a minimum size and accumulate from the top instead of being stretched down it. A rail is an overview, so it mapped the conversation onto its full height whatever there was to show: three turns came out as slabs filling the rail, which says nothing about where you are. `Minimap` takes `stretch={false}` for this, where `minMarkerSize` sets the scale rather than a floor (the smallest span is exactly that tall and the rest are proportional to it); the picture then takes only the room it needs, and once the content outgrows the rail it scrolls as min-block mode already did. The chat rail turns it on with a half-unit floor, so a short conversation reads as a few bricks at the top and the rail fills as the conversation does.
