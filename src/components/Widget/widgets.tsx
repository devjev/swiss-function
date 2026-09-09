import type { ComponentProps, ReactNode } from "react";
import { forwardRef } from "react";
import { BarChart } from "../BarChart";
import { type ColumnDef, DataTable } from "../DataTable";
import { Progress, type ProgressTone } from "../Progress";
import { Stat, type StatSize, type StatTone } from "../Stat";
import { Widget, type WidgetProps } from "./Widget";
import styles from "./widgets.module.css";

/** The shell's props without the body: every standard widget takes them. */
export type WidgetShellProps = Omit<WidgetProps, "children">;

type BarChartProps = ComponentProps<typeof BarChart>;

export interface KpiWidgetProps extends WidgetShellProps {
  /** The figure: a number in Swiss typography, or your own node. */
  value: number | ReactNode;
  decimals?: number;
  unit?: string;
  /** Change indicator (percent), coloured by `goodDirection`. */
  delta?: number;
  goodDirection?: "up" | "down";
  /** A sparkline under the figure. */
  trend?: number[];
  caption?: ReactNode;
  tone?: StatTone;
  /** The Stat's size. Default `sm`, or `xs` in a `size="sm"` widget. */
  statSize?: StatSize;
  /** The Stat's own label line (the widget's title is in the header). Default none. */
  subtitle?: ReactNode;
}

/** A KPI in a widget: a `Stat` (figure, delta, sparkline) under the title bar. */
export const KpiWidget = forwardRef<HTMLDivElement, KpiWidgetProps>(function KpiWidget(
  {
    value,
    decimals,
    unit,
    delta,
    goodDirection,
    trend,
    caption,
    tone,
    statSize,
    subtitle,
    ...shell
  },
  ref,
) {
  return (
    <Widget ref={ref} {...shell}>
      <Stat
        label={subtitle ?? ""}
        value={value}
        decimals={decimals}
        valueUnit={unit}
        delta={delta}
        goodDirection={goodDirection}
        trend={trend}
        caption={caption}
        tone={tone}
        size={statSize ?? (shell.size === "sm" ? "xs" : "sm")}
        className={styles.stat}
      />
    </Widget>
  );
});

export interface ChartWidgetProps extends WidgetShellProps {
  categories: BarChartProps["categories"];
  series: BarChartProps["series"];
  /** Chart height. Default 140, or 112 in a `size="sm"` widget. */
  height?: number | string;
  scaffolding?: BarChartProps["scaffolding"];
  yLabel?: string;
}

/** A bar chart in a widget (categories and series as `BarChart` takes them). */
export const ChartWidget = forwardRef<HTMLDivElement, ChartWidgetProps>(function ChartWidget(
  { categories, series, height, scaffolding = "minimal", yLabel, ...shell },
  ref,
) {
  return (
    <Widget ref={ref} {...shell}>
      {/* Room above the plot for the value labels of the tallest bars. */}
      <div className={styles.chart}>
        <BarChart
          categories={categories}
          series={series}
          height={height ?? (shell.size === "sm" ? 112 : 140)}
          scaffolding={scaffolding}
          yLabel={yLabel}
        />
      </div>
    </Widget>
  );
});

export interface TableWidgetProps<T> extends WidgetShellProps {
  columns: ColumnDef<T>[];
  rows: T[];
  /** Table height; the rows scroll inside it. Default: the rows' own height. */
  height?: number | string;
}

/** A small table in a widget: a `DataTable` flush with the frame. */
export function TableWidget<T>({ columns, rows, height, ...shell }: TableWidgetProps<T>) {
  return (
    <Widget {...shell} flush>
      {/* The table's own frame sits on the widget's, one hairline, not two. */}
      <div className={styles.table}>
        <DataTable data={rows} columns={columns} height={height} />
      </div>
    </Widget>
  );
}

export interface ProgressWidgetProps extends WidgetShellProps {
  /** 0 to 100, or `null` for indeterminate. */
  value: number | null;
  /** A line above the bar ("7 of 9 steps"). */
  label?: ReactNode;
  tone?: ProgressTone;
  /** Print the percentage. Default: on when `value` is a number. */
  showValue?: boolean;
}

/** A progress bar in a widget, with a line of text above it. */
export const ProgressWidget = forwardRef<HTMLDivElement, ProgressWidgetProps>(
  function ProgressWidget({ value, label, tone, showValue, ...shell }, ref) {
    return (
      <Widget ref={ref} {...shell}>
        <div className={styles.progress}>
          {label != null ? <span className={styles.progressLabel}>{label}</span> : null}
          <Progress value={value} tone={tone} showValue={showValue ?? value != null} size="sm" />
        </div>
      </Widget>
    );
  },
);
