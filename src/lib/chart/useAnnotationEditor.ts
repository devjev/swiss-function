/** Annotation editing state machine for the 2D charts (issue #27 M3).
 *
 *  One hook owns everything the toolbar and the plot need: the armed tool,
 *  the in-flight draft while drawing, the selection, body/handle drags and
 *  the inline text editor. Every mutation produces a NEW ChartAnnotation[]
 *  through `onAnnotationsChange` — the array stays the document, and drags
 *  commit ONCE on pointerup (a document, not a 60 Hz stream; the in-flight
 *  drag renders from a local override instead).
 *
 *  Drawing conventions (Bloomberg-style, documented in API.md):
 *   - line/rect/measure: drag; commits only past a 4 px threshold
 *   - hline/vline: click places
 *   - text: click opens an inline input (Enter commits, Esc cancels)
 *   - after each successful draw the tool snaps back to "select"
 *
 *  Pointer precedence with useViewport is decided by STATE + TARGET, never
 *  listener ordering: while a tool is armed the chart passes
 *  `suspended: true` to useViewport (pan/pinch/dblclick dead, wheel live)
 *  and the editor's React handlers on the <svg> own the gesture; in select
 *  mode the viewport bails on `[data-annotation]` targets and the layer's
 *  delegated handler starts selection drags.
 */

import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from "react";
import { type RefObject, useCallback, useMemo, useRef, useState } from "react";
import type {
  AnnotationPart,
  AnnotationsEditingProps,
  AnnotationX,
  ChartAnnotation,
} from "./Annotations";

export type AnnotationTool = "select" | "line" | "hline" | "vline" | "rect" | "text" | "measure";

/** Pixels of drag before a two-point draw commits — a stray click must not
 *  create a degenerate shape. */
export const DRAW_THRESHOLD_PX = 4;

export interface DataPoint {
  x: AnnotationX;
  y: number;
}

let annotationIdCounter = 0;
function nextAnnotationId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `sf-annotation-${++annotationIdCounter}`;
}

/** Shift a data-x by a numeric delta (ms for dates), preserving Date-ness. */
function shiftX(x: AnnotationX, dx: number): AnnotationX {
  return x instanceof Date ? new Date(x.getTime() + dx) : x + dx;
}

/** Build the two-point draft for a drag draw. Returns null for tools that
 *  don't draw by dragging. */
export function draftFromDrag(
  tool: AnnotationTool,
  p1: DataPoint,
  p2: DataPoint,
): ChartAnnotation | null {
  switch (tool) {
    case "line":
      return { type: "line", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    case "measure":
      return { type: "measure", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    case "rect":
      return { type: "rect", x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y };
    default:
      return null;
  }
}

/** Translate a whole annotation by (dx, dy) in data units (dx in ms for
 *  Date anchors — Date-ness is preserved; full-height rects keep their
 *  undefined y anchors). */
export function translateAnnotation(a: ChartAnnotation, dx: number, dy: number): ChartAnnotation {
  switch (a.type) {
    case "hline":
      return { ...a, y: a.y + dy };
    case "vline":
      return { ...a, x: shiftX(a.x, dx) };
    case "text":
      return { ...a, x: shiftX(a.x, dx), y: a.y + dy };
    case "line":
    case "measure":
      return {
        ...a,
        x1: shiftX(a.x1, dx),
        y1: a.y1 + dy,
        x2: shiftX(a.x2, dx),
        y2: a.y2 + dy,
      };
    case "rect":
      return {
        ...a,
        x1: shiftX(a.x1, dx),
        x2: shiftX(a.x2, dx),
        y1: a.y1 != null ? a.y1 + dy : undefined,
        y2: a.y2 != null ? a.y2 + dy : undefined,
      };
  }
}

/** Move one defining anchor of an annotation to a new data point. */
export function moveAnnotationPoint(
  a: ChartAnnotation,
  part: AnnotationPart,
  x: AnnotationX,
  y: number,
): ChartAnnotation {
  if (part === "body") return a;
  switch (a.type) {
    case "hline":
      return { ...a, y };
    case "vline":
      return { ...a, x };
    case "text":
      return { ...a, x, y };
    case "line":
    case "measure":
      return part === "p1" ? { ...a, x1: x, y1: y } : { ...a, x2: x, y2: y };
    case "rect":
      // Full-height rects (y omitted) keep only their x anchors movable.
      return part === "p1"
        ? { ...a, x1: x, y1: a.y1 != null ? y : undefined }
        : { ...a, x2: x, y2: a.y2 != null ? y : undefined };
  }
}

export interface UseAnnotationEditorOptions {
  annotations: readonly ChartAnnotation[];
  onAnnotationsChange: ((next: ChartAnnotation[]) => void) | undefined;
  /** controls && onAnnotationsChange — everything is inert otherwise. */
  enabled: boolean;
  /** px → data, closing over the chart's resolved (zoomed) domains. Called
   *  ONLY inside pointer handlers (after render), so the chart may hand in a
   *  ref-reading indirection and fill the ref later in the same render —
   *  this lets the editor be called before the domains are computed (the
   *  viewport hook needs `toolArmed` and must come after this one). */
  xFromPx: (px: number) => AnnotationX;
  yFromPx: (px: number) => number;
  plotRef: RefObject<HTMLElement | null>;
}

export interface TextEditState {
  /** Data-space anchor — the chart positions the inline input with its own
   *  (current) scales so it tracks zoom. */
  anchor: DataPoint;
  value: string;
  onChange: (value: string) => void;
  commit: () => void;
  cancel: () => void;
}

export interface AnnotationEditor {
  tool: AnnotationTool;
  setTool: (tool: AnnotationTool) => void;
  selectedIndex: number | null;
  deleteSelected: () => void;
  /** Source annotations with the in-flight drag substituted and the draft
   *  appended — render THIS, not the raw prop. */
  displayAnnotations: readonly ChartAnnotation[];
  /** Editing props for AnnotationsLayer (undefined while not enabled). */
  layerEditing: AnnotationsEditingProps | undefined;
  /** Spread onto the plot <svg>. */
  surfaceProps: {
    onPointerDown?: (e: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerMove?: (e: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerUp?: (e: ReactPointerEvent<SVGSVGElement>) => void;
    onPointerCancel?: (e: ReactPointerEvent<SVGSVGElement>) => void;
    onClickCapture?: (e: React.MouseEvent) => void;
  };
  /** Run BEFORE the viewport keys; true = consumed. */
  handleKeyDown: (e: ReactKeyboardEvent) => boolean;
  /** Inline text input state, or null. */
  textEdit: TextEditState | null;
  /** tool !== "select" — feed to useViewport({suspended}) and cursor CSS. */
  toolArmed: boolean;
}

interface DrawState {
  startPx: { x: number; y: number };
  startData: DataPoint;
  moved: boolean;
}

interface DragState {
  index: number;
  part: AnnotationPart;
  original: ChartAnnotation;
  startData: DataPoint;
  moved: boolean;
}

interface TextDraft {
  anchor: DataPoint;
  value: string;
  /** Existing annotation being re-edited, or null for a new note. */
  editIndex: number | null;
}

export function useAnnotationEditor({
  annotations,
  onAnnotationsChange,
  enabled,
  xFromPx,
  yFromPx,
  plotRef,
}: UseAnnotationEditorOptions): AnnotationEditor {
  const [tool, setToolState] = useState<AnnotationTool>("select");
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<ChartAnnotation | null>(null);
  const [dragOverride, setDragOverride] = useState<{
    index: number;
    annotation: ChartAnnotation;
  } | null>(null);
  const [textDraft, setTextDraft] = useState<TextDraft | null>(null);

  const drawRef = useRef<DrawState | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const suppressClickRef = useRef(false);

  const toolArmed = enabled && tool !== "select";

  const setTool = useCallback((next: AnnotationTool) => {
    setToolState(next);
    setDraft(null);
    drawRef.current = null;
  }, []);

  const commit = useCallback(
    (next: ChartAnnotation[]) => {
      onAnnotationsChange?.(next);
    },
    [onAnnotationsChange],
  );

  /** Local plot px + data point for a pointer event. */
  const pointOf = (e: { clientX: number; clientY: number }) => {
    const rect = plotRef.current?.getBoundingClientRect();
    const px = rect ? { x: e.clientX - rect.left, y: e.clientY - rect.top } : { x: 0, y: 0 };
    return { px, data: { x: xFromPx(px.x), y: yFromPx(px.y) } as DataPoint };
  };

  const deleteSelected = useCallback(() => {
    if (selectedIndex == null) return;
    commit(annotations.filter((_, i) => i !== selectedIndex));
    setSelectedIndex(null);
  }, [annotations, commit, selectedIndex]);

  const closeTextEdit = useCallback(() => setTextDraft(null), []);

  const commitTextEdit = useCallback(() => {
    if (!textDraft) return;
    const text = textDraft.value.trim();
    if (text) {
      if (textDraft.editIndex != null) {
        const next = annotations.map((a, i) =>
          i === textDraft.editIndex && a.type === "text" ? { ...a, text } : a,
        );
        commit(next);
        setSelectedIndex(textDraft.editIndex);
      } else {
        commit([
          ...annotations,
          {
            type: "text",
            x: textDraft.anchor.x,
            y: textDraft.anchor.y,
            text,
            id: nextAnnotationId(),
          },
        ]);
        setSelectedIndex(annotations.length);
      }
    }
    setTextDraft(null);
    setToolState("select");
  }, [annotations, commit, textDraft]);

  // --- Drawing (armed tool, gestures on the svg) ---------------------------

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (!enabled || !toolArmed || e.button !== 0) return;
    const { px, data } = pointOf(e);
    drawRef.current = { startPx: px, startData: data, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    // Selection drag (started by the layer's delegated pointerdown).
    const drag = dragRef.current;
    if (drag) {
      const { data } = pointOf(e);
      drag.moved = true;
      const next =
        drag.part === "body"
          ? translateAnnotation(
              drag.original,
              Number(data.x) - Number(drag.startData.x),
              data.y - drag.startData.y,
            )
          : moveAnnotationPoint(drag.original, drag.part, data.x, data.y);
      setDragOverride({ index: drag.index, annotation: next });
      return;
    }
    // Draw preview.
    const draw = drawRef.current;
    if (!draw) return;
    const { px, data } = pointOf(e);
    if (
      !draw.moved &&
      Math.hypot(px.x - draw.startPx.x, px.y - draw.startPx.y) < DRAW_THRESHOLD_PX
    ) {
      return;
    }
    draw.moved = true;
    setDraft(draftFromDrag(tool, draw.startData, data));
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    // Finish a selection drag: one onAnnotationsChange for the whole gesture.
    const drag = dragRef.current;
    if (drag) {
      dragRef.current = null;
      if (drag.moved && dragOverride) {
        commit(annotations.map((a, i) => (i === drag.index ? dragOverride.annotation : a)));
        suppressClickRef.current = true;
      }
      setDragOverride(null);
      return;
    }
    const draw = drawRef.current;
    if (!draw) return;
    drawRef.current = null;
    const { data } = pointOf(e);
    if (draw.moved) {
      // Two-point draw past the threshold.
      const shape = draftFromDrag(tool, draw.startData, data);
      setDraft(null);
      if (shape) {
        commit([...annotations, { ...shape, id: nextAnnotationId() }]);
        setSelectedIndex(annotations.length);
        setToolState("select");
        suppressClickRef.current = true;
      }
      return;
    }
    // A click (below the threshold): place single-click tools.
    if (tool === "hline") {
      commit([...annotations, { type: "hline", y: data.y, id: nextAnnotationId() }]);
      setSelectedIndex(annotations.length);
      setToolState("select");
      suppressClickRef.current = true;
    } else if (tool === "vline") {
      commit([...annotations, { type: "vline", x: data.x, id: nextAnnotationId() }]);
      setSelectedIndex(annotations.length);
      setToolState("select");
      suppressClickRef.current = true;
    } else if (tool === "text") {
      setTextDraft({ anchor: data, value: "", editIndex: null });
      suppressClickRef.current = true;
    }
    // line/rect/measure clicks below the threshold create nothing.
  };

  const onPointerCancel = () => {
    drawRef.current = null;
    dragRef.current = null;
    setDraft(null);
    setDragOverride(null);
  };

  /** A draw or drag must not also click-activate the point underneath. */
  const onClickCapture = (e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  };

  // --- Selection (delegated from AnnotationsLayer) --------------------------

  // Plain functions (not useCallback): layerEditing is rebuilt per render
  // anyway, and pointOf closes over the current converters.
  const onAnnotationPointerDown = (index: number, part: AnnotationPart, e: ReactPointerEvent) => {
    if (!enabled || toolArmed || e.button !== 0) return;
    setSelectedIndex(index);
    const original = annotations[index];
    if (!original) return;
    const { data } = pointOf(e);
    dragRef.current = { index, part, original, startData: data, moved: false };
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onAnnotationDoubleClick = (index: number) => {
    const a = annotations[index];
    if (!enabled || !a || a.type !== "text") return;
    setTextDraft({ anchor: { x: a.x, y: a.y }, value: a.text, editIndex: index });
  };

  // --- Keyboard (runs before the viewport keys) -----------------------------

  const handleKeyDown = (e: ReactKeyboardEvent): boolean => {
    if (!enabled) return false;
    // While the inline text input is open it owns the keyboard completely —
    // typing "0" in a note must not reset the zoom.
    if (textDraft) return true;
    if ((e.key === "Delete" || e.key === "Backspace") && selectedIndex != null) {
      e.preventDefault();
      deleteSelected();
      return true;
    }
    if (e.key === "Enter" && selectedIndex != null) {
      const a = annotations[selectedIndex];
      if (a?.type === "text") {
        e.preventDefault();
        setTextDraft({ anchor: { x: a.x, y: a.y }, value: a.text, editIndex: selectedIndex });
        return true;
      }
      return false;
    }
    if (e.key === "Escape") {
      // Cascade: cancel draft → disarm tool → clear selection. stopPropagation
      // so a fullscreen chart doesn't also exit on the same keypress.
      if (drawRef.current || draft) {
        drawRef.current = null;
        setDraft(null);
      } else if (toolArmed) {
        setToolState("select");
      } else if (selectedIndex != null) {
        setSelectedIndex(null);
      } else {
        return false;
      }
      e.preventDefault();
      e.stopPropagation();
      return true;
    }
    return false;
  };

  // --- Derived output --------------------------------------------------------

  const displayAnnotations = useMemo(() => {
    let list: ChartAnnotation[] | readonly ChartAnnotation[] = annotations;
    if (dragOverride) {
      list = annotations.map((a, i) => (i === dragOverride.index ? dragOverride.annotation : a));
    }
    return draft ? [...list, draft] : list;
  }, [annotations, dragOverride, draft]);

  const draftIndex = draft ? displayAnnotations.length - 1 : null;

  const layerEditing: AnnotationsEditingProps | undefined = enabled
    ? {
        selectedIndex,
        draftIndex,
        toolArmed,
        onAnnotationPointerDown,
        onAnnotationDoubleClick,
      }
    : undefined;

  const textEdit: TextEditState | null = textDraft
    ? {
        anchor: textDraft.anchor,
        value: textDraft.value,
        onChange: (value: string) => setTextDraft((t) => (t ? { ...t, value } : t)),
        commit: commitTextEdit,
        cancel: () => {
          closeTextEdit();
          setToolState("select");
        },
      }
    : null;

  return {
    tool,
    setTool,
    selectedIndex: enabled ? selectedIndex : null,
    deleteSelected,
    displayAnnotations,
    layerEditing,
    surfaceProps: enabled
      ? { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onClickCapture }
      : {},
    handleKeyDown,
    textEdit,
    toolArmed,
  };
}
