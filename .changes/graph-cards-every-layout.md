---
bump: minor
---
`Graph`: card nodes are laid out by their boxes under every layout, so cards never overlap. With `nodeStyle="card"`, `layout="tree"` is the tidy tree without stacking (elbow connectors), and grid, radial, concentric and force are scaled until the boxes clear each other; cards are sized in layout units in all of them, as in the org chart. A hovered or selected node is drawn as the node inside a ring, with its label in a square tag beside it (it was a pill that swallowed the node). Stories: the Ladle Vite config leaves `maplibre-gl` out of the dependency pre-bundle, so the `Map` worker loads again in dev.
