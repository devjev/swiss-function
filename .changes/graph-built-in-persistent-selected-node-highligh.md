---
bump: minor
---
Graph: built-in persistent selected-node highlight (accent fill + ring), the node analogue of the selected-edge double stroke. New controlled 'selected' prop and 'selectedNodeVisual' override; a node click selects (uncontrolled), a stage click clears, both still reported via onSelectionChange. Closes #91.
