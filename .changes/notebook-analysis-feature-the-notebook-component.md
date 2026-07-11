---
bump: major
---
Notebook analysis feature: the Notebook component (reactive cells over consumer-provided engines via the public CellType contract), createSqlCellType and proseCellType, the in-house reactive scheduler, and fromArrow (Arrow results to plain rows with Date coercion and a BigInt policy) at lib/from-arrow. New entries: ./notebook and ./lib/from-arrow. The engine stays the consumer's: the library ships no execution language, no data engine, and no eval.
