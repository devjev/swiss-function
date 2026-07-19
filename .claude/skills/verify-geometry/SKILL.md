---
name: verify-geometry
description: Measure and assert UI layout geometry (containment and no-overlap) for swiss-function components by driving Ladle stories with Playwright. Use when changing or reviewing a component's layout, sizing, or empty/edge states, to catch overflow and overlap that a screenshot hides.
---

# verify-geometry

Screenshots show a frame; they do not assert that region A stays inside its
container or does not overlap region B. This skill measures bounding boxes and
fails a check when the geometry is wrong. Reach for it on any layout change:
sizing, empty and edge states, sticky headers, fill bands, wrapped rows.

It exists because a `NonIdealState` with `min-block-size: calc(var(--sf-unit) *
14)` (21rem / 336px) was dropped into an 8rem table body; it could not shrink,
so it overflowed ~200px past the footer. A single screenshot looked "contained
enough". A containment assertion catches it at once.

## Prerequisite

Ladle must be running on `:61000`:

```
npm run dev    # leave running in the background
```

## Run

```
node .claude/skills/verify-geometry/measure.mjs <spec.json>
```

Exit code 0 means all checks passed; non-zero means a failure (printed with the
offending boxes). Run the shipped example after any TableInput layout change:

```
node .claude/skills/verify-geometry/measure.mjs .claude/skills/verify-geometry/examples/table-input.json
```

## Writing a spec

A spec is JSON: `{ baseUrl?, themes?, tolerance?, viewport?, cases: [...] }`.
Each case names a Ladle `story` id (see `/meta.json`) and a list of `checks`.
Every case runs in both `themes` by default.

Checks:

- `{ "type": "contained", "parent": <sel> }` — no descendant of `parent` spills
  past its right or bottom edge. The strongest guard: it catches a child too tall
  or wide for its container (how the NonIdealState overflowed the footer). Left
  and top are not flagged, since off-screen sr-only inputs live there; use
  `within` for an explicit left/top bound.
- `{ "type": "within", "child": <sel>, "parent": <sel> }` — one element's box
  sits inside another's.
- `{ "type": "noOverlap", "a": <sel>, "b": <sel> }` — two boxes do not intersect
  (for example empty-state content vs the footer).
- `{ "type": "box", "selector": <sel> }` — report a box, no assertion.

## Selectors

Use stable Playwright locators: `text=No holdings`, `role=button[name=...]`, or a
`data-testid` you add to the story. Do not target hashed CSS-module class names
(`.emptyState_ab12c`); they change on every build. Add a `data-testid` to the
component root in the story when you need to reference it (the TableInput stories
tag `empty-table` and `fill-table`).

## Checklist for a layout change

1. Run the edge conditions the layout must survive: empty, one row, many rows,
   narrow container, wide container.
2. `contained` on the component root for each, so nothing overflows.
3. `noOverlap` between regions that must never touch (content vs footer, header
   vs body, label vs control).
4. Both themes (the default).
5. Before asserting how any component sizes, read its `.module.css` for
   `min/max` dimensions, `position`, `overflow`, and default `width/height`.
   Region fillers (a `min-block-size` floor plus `width: 100%`, like
   `NonIdealState`, `Graph`, `Map`) belong in a whole-region slot, never a
   compact one.

This complements the repo's other gates: VRT diffs pixels against a baseline and
CT tests behavior; neither asserts "A must not overflow B".
