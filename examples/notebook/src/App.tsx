import {sql} from "@codemirror/lang-sql";
import {Button} from "@tarassov-ch/swiss-function/button";
import {NonIdealState} from "@tarassov-ch/swiss-function/non-ideal-state";
import {
  type CellType,
  createSqlCellType,
  Notebook,
  type NotebookDocument,
  proseCellType,
  type SqlExecutor,
} from "@tarassov-ch/swiss-function/notebook";
import {useEffect, useMemo, useState} from "react";
import {createDuckDbExecutor} from "./duckdb";

/**
 * The consumer-side second engine: JS expressions referencing other cells by
 * identifier. `new Function` is this app's own security decision; the library
 * never ships eval. This is the worked example of the CellType contract.
 */
const jsCellType: CellType = {
  type: "js",
  label: "JS",
  findDependencies: (source, knownNames) =>
    knownNames.filter((name) => new RegExp(`\\b${name}\\b`).test(source)),
  execute: ({source, inputs}) => {
    const names = Object.keys(inputs);
    const fn = new Function(...names, `"use strict"; return (${source});`);
    return fn(...names.map((n) => inputs[n]));
  },
};

const DOC: NotebookDocument = {
  version: 1,
  cells: [
    {
      id: "intro",
      type: "prose",
      source:
        "# Trades analysis\n\nA reactive notebook over this app's **own DuckDB-WASM** instance (120k generated trades). The `threshold` JS cell feeds the SQL cells; edit it (Mod+Enter) and everything downstream re-runs.",
    },
    {id: "t", type: "js", name: "threshold", source: "30000"},
    {
      id: "agg",
      type: "sql",
      name: "by_instrument",
      source:
        "SELECT instrument, count(*)::INT AS trades, round(avg(price), 3) AS avg_price\nFROM trades WHERE quantity > ${threshold}\nGROUP BY instrument ORDER BY instrument",
    },
    {
      id: "detail",
      type: "sql",
      name: "largest",
      source:
        "SELECT trade_id, ts, instrument, side, quantity, price FROM trades\nWHERE quantity > ${threshold} ORDER BY quantity DESC LIMIT 200",
    },
    {id: "sum", type: "js", name: "summary", source: "by_instrument.numRows + ' instruments over ' + threshold"},
  ],
};

export default function App() {
  const [executor, setExecutor] = useState<SqlExecutor | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [doc, setDoc] = useState(DOC);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    // Wrapped: a bare function argument would be treated as a state updater.
    createDuckDbExecutor().then(
      (ex) => setExecutor(() => ex),
      (e) => setBootError(String(e))
    );
  }, []);

  const cellTypes = useMemo(
    () =>
      executor
        ? [proseCellType, jsCellType, createSqlCellType({executor, extensions: () => [sql()]})]
        : null,
    [executor]
  );

  return (
    <main className="page">
      <header className="page-head">
        <h1>swiss-function notebook demo</h1>
        <Button size="sm" variant="ghost" onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
          theme: {theme}
        </Button>
      </header>
      {bootError ? (
        <NonIdealState variant="error" title="DuckDB failed to boot" description={bootError} />
      ) : cellTypes ? (
        <Notebook document={doc} onDocumentChange={setDoc} cellTypes={cellTypes} />
      ) : (
        <NonIdealState variant="loading" title="Booting DuckDB-WASM" description="loading wasm + generating 120k trades" />
      )}
    </main>
  );
}
