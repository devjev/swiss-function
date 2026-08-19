import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import { Glyph } from "../../lib/icons";
import type { BoxElevation } from "../Box";
import { ArrowDown, ArrowUp, Minus } from "../Icon";
import styles from "./Stat.module.css";
import { sparklineBars, sparklinePointsAttr } from "./sparkline";

export type StatTone = "neutral" | "primary" | "success" | "warning" | "danger";
export type StatSize = "sm" | "md" | "lg";

export interface StatProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** The metric name (rendered as a compact, uppercase label). */
  label: ReactNode;
  /** The figure. Format it yourself (currency, thousands, unit); the card just
   *  sets it in tabular mono. */
  value: ReactNode;
  /** Signed change vs the previous period. Its sign picks the arrow (up / down /
   *  flat); its good/bad colour is decided with `goodDirection`. */
  delta?: number;
  /** Override the delta's text (default: the magnitude + `deltaUnit`, e.g.
   *  `12.5%`; the arrow already conveys direction). */
  deltaLabel?: ReactNode;
  /** Unit appended to the default delta text. Default `"%"`; `""` for absolute. */
  deltaUnit?: string;
  /** Which direction reads as good. Default `"up"`; set `"down"` for metrics
   *  where a decrease is the win (churn, latency, cost). */
  goodDirection?: "up" | "down";
  /** A secondary line under the value (a comparison note, a target). */
  caption?: ReactNode;
  /** A leading glyph beside the label. Pass an `Icon` element (`<Users />`). */
  icon?: ReactNode;
  /** A small trend series drawn as a sparkline (needs 2+ points). */
  trend?: number[];
  /** Sparkline shape. Default `"line"`. */
  trendType?: "line" | "bar";
  /** Colours the value for a status metric. Default `"neutral"` (full-strength
   *  foreground). */
  tone?: StatTone;
  /** Value scale. Default `"md"`. */
  size?: StatSize;
  /** Render as a standalone card (border + surface + depth). Omit inside a
   *  `Stat.Group`, which frames the cards itself. */
  elevation?: BoxElevation;
  /** Content alignment. Default `"start"`. */
  align?: "start" | "center";
}

/** good / bad / flat, from the delta sign and which direction is desirable. */
function deltaVerdict(delta: number, goodDirection: "up" | "down"): "good" | "bad" | "flat" {
  if (delta === 0) return "flat";
  const up = delta > 0;
  return up === (goodDirection === "up") ? "good" : "bad";
}

function defaultDeltaText(delta: number, unit: string): string {
  const abs = Math.abs(delta);
  // One decimal for a normal delta; more precision below 0.05 so a small but
  // nonzero change never collapses to "0" (which would contradict the arrow).
  const opts: Intl.NumberFormatOptions =
    abs > 0 && abs < 0.05 ? { maximumSignificantDigits: 1 } : { maximumFractionDigits: 1 };
  return `${abs.toLocaleString(undefined, opts)}${unit}`;
}

function Sparkline({
  values,
  type,
  className,
  ...rest
}: { values: number[]; type: "line" | "bar" } & HTMLAttributes<SVGSVGElement>) {
  const W = 100;
  const H = 30;
  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative trend spark; the value + delta carry the meaning.
    <svg
      {...rest}
      className={cx(styles.spark, className)}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
      focusable="false"
    >
      {type === "line" ? (
        <polyline className={styles.sparkLine} points={sparklinePointsAttr(values, W, H)} />
      ) : (
        sparklineBars(values, W, H).map((b, i) => (
          <rect
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed positional series; index is the identity.
            key={i}
            className={styles.sparkBar}
            x={b.x}
            y={b.y}
            width={b.width}
            height={b.height}
          />
        ))
      )}
    </svg>
  );
}

/**
 * A statistic / KPI card: a labelled figure with an optional change indicator,
 * sparkline, leading icon, and caption. Built for dashboards, in the house
 * aesthetic (tabular mono value, sharp corners, one accent, colour only where it
 * means a status). Renders a `<div>`; extends `HTMLAttributes<HTMLDivElement>`
 * (minus `title`). Lay several out with `Stat.Group`. Colour is reserved for the
 * delta (good / bad) and an optional status `tone`; the value itself is never
 * greyed.
 */
const StatRoot = forwardRef<HTMLDivElement, StatProps>(function Stat(
  {
    label,
    value,
    delta,
    deltaLabel,
    deltaUnit = "%",
    goodDirection = "up",
    caption,
    icon,
    trend,
    trendType = "line",
    tone = "neutral",
    size = "md",
    elevation,
    align = "start",
    className,
    ...rest
  },
  ref,
) {
  const hasDelta = delta != null && Number.isFinite(delta);
  const verdict = hasDelta ? deltaVerdict(delta, goodDirection) : null;
  const arrow = !hasDelta ? null : delta > 0 ? "trendUp" : delta < 0 ? "trendDown" : "trendFlat";
  const arrowFallback = hasDelta && delta > 0 ? ArrowUp : hasDelta && delta < 0 ? ArrowDown : Minus;
  // Drop non-finite points before deciding whether there's enough to draw.
  const spark = Array.isArray(trend) ? trend.filter(Number.isFinite) : [];
  const showSpark = spark.length >= 2;

  return (
    <div
      {...rest}
      ref={ref}
      className={cx(styles.root, className)}
      data-tone={tone}
      data-size={size}
      data-align={align}
      data-elevation={elevation}
      data-card={elevation != null || undefined}
    >
      <div className={styles.header}>
        {icon && (
          <span className={styles.icon} aria-hidden="true">
            {icon}
          </span>
        )}
        <span className={styles.label}>{label}</span>
      </div>
      <div className={styles.value}>{value}</div>
      {(hasDelta || caption) && (
        <div className={styles.footer}>
          {hasDelta && arrow && (
            <span className={styles.delta} data-trend={verdict}>
              <Glyph slot={arrow} fallback={arrowFallback} className={styles.deltaArrow} />
              <span>{deltaLabel ?? defaultDeltaText(delta, deltaUnit)}</span>
            </span>
          )}
          {caption && <span className={styles.caption}>{caption}</span>}
        </div>
      )}
      {showSpark && <Sparkline values={spark} type={trendType} data-trend={verdict ?? "neutral"} />}
    </div>
  );
});

export interface StatGroupProps extends HTMLAttributes<HTMLDivElement> {
  /** Fixed column count. Omit for a responsive `auto-fit` grid that packs as many
   *  columns as fit and collapses as the container narrows. */
  columns?: number;
  /** Minimum column width (in `--sf-unit` multiples) for the responsive grid.
   *  Default `12`. Ignored when `columns` is set. */
  minColumnWidth?: number;
  /** Hairline dividers between cards. Default `true`. */
  dividers?: boolean;
  /** Panel depth. Default `1`. */
  elevation?: BoxElevation;
}

/** A responsive, hairline-divided panel of `Stat` cards. Container-driven: the
 *  cards reflow as the panel narrows, no media queries. */
const StatGroup = forwardRef<HTMLDivElement, StatGroupProps>(function StatGroup(
  { columns, minColumnWidth = 12, dividers = true, elevation = 1, className, style, ...rest },
  ref,
) {
  const gridColumns = columns
    ? `repeat(${columns}, minmax(0, 1fr))`
    : `repeat(auto-fit, minmax(calc(var(--sf-unit) * ${minColumnWidth}), 1fr))`;
  return (
    <div
      {...rest}
      ref={ref}
      className={cx(styles.group, dividers && styles.dividers, className)}
      data-elevation={elevation}
      style={{ ...style, gridTemplateColumns: gridColumns }}
    />
  );
});

export const Stat = Object.assign(StatRoot, { Group: StatGroup });
