# Remote data

Experiment 7 (issue #52, time-boxed): DuckDB-WASM reading remote files over HTTP range requests, from the browser. Both paths are duckdb-wasm capabilities; neither is Framework-documented. Failures here are documented caveats, not blockers.

```js
const db = await DuckDBClient.of();

async function probe(label, query) {
  const t0 = performance.now();
  try {
    const rows = await db.query(query);
    return {label, ok: true, ms: Math.round(performance.now() - t0), result: JSON.stringify([...rows].slice(0, 3), (k, v) => (typeof v === "bigint" ? Number(v) : v))};
  } catch (error) {
    return {label, ok: false, ms: Math.round(performance.now() - t0), result: String(error).slice(0, 240)};
  }
}

const remoteParquet = await probe(
  "read_parquet over https (row-group metadata only)",
  "SELECT count(*) AS n FROM read_parquet('https://blobs.duckdb.org/data/taxi_2019_04.parquet')"
);
display(html`<p data-testid="parquet">${remoteParquet.ok ? "PASS" : "FAIL"} (${remoteParquet.ms} ms): ${remoteParquet.label}<br><code>${remoteParquet.result}</code></p>`);
```

```js
const remoteAttach = await probe(
  "ATTACH remote .duckdb database (read-only, range requests)",
  "ATTACH IF NOT EXISTS 'https://blobs.duckdb.org/databases/stations.duckdb' AS stations"
);
const attachQuery = remoteAttach.ok
  ? await probe("query the attached database", "SELECT count(*) AS n FROM stations.stations")
  : {label: "query skipped", ok: false, ms: 0, result: "attach failed"};
display(html`<p data-testid="attach">${remoteAttach.ok ? "PASS" : "FAIL"} (${remoteAttach.ms} ms): ${remoteAttach.label}<br><code>${remoteAttach.result}</code></p>
<p data-testid="attach-query">${attachQuery.ok ? "PASS" : "FAIL"} (${attachQuery.ms} ms): ${attachQuery.label}<br><code>${attachQuery.result}</code></p>`);
```
