/** Chart annotations (issue #27): a controlled, serializable array of plain
 *  JSON objects rendered as an SVG overlay. Anchors are DATA-space (x in
 *  domain units, y in value units) so annotations survive zoom, pan and
 *  resize; the layer reads the same (possibly zoomed) scales as the series.
 *  The array is the document — persistence and sharing belong to the
 *  consumer. Quiet by default: hairline strokes, mono labels, no fills louder
 *  than 8%. */

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

export function AnnotationsLayer({
  annotations,
  xPx,
  yPx,
  width,
  height,
  formatXDelta,
  formatY,
}: AnnotationsLayerProps) {
  if (annotations.length === 0) return null;
  return (
    // No aria-hidden needed: the chart <svg> is role="img", so this whole
    // subtree is already presentational to assistive tech.
    <g className={styles.root} data-annotations="">
      {annotations.map((a, i) => {
        const key = a.id ?? `annotation-${i}`;
        const color = annotationColor(a);
        switch (a.type) {
          case "hline": {
            const y = yPx(a.y);
            return (
              <g key={key}>
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
              </g>
            );
          }
          case "vline": {
            const x = xPx(a.x);
            return (
              <g key={key}>
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
              </g>
            );
          }
          case "line": {
            const x1 = xPx(a.x1);
            const y1 = yPx(a.y1);
            const x2 = xPx(a.x2);
            const y2 = yPx(a.y2);
            return (
              <g key={key}>
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
              <g key={key}>
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
              </g>
            );
          }
          case "text": {
            return (
              <text
                key={key}
                x={xPx(a.x)}
                y={yPx(a.y)}
                className={cx(styles.label, styles.note)}
                style={{ fill: color }}
              >
                {a.text}
              </text>
            );
          }
          case "measure": {
            const x1 = xPx(a.x1);
            const y1 = yPx(a.y1);
            const x2 = xPx(a.x2);
            const y2 = yPx(a.y2);
            const dy = a.y2 - a.y1;
            const pct =
              a.y1 !== 0
                ? ` (${dy >= 0 ? "+" : ""}${((dy / Math.abs(a.y1)) * 100).toFixed(1)}%)`
                : "";
            const readout = `${formatXDelta(a.x1, a.x2)}  Δ ${formatY(dy)}${pct}`;
            return (
              <g key={key}>
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
