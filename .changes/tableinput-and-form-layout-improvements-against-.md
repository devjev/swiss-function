---
bump: minor
---
TableInput and form-layout improvements against the new layout rubrics. TableInput: numeric columns auto right-align in tabular mono figures; header labels ellipsize with a title; a date width floor; an empty slot for the no-rows case; fillHeight dithers the band below sparse rows; cellPadding and cellFontSize consume the DataTable density variables; opt-in virtualize windows large arrays under a sticky header. DigitInputMicro gains an align prop (right-aligned digits with the placeholder slots leading). VerticalForm gains reserveError (a pre-allocated error slot, so an appearing error does not reflow the rows) and a per-field width cap; VerticalForm and FieldLayout labels wrap within their column, and FieldLayout fields on a wrapped line share a top edge.
