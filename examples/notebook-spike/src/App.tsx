import {Button} from "@tarassov-ch/swiss-function/button";
import {NonIdealState} from "@tarassov-ch/swiss-function/non-ideal-state";
import {useEffect, useMemo, useState} from "react";
import {createSqlCellType, type SqlExecutor} from "./celltypes/sql";
import {jsExprCellType} from "./celltypes/jsexpr";
import {proseCellType} from "./celltypes/prose";
import type {NotebookDoc} from "./contract";
import {createDuckDbExecutor} from "./engines/duckdb";
import {NotebookShell} from "./notebook/NotebookShell";
import {createGraph} from "./scheduler/graph";

const DOC: NotebookDoc = {
  version: 1,
  cells: [
    {
      id: "c1",
      type: "prose",
      source:
        "# Trades analysis\n\nA reactive notebook over the app's own DuckDB-WASM: **threshold** (a JS cell) feeds the SQL below; editing it re-runs the dependents.",
    },
    {id: "c2", type: "js", name: "threshold", source: "30000"},
    {
      id: "c3",
      type: "sql",
      name: "big_trades",
      source:
        "SELECT instrument, count(*)::INT AS trades, round(avg(price), 3) AS avg_price\nFROM trades WHERE quantity > ${threshold}\nGROUP BY instrument ORDER BY instrument",
    },
    {
      id: "c4",
      type: "sql",
      name: "top_instrument",
      source:
        "SELECT instrument FROM (SELECT instrument, count(*) AS n FROM trades\nWHERE quantity > ${threshold} GROUP BY instrument ORDER BY n DESC LIMIT 1)",
    },
    {
      id: "c5",
      type: "sql",
      name: "detail",
      source:
        "SELECT trade_id, ts, instrument, side, quantity, price FROM trades\nWHERE instrument IN (SELECT instrument FROM (SELECT instrument, count(*) AS n FROM trades\n  WHERE quantity > ${threshold} GROUP BY instrument ORDER BY n DESC LIMIT 1))\n  AND quantity > ${threshold}\nORDER BY ts LIMIT 500",
    },
    {id: "c6", type: "js", name: "summary", source: "big_trades.numRows + ' instruments over ' + threshold"},
  ],
};

export default function App() {
  const [executor, setExecutor] = useState<SqlExecutor | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    // Wrap: a bare function argument would be treated as a state updater.
    createDuckDbExecutor().then(
      (ex) => setExecutor(() => ex),
      (e) => setBootError(String(e))
    );
  }, []);

  const cellTypes = useMemo(() => {
    if (!executor) return null;
    return {
      prose: proseCellType,
      js: jsExprCellType,
      sql: createSqlCellType(executor),
    };
  }, [executor]);

  return (
    <main className="page">
      <header className="page-head">
        <h1>notebook spike (issue #57)</h1>
        <Button size="sm" variant="ghost" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          theme: {theme}
        </Button>
      </header>
      {bootError ? (
        <NonIdealState variant="error" title="DuckDB failed to boot" description={bootError} />
      ) : cellTypes ? (
        <NotebookShell initial={DOC} cellTypes={cellTypes} createScheduler={createGraph} />
      ) : (
        <NonIdealState variant="loading" title="Booting DuckDB-WASM" description="loading wasm + generating 120k trades" />
      )}
    </main>
  );
}
