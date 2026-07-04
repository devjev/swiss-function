/** Chart annotations (issue #27): a controlled, serializable array of plain
 *  JSON objects rendered as an SVG overlay. Anchors are DATA-space (x in
 *  domain units, y in value units) so annotations survive zoom, pan and
 *  resize; the layer reads the same (possibly zoomed) scales as the series.
 *  The array is the document — persistence and sharing belong to the
 *  consumer. Quiet by default: hairline strokes, mono labels, no fills louder
 *  than 8%.
 *
 *  With the optional `editing` props (issue #27 M3) the layer additionally
 *  renders wide transparent hit elements (`data-annotation`/`data-part`,
 *  resolved by ONE delegated pointerdown — the house delegation pattern) and
 *  square drag handles on the selected annotation. The visible shapes stay
 *  `pointer-events: none`; only the hit elements and handles are live. */

import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { cx } from "../cx";
import styles from "./Annotations.module.css";

export type AnnotationX = number | Date;

interface AnnotationBase {
  /** Stable identity for controlled updates. Falls back to the array index. */
  id?: string;
  /** CSS color; default `var(--sf-color-fg)`. */
  color?: string;
}

export type ChartAnnotation =
  /** Horizontal level (threshold, alert line) with a label at the left edge. */
  | (AnnotationBase & { type: "hline"; y: number; label?: string })
  /** Vertical event marker (release, earnings) with a label at the top. */
  | (AnnotationBase & { type: "vline"; x: AnnotationX; label?: string })
  /** Two-point trend line. */
  | (AnnotationBase & {
      type: "line";
      x1: AnnotationX;
      y1: number;
      x2: AnnotationX;
      y2: number;
      label?: string;
    })
  /** Shaded region. Omit y1/y2 for a full-height band (recession, regime). */
  | (AnnotationBase & {
      type: "rect";
      x1: AnnotationX;
      x2: AnnotationX;
      y1?: number;
      y2?: number;
      label?: string;
    })
  /** Text note anchored to a data point. */
  | (AnnotationBase & { type: "text"; x: AnnotationX; y: number; text: string })
  /** Two-point ruler: renders Δx / Δy / Δ% at the midpoint. */
  | (AnnotationBase & {
      type: "measure";
      x1: AnnotationX;
      y1: number;
      x2: AnnotationX;
      y2: number;
    });

/** The two defining anchors of an annotation, or its whole body. */
export type AnnotationPart = "body" | "p1" | "p2";

export interface AnnotationsEditingProps {
  selectedIndex: number | null;
  /** Index of an in-flight draft appended to `annotations` (rendered
   *  translucent, no hit elements), or null. */
  draftIndex: number | null;
  /** While a draw tool is armed, existing annotations go inert (no hit
   *  elements, no handles) so drawing over them works. */
  toolArmed: boolean;
  /** Delegated: fires for body and handle pointerdowns. */
  onAnnotationPointerDown: (index: number, part: AnnotationPart, e: ReactPointerEvent) => void;
  /** Double-click on an annotation (text notes re-open their editor). */
  onAnnotationDoubleClick?: (index: number) => void;
}

export interface AnnotationsLayerProps {
  annotations: readonly ChartAnnotation[];
  /** Data-x → SVG px, the chart's own (zoomed) scale. */
  xPx: (x: AnnotationX) => number;
  /** Data-y → SVG px. */
  yPx: (y: number) => number;
  width: number;
  height: number;
  /** Formats the Δx readout of `measure` annotations (e.g. "3d" for dates). */
  formatXDelta: (x1: AnnotationX, x2: AnnotationX) => string;
  /** Formats y values (Δy readout of `measure`). */
  formatY: (y: number) => string;
  /** Present = editable: hit elements, selection handles, delegation. */
  editing?: AnnotationsEditingProps;
}

function annotationColor(a: ChartAnnotation): string {
  return a.color ?? "var(--sf-color-fg)";
}

/** Default Δx readout for date-x charts: a compact duration. */
export function formatDateDelta(x1: AnnotationX, x2: AnnotationX): string {
  const ms = Math.abs(Number(x2) - Number(x1));
  const minutes = ms / 60_000;
  if (minutes < 60) return `${Math.round(minutes)}min`;
  const hours = minutes / 60;
  if (hours < 48) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 366) return `${Math.round(days)}d`;
  return `${(days / 365.25).toFixed(1)}y`;
}

/** Square drag handle at an anchor point. */
function Handle({ x, y, part }: { x: number; y: number; part: AnnotationPart }) {
  return (
    <rect x={x - 3} y={y - 3} width={6} height={6} className={styles.handle} data-part={part} />
  );
}

export function AnnotationsLayer({
  annotations,
  xPx,
  yPx,
  width,
  height,
  formatXDelta,
  formatY,
  editing,
}: AnnotationsLayerProps) {
  if (annotations.length === 0 && !editing) return null;

  const handlePointerDown = editing
    ? (e: ReactPointerEvent) => {
        const el = e.target instanceof Element ? e.target.closest("[data-annotation]") : null;
        if (!el) return;
        const index = Number(el.getAttribute("data-idx"));
        const part = ((e.target instanceof Element &&
          e.target.closest("[data-part]")?.getAttribute("data-part")) ??
          "body") as AnnotationPart;
        editing.onAnnotationPointerDown(index, part, e);
      }
    : undefined;
  const handleDoubleClick = editing?.onAnnotationDoubleClick
    ? (e: ReactMouseEvent) => {
        const el = e.target instanceof Element ? e.target.closest("[data-annotation]") : null;
        if (el) editing.onAnnotationDoubleClick?.(Number(el.getAttribute("data-idx")));
      }
    : undefined;

  return (
    // No aria-hidden needed: the chart <svg> is role="img", so this whole
    // subtree is already presentational to assistive tech.
    // biome-ignore lint/a11y/noStaticElementInteractions: pure event delegation for annotation editing — pointer-only affordances (drag handles); the keyboard path is Delete/Escape on the chart root.
    <g
      className={styles.root}
      data-annotations=""
      data-editable={editing ? "" : undefined}
      onPointerDown={handlePointerDown}
      onDoubleClick={handleDoubleClick}
    >
      {annotations.map((a, i) => {
        const key = a.id ?? `annotation-${i}`;
        const color = annotationColor(a);
        const isDraft = editing != null && i === editing.draftIndex;
        const interactive = editing != null && !isDraft && !editing.toolArmed;
        const isSelected = interactive && i === editing.selectedIndex;
        const itemProps = {
          "data-annotation": "",
          "data-idx": i,
          "data-draft": isDraft || undefined,
          "data-selected": isSelected || undefined,
        };
        switch (a.type) {
          case "hline": {
            const y = yPx(a.y);
            return (
              <g key={key} {...itemProps}>
                <line
                  x1={0}
                  x2={width}
                  y1={y}
                  y2={y}
                  className={styles.refLine}
                  style={{ stroke: color }}
                />
                {a.label ? (
                  <text x={4} y={y - 4} className={styles.label} style={{ fill: color }}>
                    {a.label}
                  </text>
                ) : null}
                {interactive ? (
                  <line x1={0} x2={width} y1={y} y2={y} className={styles.hit} data-part="body" />
                ) : null}
                {isSelected ? <Handle x={width / 2} y={y} part="p1" /> : null}
              </g>
            );
          }
          case "vline": {
            const x = xPx(a.x);
            return (
              <g key={key} {...itemProps}>
                <line
                  x1={x}
                  x2={x}
                  y1={0}
                  y2={height}
                  className={styles.refLine}
                  style={{ stroke: color }}
                />
                {a.label ? (
                  <text x={x + 4} y={12} className={styles.label} style={{ fill: color }}>
                    {a.label}
                  </text>
                ) : null}
                {interactive ? (
                  <line x1={x} x2={x} y1={0} y2={height} className={styles.hit} data-part="body" />
                ) : null}
                {isSelected ? <Handle x={x} y={height / 2} part="p1" /> : null}
              </g>
            );
          }
          case "line": {
            const x1 = xPx(a.x1);
            const y1 = yPx(a.y1);
            const x2 = xPx(a.x2);
            const y2 = yPx(a.y2);
            return (
              <g key={key} {...itemProps}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  className={styles.trendLine}
                  style={{ stroke: color }}
                />
                {a.label ? (
                  <text
                    x={(x1 + x2) / 2}
                    y={(y1 + y2) / 2 - 6}
                    textAnchor="middle"
                    className={styles.label}
                    style={{ fill: color }}
                  >
                    {a.label}
                  </text>
                ) : null}
                {interactive ? (
                  <line x1={x1} y1={y1} x2={x2} y2={y2} className={styles.hit} data-part="body" />
                ) : null}
                {isSelected ? (
                  <>
                    <Handle x={x1} y={y1} part="p1" />
                    <Handle x={x2} y={y2} part="p2" />
                  </>
                ) : null}
              </g>
            );
          }
          case "rect": {
            const x1 = xPx(a.x1);
            const x2 = xPx(a.x2);
            const y1 = a.y1 != null ? yPx(a.y1) : height;
            const y2 = a.y2 != null ? yPx(a.y2) : 0;
            const left = Math.min(x1, x2);
            const top = Math.min(y1, y2);
            return (
              <g key={key} {...itemProps}>
                <rect
                  x={left}
                  y={top}
                  width={Math.abs(x2 - x1)}
                  height={Math.abs(y2 - y1)}
                  className={styles.region}
                  style={{ fill: color }}
                />
                {a.label ? (
                  <text x={left + 4} y={top + 12} className={styles.label} style={{ fill: color }}>
                    {a.label}
                  </text>
                ) : null}
                {interactive ? (
                  <rect
                    x={left}
                    y={top}
                    width={Math.abs(x2 - x1)}
                    height={Math.abs(y2 - y1)}
                    className={styles.hitArea}
                    data-part="body"
                  />
                ) : null}
                {isSelected ? (
                  <>
                    {/* Full-height rects (y1/y2 omitted) get mid-edge handles
                        that move only x; bounded rects get corner anchors. */}
                    <Handle x={x1} y={a.y1 != null ? y1 : height / 2} part="p1" />
                    <Handle x={x2} y={a.y2 != null ? y2 : height / 2} part="p2" />
                  </>
                ) : null}
              </g>
            );
          }
          case "text": {
            const x = xPx(a.x);
            const y = yPx(a.y);
            return (
              <g key={key} {...itemProps}>
                <text
                  x={x}
                  y={y}
                  className={cx(styles.label, styles.note, interactive && styles.textHit)}
                  style={{ fill: color }}
                  data-part={interactive ? "body" : undefined}
                >
                  {a.text}
                </text>
                {isSelected ? <Handle x={x} y={y} part="p1" /> : null}
              </g>
            );
          }
          case "measure": {
            const x1 = xPx(a.x1);
            const y1 = yPx(a.y1);
            const x2 = xPx(a.x2);
            const y2 = yPx(a.y2);
            // Cap to 4 significant digits before formatting: drawn anchors
            // come from pixel inversion and carry float noise.
            const dy = Number((a.y2 - a.y1).toPrecision(4));
            const pct =
              a.y1 !== 0
                ? ` (${dy >= 0 ? "+" : ""}${((dy / Math.abs(a.y1)) * 100).toFixed(1)}%)`
                : "";
            const readout = `${formatXDelta(a.x1, a.x2)}  Δ ${formatY(dy)}${pct}`;
            return (
              <g key={key} {...itemProps}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  className={styles.measureLine}
                  style={{ stroke: color }}
                />
                <circle
                  cx={x1}
                  cy={y1}
                  r={2.5}
                  className={styles.measureDot}
                  style={{ fill: color }}
                />
                <circle
                  cx={x2}
                  cy={y2}
                  r={2.5}
                  className={styles.measureDot}
                  style={{ fill: color }}
                />
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 - 8}
                  textAnchor="middle"
                  className={styles.label}
                  style={{ fill: color }}
                >
                  {readout}
                </text>
                {interactive ? (
                  <line x1={x1} y1={y1} x2={x2} y2={y2} className={styles.hit} data-part="body" />
                ) : null}
                {isSelected ? (
                  <>
                    <Handle x={x1} y={y1} part="p1" />
                    <Handle x={x2} y={y2} part="p2" />
                  </>
                ) : null}
              </g>
            );
          }
          default:
            return null;
        }
      })}
    </g>
  );
}
