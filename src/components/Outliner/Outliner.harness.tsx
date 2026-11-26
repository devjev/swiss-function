import { useMemo, useRef, useState } from "react";
import { SfDndProvider } from "../../lib/dnd";
import { Dialog } from "../Dialog";
import { Outliner } from "./Outliner";
import { flatVisible } from "./tree";
import type { BulletId, OutlinerCompletionRequest, OutlinerHandle, OutlinerValue } from "./types";

interface HarnessProps {
  initial: OutlinerValue;
  readOnly?: boolean;
  /** A registry of bullet content for block-ref resolution. */
  blockRefs?: Record<string, string>;
  /** Width of the outline in px (to force soft wraps). */
  width?: number;
  /** Offer completions: a fixed set of pages, blocks, tags and commands,
   *  filtered by the query. */
  withCompletions?: boolean;
  /** Start zoomed on this block. The zoom is printed in the `root` output. */
  initialRoot?: BulletId;
  zoomable?: boolean;
  reorderable?: boolean;
  frame?: boolean;
  /** Replace `initial` with this many flat blocks (r0, r1, ...) and virtualize
   *  them in a box of `height` px. */
  rows?: number;
  height?: number;
  /** Give every fifth of those rows a second line. */
  tall?: boolean;
  /** Wrap the outline in an `SfDndProvider`. */
  shared?: boolean;
  /** Take pasted and dropped files: each gets the URL `upload:<name>`. */
  withUpload?: boolean;
  /** The touch toolbar: `true` shows it with a mouse as well. */
  toolbar?: boolean | "auto";
  /** What the `api-edit` and `api-select` buttons act on. */
  apiTarget?: BulletId;
  apiOffset?: number;
}

const PAGES = ["Project Alpha", "Project Beta", "Daily notes"];

function complete({ trigger, query }: OutlinerCompletionRequest) {
  const q = query.toLowerCase();
  if (trigger === "((") {
    return [
      { label: "The referenced block", description: "in Project Alpha", insert: "src" },
    ].filter((b) => b.label.toLowerCase().includes(q));
  }
  if (trigger === "/") {
    return [
      { label: "today", description: "Today's date", insert: "2026-11-19" },
      { label: "time", description: "The time", insert: "14:30" },
    ].filter((c) => c.label.startsWith(q));
  }
  return PAGES.filter((name) => name.toLowerCase().includes(q)).map((label) => ({ label }));
}

let minted = 0;

// Playwright CT mounts must be top-level component invocations; this harness
// owns the controlled value so specs can drive interactions. The visible tree
// is printed below the outline, one `depth id:content` line per block, and new
// blocks get predictable ids (n1, n2, ...).
export function OutlinerHarness({
  initial,
  readOnly,
  blockRefs,
  width,
  withCompletions,
  initialRoot,
  zoomable,
  reorderable,
  frame,
  rows,
  height,
  tall,
  shared,
  withUpload,
  toolbar,
  apiTarget = "",
  apiOffset,
}: HarnessProps) {
  const many = useMemo<OutlinerValue | null>(
    () =>
      rows
        ? Array.from({ length: rows }, (_, i) => ({
            id: `r${i}`,
            content: tall && i % 5 === 4 ? `Row ${i}\nsecond line` : `Row ${i}`,
          }))
        : null,
    [rows, tall],
  );
  const [value, setValue] = useState<OutlinerValue>(many ?? initial);
  const [changes, setChanges] = useState(0);
  const [root, setRoot] = useState<BulletId | null>(initialRoot ?? null);
  const [picked, setPicked] = useState("");
  const api = useRef<OutlinerHandle>(null);
  const outline = (
    <Outliner
      value={value}
      onChange={(next) => {
        setValue(next);
        setChanges((n) => n + 1);
      }}
      readOnly={readOnly}
      generateId={() => `n${++minted}`}
      resolveBlockRef={blockRefs ? (id) => blockRefs[id] ?? null : undefined}
      completions={withCompletions ? complete : undefined}
      root={root}
      onRootChange={setRoot}
      zoomable={zoomable}
      reorderable={reorderable}
      frame={frame}
      virtualized={rows !== undefined}
      onUpload={withUpload ? (files) => files.map((file) => `upload:${file.name}`) : undefined}
      toolbar={toolbar}
      apiRef={api}
    />
  );
  return (
    <div style={{ inlineSize: width }}>
      <button type="button" data-testid="before">
        before
      </button>
      <div style={{ blockSize: height }}>
        {shared ? <SfDndProvider>{outline}</SfDndProvider> : outline}
      </div>
      <button type="button" data-testid="after">
        after
      </button>
      <button
        type="button"
        data-testid="api-edit"
        onClick={() => api.current?.edit(apiTarget, apiOffset)}
      >
        edit
      </button>
      <button type="button" data-testid="api-select" onClick={() => api.current?.select(apiTarget)}>
        select
      </button>
      <button
        type="button"
        data-testid="api-read"
        // Keep the focus in the outline: the selection is what is being read.
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => setPicked(JSON.stringify(api.current?.getSelection()))}
      >
        read
      </button>
      <button type="button" data-testid="api-undo" onClick={() => api.current?.undo()}>
        undo
      </button>
      <output data-testid="root">{root ?? "none"}</output>
      <output data-testid="picked">{picked}</output>
      <pre data-testid="tree">
        {flatVisible(value)
          .map((f) => `${f.depth} ${/^n\d+$/.test(f.id) ? "new" : f.id}:${f.bullet.content}`)
          .join("\n")}
      </pre>
      <output data-testid="changes">{changes}</output>
    </div>
  );
}

/** An outline with its touch toolbar forced on, in a modal dialog: the bar is
 *  outside the dialog's popup, and a press on it must not count as one outside
 *  the dialog. */
export function OutlinerDialogHarness({ initial }: { initial: OutlinerValue }) {
  const [value, setValue] = useState<OutlinerValue>(initial);
  return (
    <Dialog.Root defaultOpen>
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup>
          <Dialog.Title>Notes</Dialog.Title>
          <Outliner value={value} onChange={setValue} toolbar />
          <pre data-testid="tree">
            {flatVisible(value)
              .map((f) => `${f.depth} ${f.id}:${f.bullet.content}`)
              .join("\n")}
          </pre>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
