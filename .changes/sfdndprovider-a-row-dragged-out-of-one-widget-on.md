---
bump: patch
---
SfDndProvider: a row dragged out of one widget onto another now routes to the target region's onExternalDrop (a drop over a different registered region is external, not swallowed as an internal reorder of the source). Same-region drags and drops over nothing still reorder internally. Enables widget-to-widget drag under a shared provider. Closes #92.
