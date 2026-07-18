# Design research

Durable design research for `@tarassov-ch/swiss-function`. This folder is the
source of truth; the same documents are mirrored to the Forgejo wiki for
browsing. Read [AESTHETICS.md](../../AESTHETICS.md) first for the stance; these
documents earn and operationalise it.

The library's design language is a **precision instrument, not a consumer or
social app**: Dieter Rams and Braun, the Airbus glass cockpit, Porsche
instruments, the tactile quality of a Curta, a Leica, a Hasselblad, and the
Swiss grid. The two rubric documents translate that into testable checklists;
the lineage document sources the heritage.

## Contents

- **[design-lineage.md](./design-lineage.md)** — the aesthetic heritage with
  sourced, licensed historical-interface images, each paired with a concrete
  directive for our UI, and a cross-cutting set of meta-principles mapped to our
  `--sf-*` tokens. The seed of a future style and inspiration book.
- **[table-layout-principles.md](./table-layout-principles.md)** — table and
  grid design principles by space (tight, broad, tall, dense-data,
  many-columns), a reject list, a testable rubric, and the current gaps in
  `TableInput` (and where it should reuse `DataTable`'s engine).
- **[form-layout-principles.md](./form-layout-principles.md)** — form layout
  principles, a reject list, a testable rubric, and a teardown of `VerticalForm`
  and `FieldLayout` against it.
- **[inspiration/](./inspiration/)** — the curated reference images, grouped by
  cluster, with [MANIFEST.md](./inspiration/MANIFEST.md) crediting every source
  and licence. Images retain their original licence; credit the source when
  reproduced.

## How these are used

The two rubrics are the gate for the TableInput and VerticalForm improvement
work: each numbered check is scored against screenshots under a specific adverse
condition (tight, broad, tall, many columns, long labels, mixed controls). The
inspiration set is the visual reference for that work and the starting point for
the style book.
