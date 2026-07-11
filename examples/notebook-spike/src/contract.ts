/**
 * Draft cell-type contract (issue #57 M2, feeding the #58 design).
 * A cell type teaches the notebook shell how to edit, analyze, execute, and
 * render one kind of cell. The notebook itself knows nothing about SQL,
 * JavaScript, or any engine; everything language-specific lives behind this.
 */
import type {Extension} from "@codemirror/state";
import type {ReactNode} from "react";

export interface CellRunContext {
  source: string;
  /** Resolved values of the dependencies, keyed by cell name. */
  inputs: Record<string, unknown>;
  signal: AbortSignal;
}

export interface CellType {
  type: string;
  /** Add-cell menu label. */
  label: string;
  /** CodeMirror extensions for the source editor (language, completions). */
  editorExtensions?: () => Extension[];
  /**
   * Names of other cells this source references. `knownNames` is the set of
   * names currently defined in the document; identifier-based languages need
   * it to tell cell references apart from globals. (Contract question for
   * #58: pass the universe vs rely on the scheduler's `unresolved` status.)
   */
  findDependencies?: (source: string, knownNames: readonly string[]) => string[];
  /** Execute the cell. Omitted for display-only types (prose). */
  execute?: (ctx: CellRunContext) => unknown | Promise<unknown>;
  /** Render a successful value. Falls back to the shell's default renderer. */
  renderResult?: (value: unknown) => ReactNode;
  /** Render for display-only types (prose): the source instead of a value. */
  renderStatic?: (source: string) => ReactNode;
}

export interface CellDoc {
  id: string;
  type: string;
  /** Reference token for other cells. Display-only cells have none. */
  name?: string;
  source: string;
}

export interface NotebookDoc {
  version: 1;
  cells: CellDoc[];
}
