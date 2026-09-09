import type { Story } from "@ladle/react";
import { useState } from "react";
import { Button } from "../Button";
import { X } from "../Icon";
import { Widget } from "./Widget";
import type { WidgetParamValues } from "./Widget.params";
import { ChartWidget, KpiWidget, ProgressWidget, TableWidget } from "./widgets";

export default { title: "Widget" };

const MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
const FLOWS = [12.4, -3.1, 8.8, 15.2, -6.7, 9.3];
const CCY: { value: string; label: string }[] = [
  { value: "CHF", label: "CHF" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
];
const FX: Record<string, number> = { CHF: 1, USD: 1.12, EUR: 1.04 };

/** A month's net flows: a fixed base scaled by the month, so the figure moves. */
const flowsFor = (month: Date | null, ccy = "CHF") => {
  const m = month ? month.getMonth() : 8;
  return Math.round(9300 * (1 + (((m * 7) % 11) - 5) / 50) * (FX[ccy] ?? 1));
};

/** One param: the month edits inline after the title. */
export const InlineParam: Story = () => {
  const [month, setMonth] = useState<Date | null>(new Date(2026, 8, 1));
  return (
    <div style={{ inlineSize: 360 }}>
      <KpiWidget
        title="Net flows"
        params={[{ id: "month", label: "Month", type: "date", precision: "month", value: month }]}
        onParamsChange={(v) => setMonth(v.month instanceof Date ? v.month : null)}
        value={flowsFor(month)}
        unit="kCHF"
        delta={-0.8}
      />
    </div>
  );
};

/** Two params: an as-of date and a currency, both inline. */
export const TwoParams: Story = () => {
  const [values, setValues] = useState<WidgetParamValues>({
    asOf: new Date(2026, 8, 8),
    ccy: "CHF",
  });
  const ccy = typeof values.ccy === "string" ? values.ccy : "CHF";
  return (
    <div style={{ inlineSize: 480 }}>
      <KpiWidget
        title="Assets under management"
        params={[
          { id: "asOf", label: "As of", type: "date", value: values.asOf as Date | null },
          { id: "ccy", label: "Currency", type: "select", value: ccy, options: CCY },
        ]}
        onParamsChange={setValues}
        value={Math.round(1284500 * (FX[ccy] ?? 1))}
        unit={`k${ccy}`}
        delta={2.1}
        trend={[1180, 1195, 1210, 1204, 1230, 1262, 1284]}
      />
    </div>
  );
};

/** Four params: the header shows their summary and a settings key; the dialog
 *  is a table of them, applied at once. */
export const SettingsDialog: Story = () => {
  const [values, setValues] = useState<WidgetParamValues>({
    from: new Date(2026, 3, 1),
    to: new Date(2026, 8, 1),
    ccy: "CHF",
    basis: "net",
  });
  const ccy = typeof values.ccy === "string" ? values.ccy : "CHF";
  const gross = values.basis === "gross";
  return (
    <div style={{ inlineSize: 520 }}>
      <ChartWidget
        title="Net flows by month"
        params={[
          {
            id: "from",
            label: "From",
            type: "date",
            precision: "month",
            value: values.from as Date,
          },
          { id: "to", label: "To", type: "date", precision: "month", value: values.to as Date },
          { id: "ccy", label: "Currency", type: "select", value: ccy, options: CCY },
          {
            id: "basis",
            label: "Basis",
            type: "select",
            value: typeof values.basis === "string" ? values.basis : "net",
            options: [
              { value: "net", label: "Net" },
              { value: "gross", label: "Gross" },
            ],
          },
        ]}
        onParamsChange={setValues}
        categories={MONTHS}
        series={[
          {
            name: `Flows (M${ccy})`,
            values: FLOWS.map((v) => +(v * (gross ? 1.6 : 1) * (FX[ccy] ?? 1)).toFixed(1)),
          },
        ]}
      />
    </div>
  );
};

interface Position {
  fund: string;
  weight: number;
  change: number;
}
const POSITIONS: Position[] = [
  { fund: "Global Equity", weight: 42.5, change: 1.2 },
  { fund: "Swiss Bonds", weight: 31.0, change: -0.4 },
  { fund: "Real Estate", weight: 16.5, change: 0.3 },
  { fund: "Cash", weight: 10.0, change: -1.1 },
];

/** The four standard widgets side by side, without params. */
export const StandardWidgets: Story = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 320px))",
      gap: "var(--sf-unit)",
      alignItems: "start",
    }}
  >
    <KpiWidget
      title="AUM"
      value={1284500}
      unit="kCHF"
      delta={2.1}
      trend={[1180, 1195, 1210, 1204, 1230, 1262, 1284]}
    />
    <ChartWidget
      title="Net flows by month"
      categories={MONTHS}
      series={[{ name: "Flows (MCHF)", values: FLOWS }]}
    />
    <TableWidget<Position>
      title="Allocation"
      columns={[
        { id: "fund", header: "Fund", accessor: "fund" },
        { id: "weight", header: "Weight %", accessor: "weight", align: "end" },
        { id: "change", header: "Change", accessor: "change", align: "end" },
      ]}
      rows={POSITIONS}
    />
    <ProgressWidget title="Quarter close" value={78} label="7 of 9 steps" />
  </div>
);

/** `loading` runs a thin bar under the header; `error` replaces the body. */
export const LoadingAndError: Story = () => (
  <div style={{ display: "grid", gap: "var(--sf-unit)", inlineSize: 360 }}>
    <KpiWidget title="Net flows" loading value={9300} unit="kCHF" delta={-0.8} />
    <Widget title="Net flows" error="Query timed out after 30 s. Retry from the conversation.">
      <span>hidden</span>
    </Widget>
  </div>
);

/** `size="sm"` for a narrow shelf, with a remove key in `actions`. */
export const Compact: Story = () => {
  const [month, setMonth] = useState<Date | null>(new Date(2026, 8, 1));
  const remove = (
    <Button variant="ghost" size="sm" tight aria-label="Remove">
      <X />
    </Button>
  );
  return (
    <div style={{ display: "grid", gap: "calc(var(--sf-unit) / 2)", inlineSize: 240 }}>
      <KpiWidget
        size="sm"
        title="Net flows"
        params={[{ id: "month", label: "Month", type: "date", precision: "month", value: month }]}
        onParamsChange={(v) => setMonth(v.month instanceof Date ? v.month : null)}
        value={flowsFor(month)}
        delta={-0.8}
        actions={remove}
        elevation={1}
      />
      <ChartWidget
        size="sm"
        title="Net flows by month"
        categories={MONTHS}
        series={[{ name: "Flows", values: FLOWS }]}
        actions={remove}
        elevation={1}
      />
      <ProgressWidget size="sm" title="Quarter close" value={78} actions={remove} elevation={1} />
    </div>
  );
};
