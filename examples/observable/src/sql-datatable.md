---
sql:
  trades: ./data/trades.csv
---

# SQL to DataTable

Experiment 6 (issue #52): the full analysis chain. A data loader emits ~120k trades; DuckDB-WASM queries them in the browser; the Arrow result is materialized and rendered by a swiss-function DataTable. The instrument filter is interpolated into the SQL, so changing it re-runs the query and the table re-renders.

## Default rendering (Inputs.table)

A bare SQL block renders through Framework's `Inputs.table`:

```sql
SELECT instrument, count(*) AS trades, round(avg(price), 3) AS avg_price, sum(quantity) AS volume
FROM trades GROUP BY instrument ORDER BY instrument
```

## Filtered detail into a DataTable

```js
const instrument = view(Inputs.select(["ALPHA 2027", "BETA 2031", "GAMMA 2029", "DELTA 2033", "EPSILON 2026"], {label: "Instrument"}));
```

```sql id=filtered
SELECT trade_id, ts, instrument, currency, side, quantity, price
FROM trades WHERE instrument = ${instrument} ORDER BY ts
```

```js
import {mountResultsTable} from "./lib/sf-island.js";

const host = document.createElement("div");
const table = mountResultsTable(host, ["trade_id", "ts", "instrument", "currency", "side", "quantity", "price"]);
invalidation.then(() => table.dispose());
display(host);
```

```js
// Materialization boundary (what fromArrow in issue #55 will own):
// Arrow StructRowProxy rows to plain objects, timestamps to Date.
const t0 = performance.now();
const rows = filtered.toArray().map((r) => {
  const o = r.toJSON();
  o.ts = new Date(Number(o.ts));
  return o;
});
const materializeMs = performance.now() - t0;
table.update(rows);
display(html`<p data-testid="timing">Materialized <b>${rows.length.toLocaleString("en")}</b> rows in <b>${materializeMs.toFixed(1)} ms</b>.</p>`);
```

## Whole-table cost

```sql id=everything
SELECT trade_id, ts, instrument, currency, side, quantity, price FROM trades
```

```js
const t1 = performance.now();
const allRows = everything.toArray().map((r) => r.toJSON());
const allMs = performance.now() - t1;
display(html`<p data-testid="timing-all">Materialized all <b>${allRows.length.toLocaleString("en")}</b> rows in <b>${allMs.toFixed(1)} ms</b>.</p>`);
```
