---
bump: minor
---
Add ContextEditor: assemble an LLM's context window as a budget gauge beside an editable, reorderable list of labelled context blocks (system prompt, docs, tool output, memory, history). Controlled value/onChange; drag-reorder (keyboard-operable, lazy dnd-kit), exclude/remove, pinned blocks resist; you supply token counts. The gauge stacks blocks by token share, marks an effective-context cutoff (the 'lost in the middle' degrade) and a cap danger zone, and flags each block strong/buried/wasted (attention = position x salience).
