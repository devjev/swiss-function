---
bump: minor
---
Touch gestures: every drag now uses one sensor set, `useSfSensors` (`/lib/dnd`): a mouse drags after 4px, a finger after resting 250ms or at once on a handle. Draggable `Explorer` rows and reorderable `DataTable` / `Explorer` headings no longer block touch scrolling. `Explorer` opens its context menu on a long press (iOS fires no `contextmenu` event; `useLongPress` is exported for the same use), and a `DataTable` cell opens its editor on a second tap. Splitters, resize edges and slider thumbs are easier to grab with a finger.
