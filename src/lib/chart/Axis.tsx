import type { CSSProperties, HTMLAttributes } from "react";
import { forwardRef } from "react";
import { cx } from "../cx";
import styles from "./Axis.module.css";

export interface AxisTick {
  /** Display label. */
  label: string;
  /** Position as a 0..1 fraction along the axis. Chart owns the scale; Axis
   *  just renders ticks at the provided fractions. */
  position: number;
  /** Emphasized tick (e.g., the y=0 line on a signed axis). Default false. */
  major?: boolean;
}

export type AxisOrientation = "x" | "y";

export interface AxisProps extends HTMLAttributes<HTMLDivElement> {
  orientation: AxisOrientation;
  ticks: AxisTick[];
  /** Hide the axis hairline (Tufte's range-frame spirit: the ticks themselves
   *  define the range). Default false. */
  noLine?: boolean;
}

export const Axis = forwardRef<HTMLDivElement, AxisProps>(function Axis(
  { orientation, ticks, noLine, className, ...rest },
  ref,
) {
  const isX = orientation === "x";
  return (
    <div
      {...rest}
      ref={ref}
      data-orientation={orientation}
      className={cx(styles.axis, isX ? styles.xAxis : styles.yAxis, className)}
    >
      {noLine ? null : <div className={styles.line} aria-hidden="true" />}
      {ticks.map((tick) => {
        const pct = Math.max(0, Math.min(1, tick.position)) * 100;
        const style: CSSProperties = isX ? { left: `${pct}%` } : { bottom: `${pct}%` };
        return (
          <div
            key={`${tick.label}-${tick.position}`}
            className={cx(styles.tick, tick.major && styles.tickMajor)}
            style={style}
            data-tick=""
            data-tick-major={tick.major || undefined}
          >
            <span className={styles.tickMark} aria-hidden="true" />
            <span className={styles.tickLabel}>{tick.label}</span>
          </div>
        );
      })}
    </div>
  );
});
