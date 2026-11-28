import type { CSSProperties, HTMLAttributes, PointerEvent as ReactPointerEvent } from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cx } from "../../lib/cx";
import { hitArea } from "../../lib/hitArea";
import { mergeRefs } from "../../lib/mergeRefs";
import { DEFAULT_UNIT_PX, measureCssLength } from "../../lib/useCssPx";
import styles from "./GridOverlay.module.css";
import {
  cellAt,
  formatCell,
  formatRange,
  type GridCell,
  type GridRange,
  parseRange,
  rangeBox,
  rangeOf,
  rangeSize,
} from "./grid";

export interface GridOverlayLayers {
  /** A line where body text sits in every unit line. Default `true`. */
  baseline?: boolean;
  /** A hairline at every cell edge, stronger every `major` cells. Default
   *  `true`. */
  cells?: boolean;
  /** `row:col` at every major crossing. Default `true`. */
  labels?: boolean;
}

/** A place picked on the grid. */
export interface GridPick {
  range: GridRange;
  /** Its name: `3:2` for a cell, `3:2-5:10` for a range. */
  text: string;
}

export interface GridOverlayProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** The cell size in units, to start with (the panel changes it). Default
   *  1: a cell is one unit square. */
  cell?: number;
  /** Cells between the stronger, labelled lines. Default 5. */
  major?: number;
  /** The layers shown to start with (the panel toggles them). */
  layers?: GridOverlayLayers;
  /** Cover the viewport instead of the positioned container. Default
   *  `false`. */
  fixed?: boolean;
  /** Show the panel with the layer toggles, the cell size and Pick. Default
   *  `true`. */
  panel?: boolean;
  /** Places to outline, by name (`"3:2"`, `"3:2-5:10"`): how an agent shows
   *  what it means. A name that does not parse is skipped. */
  marks?: string[];
  /** A cell or a range was picked (its name is also copied to the
   *  clipboard). */
  onPick?: (pick: GridPick) => void;
}

/** One step of the cell sizes the panel offers. */
const CELL_STEPS = [1, 2, 4];

/**
 * A development overlay that draws the unit grid over a region and names its
 * cells, so a person and an agent can point at the same place: "the title
 * belongs at 3:2", "the panel runs 5:1-12:16".
 *
 * A cell is one unit square (`--sf-unit`, so it follows the density); rows and
 * columns count from 1 at the top left, row first. The overlay covers its
 * positioned container (or the viewport with `fixed`) and takes no pointer
 * events, so the app works under it. In pick mode (the panel's Pick) a press
 * names a cell and a drag a range; the name is copied and passed to
 * `onPick`.
 */
export const GridOverlay = forwardRef<HTMLDivElement, GridOverlayProps>(function GridOverlay(
  {
    cell: cellProp = 1,
    major = 5,
    layers: layersProp,
    fixed = false,
    panel = true,
    marks,
    onPick,
    className,
    style,
    ...rest
  },
  ref,
) {
  const rootRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<HTMLSpanElement>(null);

  const [layers, setLayers] = useState<Required<GridOverlayLayers>>({
    baseline: layersProp?.baseline ?? true,
    cells: layersProp?.cells ?? true,
    labels: layersProp?.labels ?? true,
  });
  const [cell, setCell] = useState(Math.max(1, cellProp));
  const [unitPx, setUnitPx] = useState(DEFAULT_UNIT_PX);
  const [baselinePx, setBaselinePx] = useState(0);
  const [size, setSize] = useState({ width: 0, height: 0 });
  // The rows of labels in view: a tall region renders only those.
  const [visible, setVisible] = useState({ top: 0, bottom: 0 });
  const [hover, setHover] = useState<{ cell: GridCell; x: number; y: number } | null>(null);
  const [picking, setPicking] = useState(false);
  const [drag, setDrag] = useState<{ start: GridCell; range: GridRange } | null>(null);
  const [last, setLast] = useState<{ text: string; range: GridRange; copied: boolean } | null>(
    null,
  );

  const cellPx = unitPx * cell;
  const majorPx = cellPx * Math.max(1, major);

  // Measure the unit, the body baseline inside a unit line, the region's size
  // and the part of it in view; again whenever the region resizes or scrolls.
  const measure = useCallback(() => {
    const root = rootRef.current;
    if (!root) return;
    const unit = measureCssLength(root, "var(--sf-unit)");
    if (unit > 0) setUnitPx(Math.round(unit * 100) / 100);
    const probe = probeRef.current;
    const mark = markRef.current;
    if (probe && mark) {
      setBaselinePx(
        Math.round(mark.getBoundingClientRect().top - probe.getBoundingClientRect().top),
      );
    }
    const rect = root.getBoundingClientRect();
    setSize({ width: rect.width, height: rect.height });
    setVisible({
      top: Math.max(0, -rect.top),
      bottom: Math.min(rect.height, window.innerHeight - rect.top),
    });
  }, []);

  useLayoutEffect(() => {
    measure();
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(root);
    window.addEventListener("scroll", measure, { capture: true, passive: true });
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("scroll", measure, { capture: true });
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // The cell under the pointer, read from the window so the overlay itself
  // never takes a pointer event outside pick mode.
  useEffect(() => {
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const root = rootRef.current;
        if (!root) return;
        const rect = root.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) setHover(null);
        else setHover({ cell: cellAt(x, y, cellPx), x, y });
      });
    };
    const onLeave = () => setHover(null);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [cellPx]);

  // Escape leaves pick mode.
  useEffect(() => {
    if (!picking) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPicking(false);
        setDrag(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [picking]);

  const cellFromEvent = (e: ReactPointerEvent<HTMLDivElement>): GridCell => {
    const rect = (rootRef.current as HTMLDivElement).getBoundingClientRect();
    const x = Math.min(Math.max(0, e.clientX - rect.left), rect.width - 1);
    const y = Math.min(Math.max(0, e.clientY - rect.top), rect.height - 1);
    return cellAt(x, y, cellPx);
  };

  const finishPick = (range: GridRange) => {
    const text = formatRange(range);
    setLast({ text, range, copied: false });
    onPick?.({ range, text });
    const clip = typeof navigator !== "undefined" ? navigator.clipboard : undefined;
    clip?.writeText(text).then(
      () => setLast((now) => (now && now.text === text ? { ...now, copied: true } : now)),
      () => {},
    );
  };

  const markRanges = useMemo(
    () => (marks ?? []).map((m) => parseRange(m)).filter((r): r is GridRange => r != null),
    [marks],
  );

  const labels = useMemo(() => {
    if (!layers.labels || majorPx <= 0 || size.width === 0) return [];
    const out: { key: string; left: number; top: number; text: string }[] = [];
    const firstRow = Math.max(0, Math.floor(visible.top / majorPx));
    const lastRow = Math.ceil(visible.bottom / majorPx);
    const cols = Math.ceil(size.width / majorPx);
    for (let r = firstRow; r < lastRow; r++) {
      for (let c = 0; c < cols; c++) {
        const at = { row: r * major + 1, col: c * major + 1 };
        out.push({ key: `${r}:${c}`, left: c * majorPx, top: r * majorPx, text: formatCell(at) });
      }
    }
    return out;
  }, [layers.labels, majorPx, major, size.width, visible]);

  const toggle = (layer: keyof GridOverlayLayers) =>
    setLayers((now) => ({ ...now, [layer]: !now[layer] }));

  const nextCell = () =>
    setCell((now) => CELL_STEPS[(CELL_STEPS.indexOf(now) + 1) % CELL_STEPS.length] ?? 1);

  const rootStyle = {
    "--go-cell": `${cellPx}px`,
    "--go-major": `${majorPx}px`,
    "--go-baseline": `${baselinePx}px`,
    ...style,
  } as CSSProperties;

  const box = (range: GridRange) => {
    const b = rangeBox(range, cellPx);
    return { left: b.left, top: b.top, width: b.width, height: b.height };
  };

  // The pointer's name sits beside it, and flips to the other side near the
  // region's right or bottom edge.
  const chip = hover
    ? {
        left: hover.x + 12 > size.width - 4 * unitPx ? hover.x - 12 : hover.x + 12,
        top: hover.y + 12 > size.height - 2 * unitPx ? hover.y - 12 : hover.y + 12,
        flipX: hover.x + 12 > size.width - 4 * unitPx,
        flipY: hover.y + 12 > size.height - 2 * unitPx,
      }
    : null;

  const shown = drag?.range ?? last?.range ?? null;
  const shownSize = shown ? rangeSize(shown) : null;

  return (
    <div
      ref={mergeRefs(ref, rootRef)}
      {...rest}
      className={cx(styles.root, className)}
      style={rootStyle}
      data-fixed={fixed || undefined}
      data-picking={picking || undefined}
      aria-hidden={panel ? undefined : true}
    >
      <div ref={probeRef} className={styles.probe} aria-hidden="true">
        <span ref={markRef} className={styles.probeMark} />
      </div>
      {layers.cells ? <div className={styles.cells} data-layer="cells" aria-hidden="true" /> : null}
      {layers.baseline ? (
        <div className={styles.baselines} data-layer="baseline" aria-hidden="true" />
      ) : null}
      {labels.length > 0 ? (
        <div className={styles.labels} data-layer="labels" aria-hidden="true">
          {labels.map((l) => (
            <span key={l.key} className={styles.label} style={{ left: l.left, top: l.top }}>
              {l.text}
            </span>
          ))}
        </div>
      ) : null}
      {markRanges.map((range) => (
        <div
          key={formatRange(range)}
          className={styles.mark}
          style={box(range)}
          data-mark={formatRange(range)}
          aria-hidden="true"
        >
          <span className={styles.markLabel}>{formatRange(range)}</span>
        </div>
      ))}
      {shown ? (
        <div className={styles.pick} style={box(shown)} data-pick="" aria-hidden="true" />
      ) : null}
      {hover && !drag ? (
        <div
          className={styles.hover}
          style={box(rangeOf(hover.cell, hover.cell))}
          aria-hidden="true"
        />
      ) : null}
      {hover && chip ? (
        <span
          className={styles.chip}
          style={{ left: chip.left, top: chip.top }}
          data-flip-x={chip.flipX || undefined}
          data-flip-y={chip.flipY || undefined}
          data-chip=""
          aria-hidden="true"
        >
          {drag ? formatRange(drag.range) : formatCell(hover.cell)}
        </span>
      ) : null}
      {picking ? (
        <div
          className={styles.capture}
          data-capture=""
          onPointerDown={(e) => {
            e.preventDefault();
            e.currentTarget.setPointerCapture(e.pointerId);
            const start = cellFromEvent(e);
            setDrag({ start, range: rangeOf(start, start) });
          }}
          onPointerMove={(e) => {
            if (!drag) return;
            setDrag({ start: drag.start, range: rangeOf(drag.start, cellFromEvent(e)) });
          }}
          onPointerUp={(e) => {
            if (!drag) return;
            const range = rangeOf(drag.start, cellFromEvent(e));
            setDrag(null);
            finishPick(range);
          }}
          onPointerCancel={() => setDrag(null)}
        />
      ) : null}
      {panel ? (
        <fieldset className={styles.panel} aria-label="Unit grid" data-panel="">
          <div className={styles.panelLine}>
            <span>
              1u {unitPx}px · cell {cell}u
            </span>
            <span className={styles.panelCell} data-hover-cell="">
              {hover ? formatCell(hover.cell) : ""}
            </span>
          </div>
          <div className={styles.panelKeys}>
            {(["baseline", "cells", "labels"] as const).map((layer) => (
              <button
                key={layer}
                type="button"
                className={cx(styles.key, hitArea.block)}
                aria-pressed={layers[layer]}
                onClick={() => toggle(layer)}
              >
                {layers[layer] ? "[x]" : "[ ]"} {layer}
              </button>
            ))}
            <button
              type="button"
              className={cx(styles.key, hitArea.block)}
              onClick={nextCell}
              aria-label={`Cell size ${cell} units`}
            >
              [{cell}u]
            </button>
            <button
              type="button"
              className={cx(styles.key, styles.pickKey, hitArea.block)}
              aria-pressed={picking}
              onClick={() => {
                setPicking((p) => !p);
                setDrag(null);
              }}
            >
              [{picking ? "picking" : "pick"}]
            </button>
          </div>
          {last ? (
            <div className={styles.panelLine} data-last-pick="">
              <span>
                {last.text}
                {shownSize
                  ? ` · ${shownSize.rows} ${shownSize.rows === 1 ? "row" : "rows"} · ${shownSize.cols} ${shownSize.cols === 1 ? "col" : "cols"}`
                  : ""}
              </span>
              {last.copied ? <span className={styles.copied}>copied</span> : null}
            </div>
          ) : null}
        </fieldset>
      ) : null}
    </div>
  );
});
