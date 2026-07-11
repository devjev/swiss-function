/**
 * The spike's notebook surface: a cell list with a status rail, sf editors,
 * and rendered results. Deliberately spike-grade (the polish is issues
 * #59/#60); it must be honest about the mechanics, not beautiful.
 */
import {Button} from "@tarassov-ch/swiss-function/button";
import {CodeEditor} from "@tarassov-ch/swiss-function/code-editor";
import {Spinner} from "@tarassov-ch/swiss-function/spinner";
import {TextEdit} from "@tarassov-ch/swiss-function/text-edit";
import {useCallback, useState} from "react";
import type {CellDoc, CellType, NotebookDoc} from "../contract";
import type {NodeState, SchedulerFactory} from "../scheduler/types";
import {useNotebook} from "./useNotebook";

let nextId = 100;

function StatusRail({state}: {state: NodeState | undefined}) {
  if (!state) return <span className="rail rail-static" title="not executed" />;
  switch (state.status) {
    case "pending":
      return (
        <span className="rail">
          <Spinner variant="braille" label="running" />
        </span>
      );
    case "error":
      return (
        <span className="rail rail-error" title={String(state.error)}>
          ×
        </span>
      );
    case "upstream-error":
      return (
        <span className="rail rail-error" title={`upstream failed: ${state.upstream ?? ""}`}>
          ↑×
        </span>
      );
    case "cycle":
      return (
        <span className="rail rail-error" title="circular reference">
          ⟳
        </span>
      );
    case "unresolved":
      return (
        <span className="rail rail-muted" title="waiting for a reference">
          ?
        </span>
      );
    default:
      return <span className="rail rail-ok">·</span>;
  }
}

function CellView({
  cell,
  cellType,
  state,
  onCommit,
  onRemove,
  onMove,
}: {
  cell: CellDoc;
  cellType: CellType;
  state: NodeState | undefined;
  onCommit: (id: string, source: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, delta: -1 | 1) => void;
}) {
  const [draft, setDraft] = useState(cell.source);
  const dirty = draft !== cell.source;
  const commit = () => onCommit(cell.id, draft);

  return (
    <section className="cell" data-cell-id={cell.id} data-cell-type={cell.type} data-status={state?.status ?? "static"}>
      <StatusRail state={cellType.execute ? state : undefined} />
      <div className="cell-body">
        <header className="cell-head">
          <span className="cell-name">
            {cell.name ? `${cell.name}` : cellType.label.toLowerCase()}
            <span className="cell-type-tag">{cellType.label}</span>
          </span>
          <span className="cell-actions">
            <Button size="sm" variant="ghost" onClick={() => onMove(cell.id, -1)} aria-label="move up">
              ↑
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onMove(cell.id, 1)} aria-label="move down">
              ↓
            </Button>
            {cellType.execute ? (
              <Button size="sm" variant={dirty ? "primary" : "secondary"} onClick={commit} data-testid={`run-${cell.id}`}>
                Run
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={() => onRemove(cell.id)} aria-label="delete cell">
              ✕
            </Button>
          </span>
        </header>
        {cellType.renderStatic ? (
          <div className="cell-static" onDoubleClick={() => undefined}>
            {cellType.renderStatic(dirty ? draft : cell.source)}
            <TextEdit rows={2} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} />
          </div>
        ) : (
          <div
            onKeyDownCapture={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                commit();
              }
            }}
          >
            <CodeEditor value={draft} onChange={setDraft} extensions={cellType.editorExtensions?.() ?? []} />
          </div>
        )}
        {cellType.execute && state?.status === "success" ? (
          <div className="cell-result">{(cellType.renderResult ?? defaultRender)(state.value)}</div>
        ) : null}
        {state?.status === "error" ? <p className="cell-message">{String(state.error)}</p> : null}
        {state?.status === "upstream-error" ? (
          <p className="cell-message">not run: upstream cell "{state.upstream}" failed</p>
        ) : null}
        {state?.status === "cycle" ? <p className="cell-message">not run: circular reference</p> : null}
        {state?.status === "unresolved" ? (
          <p className="cell-message">waiting: references a name no cell defines</p>
        ) : null}
      </div>
    </section>
  );
}

function defaultRender(value: unknown) {
  return <code>{typeof value === "object" ? JSON.stringify(value) : String(value)}</code>;
}

export function NotebookShell({
  initial,
  cellTypes,
  createScheduler,
}: {
  initial: NotebookDoc;
  cellTypes: Record<string, CellType>;
  createScheduler: SchedulerFactory;
}) {
  const [doc, setDoc] = useState<NotebookDoc>(initial);
  const {states, lastWave} = useNotebook(doc, cellTypes, createScheduler);

  const commit = useCallback((id: string, source: string) => {
    setDoc((d) => ({...d, cells: d.cells.map((c) => (c.id === id ? {...c, source} : c))}));
  }, []);
  const remove = useCallback((id: string) => {
    setDoc((d) => ({...d, cells: d.cells.filter((c) => c.id !== id)}));
  }, []);
  const move = useCallback((id: string, delta: -1 | 1) => {
    setDoc((d) => {
      const cells = [...d.cells];
      const i = cells.findIndex((c) => c.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= cells.length) return d;
      const [cell] = cells.splice(i, 1);
      cells.splice(j, 0, cell as CellDoc);
      return {...d, cells};
    });
  }, []);
  const add = useCallback(
    (type: string) => {
      const id = `c${nextId++}`;
      const name = cellTypes[type]?.execute ? `cell_${id}` : undefined;
      setDoc((d) => ({...d, cells: [...d.cells, {id, type, name, source: ""}]}));
    },
    [cellTypes]
  );

  return (
    <div className="notebook">
      {doc.cells.map((cell) => {
        const type = cellTypes[cell.type];
        if (!type) return null;
        return (
          <CellView
            key={cell.id}
            cell={cell}
            cellType={type}
            state={cell.name ? states[cell.name] : undefined}
            onCommit={commit}
            onRemove={remove}
            onMove={move}
          />
        );
      })}
      <footer className="notebook-foot">
        <span className="add-cell">
          {Object.values(cellTypes).map((t) => (
            <Button key={t.type} size="sm" variant="secondary" onClick={() => add(t.type)}>
              + {t.label}
            </Button>
          ))}
        </span>
        {lastWave ? (
          <span className="wave-stats" data-testid="wave-stats" data-ms={lastWave.ms.toFixed(1)}>
            last wave settled in {lastWave.ms.toFixed(1)} ms
          </span>
        ) : null}
      </footer>
    </div>
  );
}
