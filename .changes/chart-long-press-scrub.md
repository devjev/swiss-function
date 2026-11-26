---
bump: minor
---
Charts under a finger: a finger that rests 300ms on a plot takes the crosshair and the tooltip with it until it lifts (the touch form of hover). Before the rest the gesture stays the page's scroll or a zoomable chart's pan, and a pinch zooms as before. Every chart with a hover reading has it through the shared scaffold; `useScrub` in `lib/chart` is the hook.
