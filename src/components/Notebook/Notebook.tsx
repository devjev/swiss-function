import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { forwardRef, useCallback, useMemo, useRef } from "react";
import { cx } from "../../lib/cx";
import type { NodeState } from "../../lib/notebook/types";
import { Button } from "../Button";
import { CodeEditor } from "../CodeEditor";
import { Markdown } from "../Markdown";
import { Spinner } from "../Spinner";
import styles from "./Notebook.module.css";
import type { CellType, NotebookCell, NotebookDocument } from "./types";
import { useNotebookGraph, validateDocument } from "./useNotebookGraph";

export interface NotebookProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** The controlled document. The component never mutates it. */
  document: NotebookDocument;
  onDocumentChange: (next: NotebookDocument) => void;
  /** The explicit cell-type registry — nothing is registered implicitly.
   *  Pass `proseCellType` and the engine adapters the app provides. */
  cellTypes: readonly CellType[];
  /** Fallback renderer for successful values when the cell type has none.
   *  The built-in default renders Arrow-shaped values as a DataTable and
   *  everything else as compact code. */
  defaultRenderResult?: (value: unknown) => ReactNode;
}

let generatedId = 0;

function defaultRender(value: unknown): ReactNode {
  return (
    <code>
      {typeof value === "object" && value !== null ? JSON.stringify(value) : String(value)}
    </code>
  );
}

const RAIL: Record<string, { glyph: string; title: string }> = {
  error: { glyph: "×", title: "failed" },
  "upstream-error": { glyph: "↑×", title: "not run: an upstream cell failed" },
  cycle: { glyph: "⟳", title: "not run: circular reference" },
  unresolved: { glyph: "?", title: "waiting for a reference no cell defines" },
  success: { glyph: "·", title: "up to date" },
};

function StatusRail({ state }: { state: NodeState | undefined }) {
  if (!state) return <span className={styles.rail} aria-hidden="true" />;
  if (state.status === "pending") {
    return (
      <span className={styles.rail}>
        <Spinner label="running" />
      </span>
    );
  }
  const rail = RAIL[state.status];
  const failed = state.status !== "success";
  return (
    <span className={cx(styles.rail, failed && styles.railFailed)} title={rail?.title}>
      {rail?.glyph ?? ""}
    </span>
  );
}

function cellMessage(state: NodeState | undefined, docError: string | undefined): string | null {
  if (docError) return docError;
  if (!state) return null;
  switch (state.status) {
    case "error":
      return String(state.error);
    case "upstream-error":
      return `not run: upstream cell "${state.upstream ?? "?"}" failed`;
    case "cycle":
      return "not run: circular reference";
    case "unresolved":
      return "waiting: references a name no cell defines";
    default:
      return null;
  }
}

interface CellViewProps {
  cell: NotebookCell;
  cellType: CellType;
  state: NodeState | undefined;
  docError: string | undefined;
  renderFallback: (value: unknown) => ReactNode;
  onCommit: (id: string, source: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, delta: -1 | 1) => void;
}

function CellView({
  cell,
  cellType,
  state,
  docError,
  renderFallback,
  onCommit,
  onRemove,
  onMove,
}: CellViewProps) {
  const rootRef = useRef<HTMLElement>(null);
  const draftRef = useRef(cell.source);
  const executable = cellType.execute !== undefined;
  const message = cellMessage(executable ? state : undefined, docError);

  const commit = useCallback(() => {
    if (draftRef.current !== cell.source) onCommit(cell.id, draftRef.current);
  }, [cell.id, cell.source, onCommit]);

  const onCellKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== rootRef.current) {
      // Keys inside the editor: Escape returns focus to the cell; Mod+Enter
      // commits and runs. Everything else belongs to the editor.
      if (event.key === "Escape") {
        rootRef.current?.focus();
      } else if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        event.stopPropagation();
        commit();
      }
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Enter") {
      event.preventDefault();
      rootRef.current?.querySelector<HTMLElement>("[contenteditable], textarea")?.focus();
    } else if (event.altKey && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      onMove(cell.id, event.key === "ArrowUp" ? -1 : 1);
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      const sibling =
        event.key === "ArrowUp"
          ? rootRef.current.previousElementSibling
          : rootRef.current.nextElementSibling;
      (sibling as HTMLElement | null)?.focus?.();
    }
  };

  const status = docError ? "doc-error" : executable ? (state?.status ?? "idle") : "static";

  return (
    // biome-ignore lint/a11y/useSemanticElements: a focusable composite item needs the explicit role.
    <section
      ref={rootRef}
      className={styles.cell}
      // biome-ignore lint/a11y/noNoninteractiveTabindex: cells are the stops of a keyboard composite (arrow-key navigation between them).
      tabIndex={0}
      role="listitem"
      aria-label={`${cellType.label} cell${cell.name ? ` ${cell.name}` : ""}`}
      data-cell-id={cell.id}
      data-cell-type={cell.type}
      data-status={status}
      onKeyDown={onCellKeyDown}
    >
      <StatusRail state={executable && !docError ? state : undefined} />
      <div className={styles.cellBody}>
        <header className={styles.cellHead}>
          <span className={styles.cellName}>
            {cell.name ?? cellType.label.toLowerCase()}
            <span className={styles.cellTypeTag}>{cellType.label}</span>
          </span>
          <span className={styles.cellActions}>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Move cell up"
              onClick={() => onMove(cell.id, -1)}
            >
              {"↑"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              aria-label="Move cell down"
              onClick={() => onMove(cell.id, 1)}
            >
              {"↓"}
            </Button>
            {executable ? (
              <Button size="sm" variant="secondary" data-testid={`run-${cell.id}`} onClick={commit}>
                Run
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              aria-label="Delete cell"
              onClick={() => onRemove(cell.id)}
            >
              {"✕"}
            </Button>
          </span>
        </header>
        {cellType.renderStatic ? (
          <div className={styles.cellStatic}>
            <Markdown
              value={cell.source}
              editable
              onChange={(next) => onCommit(cell.id, next)}
              placeholder="Double-click to write…"
            />
          </div>
        ) : (
          <CodeEditor
            defaultValue={cell.source}
            onChange={(next) => {
              draftRef.current = next;
            }}
            extensions={cellType.editorExtensions?.() ?? []}
            aria-label={`${cell.name ?? cellType.label} source`}
          />
        )}
        {executable && state?.status === "success" ? (
          <div className={styles.cellResult}>
            {(cellType.renderResult ?? renderFallback)(state.value)}
          </div>
        ) : null}
        {message ? (
          <p
            className={styles.cellMessage}
            data-tone={docError || state?.status !== "unresolved" ? "danger" : "muted"}
          >
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}

/** A reactive notebook surface: cells form a dependency graph, editing one
 *  re-runs its dependents, and results render through sf components. Both
 *  engines are the consumer's — the data engine behind `createSqlCellType`'s
 *  executor and any further languages via the `CellType` contract. */
export const Notebook = forwardRef<HTMLDivElement, NotebookProps>(function Notebook(
  { document: doc, onDocumentChange, cellTypes, defaultRenderResult, className, ...rest },
  ref,
) {
  const registry = useMemo(() => new Map(cellTypes.map((t) => [t.type, t])), [cellTypes]);
  const issues = useMemo(() => validateDocument(doc, registry), [doc, registry]);
  const states = useNotebookGraph(doc, registry, issues);
  const renderFallback = defaultRenderResult ?? defaultRender;

  const commit = useCallback(
    (id: string, source: string) => {
      onDocumentChange({
        ...doc,
        cells: doc.cells.map((c) => (c.id === id ? { ...c, source } : c)),
      });
    },
    [doc, onDocumentChange],
  );
  const remove = useCallback(
    (id: string) => {
      onDocumentChange({ ...doc, cells: doc.cells.filter((c) => c.id !== id) });
    },
    [doc, onDocumentChange],
  );
  const move = useCallback(
    (id: string, delta: -1 | 1) => {
      const cells = [...doc.cells];
      const from = cells.findIndex((c) => c.id === id);
      const to = from + delta;
      if (from < 0 || to < 0 || to >= cells.length) return;
      const [cell] = cells.splice(from, 1);
      cells.splice(to, 0, cell as NotebookCell);
      onDocumentChange({ ...doc, cells });
    },
    [doc, onDocumentChange],
  );
  const add = useCallback(
    (type: string) => {
      const cellType = registry.get(type);
      const id = `cell-${Date.now().toString(36)}-${generatedId++}`;
      const name = cellType?.execute ? `untitled_${generatedId}` : undefined;
      onDocumentChange({ ...doc, cells: [...doc.cells, { id, type, name, source: "" }] });
    },
    [doc, onDocumentChange, registry],
  );

  const running = Object.values(states).filter((s) => s.status === "pending").length;

  return (
    <div ref={ref} className={cx(styles.root, className)} {...rest}>
      {/* biome-ignore lint/a11y/useSemanticElements: the cell list is a keyboard composite, not a ul. */}
      <div role="list" className={styles.cells} aria-label="Notebook cells">
        {doc.cells.map((cell) => {
          const cellType = registry.get(cell.type);
          if (!cellType) {
            return (
              <section
                key={cell.id}
                className={styles.cell}
                data-cell-id={cell.id}
                data-status="doc-error"
              >
                <span className={cx(styles.rail, styles.railFailed)}>{"×"}</span>
                <p className={styles.cellMessage} data-tone="danger">
                  {issues.byCell.get(cell.id) ?? `unknown cell type "${cell.type}"`}
                </p>
              </section>
            );
          }
          return (
            <CellView
              key={cell.id}
              cell={cell}
              cellType={cellType}
              state={cell.name ? states[cell.name] : undefined}
              docError={issues.byCell.get(cell.id)}
              renderFallback={renderFallback}
              onCommit={commit}
              onRemove={remove}
              onMove={move}
            />
          );
        })}
      </div>
      <footer className={styles.foot}>
        <span className={styles.addRow}>
          {cellTypes.map((t) => (
            <Button key={t.type} size="sm" variant="secondary" onClick={() => add(t.type)}>
              + {t.label}
            </Button>
          ))}
        </span>
        <span className={styles.live} aria-live="polite">
          {running > 0 ? `running ${running} cell${running === 1 ? "" : "s"}` : ""}
        </span>
      </footer>
    </div>
  );
});
