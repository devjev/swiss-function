import type { Extension } from "@codemirror/state";
import type { ReactNode } from "react";

/** One cell of a notebook document. `name` is the token other cells use to
 *  reference this cell's value; display-only cells (prose) have none. */
export interface NotebookCell {
  id: string;
  /** Must match a registered `CellType.type`. */
  type: string;
  name?: string;
  source: string;
}

/** The controlled notebook document: plain JSON, persisted by the host app.
 *  The component never mutates it; edits arrive via `onDocumentChange`. */
export interface NotebookDocument {
  version: 1;
  cells: NotebookCell[];
}

export interface CellRunContext {
  source: string;
  /** Resolved values of the referenced cells, keyed by cell name. */
  inputs: Record<string, unknown>;
  /** Aborts when the run becomes stale (cell edited, upstream re-ran, unmount). */
  signal: AbortSignal;
}

/** The engine extension point: a cell type teaches the notebook how to edit,
 *  analyze, execute, and render one kind of cell. The notebook itself knows
 *  nothing about SQL, JavaScript, or any data engine — everything
 *  language-specific lives behind this contract. */
export interface CellType {
  type: string;
  /** Add-cell affordance label. */
  label: string;
  /** CodeMirror extensions for the source editor (language packages stay
   *  consumer-installed, per the CodeEditor convention). */
  editorExtensions?: () => Extension[];
  /** Names of other cells the source references. `knownNames` is the set of
   *  names defined in the document — identifier-based languages need it to
   *  tell cell references apart from globals. */
  findDependencies?: (source: string, knownNames: readonly string[]) => string[];
  /** Execute the cell. Omit for display-only types; such cells never enter
   *  the reactive graph. Throw/reject to put the cell in its error state. */
  execute?: (ctx: CellRunContext) => unknown | Promise<unknown>;
  /** Render a successful value. Falls back to the notebook's default
   *  renderer (Arrow-shaped values become a DataTable). */
  renderResult?: (value: unknown) => ReactNode;
  /** Render for display-only types: the source instead of a value. */
  renderStatic?: (source: string) => ReactNode;
}

/** The injected SQL engine: the host app wires this to DuckDB-WASM (or any
 *  other engine). Honor the signal where the engine can cancel; where it
 *  cannot, the notebook discards stale results safely. */
export type SqlExecutor = (sql: string, signal: AbortSignal) => Promise<unknown>;
