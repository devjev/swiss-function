/** Hover-time crosshair lines (Tufte-mode scaffolding). Drawn as SVG, so it
 *  composes directly into the plot <svg> of each chart. */

import type { ReactNode } from "react";
import styles from "./Crosshair.module.css";

export interface CrosshairProps {
  /** SVG x of the hovered datum (in plot coordinates). */
  x: number;
  /** SVG y of the hovered datum. */
  y: number;
  /** Plot height in pixels — the vertical line extends from the datum to here. */
  height: number;
  /** Which axes to project onto. Default both. */
  axes?: "both" | "x" | "y";
  /** Label printed at the bottom edge of the vertical line. */
  xLabel?: ReactNode;
  /** Label printed at the left edge of the horizontal line. */
  yLabel?: ReactNode;
}

export function Crosshair({ x, y, height, axes = "both", xLabel, yLabel }: CrosshairProps) {
  const drawX = axes !== "y";
  const drawY = axes !== "x";
  return (
    <g className={styles.root}>
      {drawX ? <line x1={x} x2={x} y1={y} y2={height} className={styles.line} /> : null}
      {drawY ? <line x1={0} x2={x} y1={y} y2={y} className={styles.line} /> : null}
      {/* End-of-line value labels. Positioned with a tiny offset off the plot
          edge so the text doesn't overlap the axis tick marks. */}
      {drawX && xLabel != null ? (
        <text x={x} y={height - 4} className={styles.xLabel} textAnchor="middle">
          {xLabel}
        </text>
      ) : null}
      {drawY && yLabel != null ? (
        <text x={4} y={y - 4} className={styles.yLabel} textAnchor="start">
          {yLabel}
        </text>
      ) : null}
    </g>
  );
}
