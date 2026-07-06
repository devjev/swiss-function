import type { EditActivation } from "./types";

/** Resolve the effective edit-activation for a cell, most-specific wins:
 *  cell (`getEditActivation`) → column (`editOn`) → table (`editOn`) →
 *  the `"double"` default. */
export function resolveEditActivation(levels: {
  cell?: EditActivation;
  column?: EditActivation;
  table?: EditActivation;
}): EditActivation {
  return levels.cell ?? levels.column ?? levels.table ?? "double";
}
