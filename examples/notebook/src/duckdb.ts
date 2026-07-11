/**
 * The host app's own DuckDB-WASM wiring (the consumer side of the contract).
 * The notebook shell and cell types never import this module's dependency;
 * they only see the SqlExecutor function created here.
 */
import * as duckdb from "@duckdb/duckdb-wasm";
import ehWorkerUrl from "@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url";
import mvpWorkerUrl from "@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url";
import ehWasmUrl from "@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url";
import mvpWasmUrl from "@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url";
import type {SqlExecutor} from "@tarassov-ch/swiss-function/notebook";

const ROWS = 120_000;
const INSTRUMENTS = ["ALPHA 2027", "BETA 2031", "GAMMA 2029", "DELTA 2033", "EPSILON 2026"];
const CCY: Record<string, string> = {
  "ALPHA 2027": "CHF",
  "BETA 2031": "EUR",
  "GAMMA 2029": "USD",
  "DELTA 2033": "CHF",
  "EPSILON 2026": "EUR",
};

/** Deterministic dataset (LCG, seed 42), same shape as the milestone 24 generator. */
function tradesCsv(): string {
  let state = 42;
  const rand = () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
  const out = ["trade_id,ts,instrument,currency,side,quantity,price"];
  const start = Date.UTC(2025, 0, 1);
  for (let i = 0; i < ROWS; i++) {
    const instrument = INSTRUMENTS[Math.floor(rand() * INSTRUMENTS.length)] as string;
    const ts = new Date(start + Math.floor(rand() * 365 * 24 * 3600 * 1000)).toISOString();
    const side = rand() < 0.5 ? "BUY" : "SELL";
    const quantity = Math.round(rand() * 50_000) + 100;
    const price = (95 + rand() * 12).toFixed(3);
    out.push(`T${String(i).padStart(6, "0")},${ts},${instrument},${CCY[instrument]},${side},${quantity},${price}`);
  }
  return out.join("\n");
}

export async function createDuckDbExecutor(): Promise<SqlExecutor> {
  const bundle = await duckdb.selectBundle({
    mvp: {mainModule: mvpWasmUrl, mainWorker: mvpWorkerUrl},
    eh: {mainModule: ehWasmUrl, mainWorker: ehWorkerUrl},
  });
  const worker = new Worker(bundle.mainWorker as string, {type: "module"});
  const db = new duckdb.AsyncDuckDB(new duckdb.VoidLogger(), worker);
  await db.instantiate(bundle.mainModule);
  await db.registerFileText("trades.csv", tradesCsv());
  const conn = await db.connect();
  await conn.query("CREATE TABLE trades AS SELECT * FROM read_csv_auto('trades.csv')");

  return async (sql, signal) => {
    // Spike simplification: DuckDB-WASM queries are not cancelled mid-flight;
    // a stale result is simply discarded by the scheduler (SPEC 4.2). The
    // signal is still honored up front for already-stale runs.
    if (signal.aborted) throw new DOMException("aborted", "AbortError");
    return conn.query(sql);
  };
}
