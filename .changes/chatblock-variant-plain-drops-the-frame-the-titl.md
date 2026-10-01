---
bump: minor
---
`ChatBlock` takes a `variant`: `"framed"` (the default, today's TUI panel) or `"plain"`, which drops the frame, the surface, the padding, the letterforms and the title bar with its `●` marker, leaving a block box and the part's own markup. For a custom `renderPart` block that should look like itself. A `title` passed alongside `variant="plain"` renders as one dim line with no marker and no rule; omit it and there is no label at all.
