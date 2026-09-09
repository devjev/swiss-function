import { useState } from "react";
import { formatParamValue, type WidgetParam, type WidgetParamValues } from "./Widget.params";
import { KpiWidget } from "./widgets";

const ALL: WidgetParam[] = [
  { id: "ccy", label: "Currency", type: "select", value: "CHF", options: ["CHF", "USD", "EUR"] },
  { id: "note", label: "Note", type: "text", value: "" },
  { id: "net", label: "Net of fees", type: "boolean", value: true },
  { id: "limit", label: "Limit", type: "number", value: 5, decimals: 0, unit: "%" },
];

/** A KPI widget with the first `count` params and a readout of the values the
 *  widget reports, for the component test. */
export function ParamsDemo({ count, inlineParams }: { count: number; inlineParams?: number }) {
  const [values, setValues] = useState<WidgetParamValues>(() =>
    Object.fromEntries(ALL.slice(0, count).map((p) => [p.id, p.value])),
  );
  const [changed, setChanged] = useState<string[]>([]);
  const params = ALL.slice(0, count).map(
    (p) => ({ ...p, value: values[p.id] ?? p.value }) as WidgetParam,
  );
  return (
    <div style={{ inlineSize: 480 }}>
      <KpiWidget
        title="Net flows"
        params={params}
        inlineParams={inlineParams}
        onParamsChange={(next, ids) => {
          setValues(next);
          setChanged(ids);
        }}
        value={9300}
        unit="kCHF"
        delta={-0.8}
      />
      <div data-testid="values">
        {params.map((p) => `${p.id}=${formatParamValue(p)}`).join(";")}
      </div>
      <div data-testid="changed">{changed.join(",")}</div>
    </div>
  );
}
