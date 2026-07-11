import type { Story } from "@ladle/react";
import { useState } from "react";
import type { ArrowTableLike } from "../../lib/fromArrow";
import { createSqlCellType, proseCellType } from "./cellTypes";
import { Notebook } from "./Notebook";
import type { CellType, NotebookDocument, SqlExecutor } from "./types";

export default { title: "Notebook" };

/** Deterministic in-memory "engine": recognizes two demo queries and answers
 *  with Arrow-shaped fixtures. Real apps wire DuckDB-WASM here. */
const POSITIONS = [
  { instrument: "ALPHA 2027", currency: "CHF", quantity: 12500, price: 101.3 },
  { instrument: "BETA 2031", currency: "EUR", quantity: 8000, price: 97.8 },
  { instrument: "GAMMA 2029", currency: "USD", quantity: 20000, price: 103.9 },
  { instrument: "DELTA 2033", currency: "CHF", quantity: 15000, price: 99.4 },
];

function arrow(rows: Record<string, unknown>[]): ArrowTableLike {
  const fields = Object.keys(rows[0] ?? {}).map((name) => ({
    name,
    type: { toString: () => "Utf8" },
  }));
  return {
    schema: { fields },
    numRows: rows.length,
    toArray: () => rows.map((r) => ({ toJSON: () => ({ ...r }) })),
  };
}

const mockExecutor: SqlExecutor = async (sql) => {
  await new Promise((resolve) => setTimeout(resolve, 120));
  const limit = /quantity\s*>\s*(\d+)/.exec(sql);
  const threshold = limit ? Number(limit[1]) : 0;
  const rows = POSITIONS.filter((p) => p.quantity > threshold);
  if (/count\(\*\)/i.test(sql)) return arrow([{ positions: rows.length, threshold }]);
  if (/no_such_table/i.test(sql))
    throw new Error('Catalog Error: Table "no_such_table" does not exist');
  return arrow(rows);
};

/** A tiny consumer-side second engine, proving the CellType contract is not
 *  SQL-shaped (the docs' worked example). */
const calcCellType: CellType = {
  type: "calc",
  label: "Calc",
  findDependencies: (source, knownNames) =>
    knownNames.filter((name) => new RegExp(`\\b${name}\\b`).test(source)),
  execute: ({ source, inputs }) => {
    const names = Object.keys(inputs);
    const fn = new Function(...names, `"use strict"; return (${source});`);
    return fn(...names.map((n) => inputs[n]));
  },
};

const DOC: NotebookDocument = {
  version: 1,
  cells: [
    {
      id: "c1",
      type: "prose",
      source: "### Positions review\n\nThe **min_qty** calc cell feeds both SQL cells below.",
    },
    { id: "c2", type: "calc", name: "min_qty", source: "10000" },
    {
      id: "c3",
      type: "sql",
      name: "big_positions",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: ${name} is the SQL cell reference syntax, not a template literal.
      source: "SELECT * FROM positions WHERE quantity > ${min_qty}",
    },
    {
      id: "c4",
      type: "sql",
      name: "position_count",
      // biome-ignore lint/suspicious/noTemplateCurlyInString: ${name} is the SQL cell reference syntax.
      source: "SELECT count(*) FROM positions WHERE quantity > ${min_qty}",
    },
    {
      id: "c5",
      type: "calc",
      name: "verdict",
      source: "big_positions.numRows + ' of 4 over ' + min_qty",
    },
  ],
};

const CELL_TYPES = [proseCellType, calcCellType, createSqlCellType({ executor: mockExecutor })];

export const Playground: Story = () => {
  const [doc, setDoc] = useState(DOC);
  return <Notebook document={doc} onDocumentChange={setDoc} cellTypes={CELL_TYPES} />;
};

export const ErrorPropagation: Story = () => {
  const [doc, setDoc] = useState<NotebookDocument>({
    version: 1,
    cells: [
      { id: "e1", type: "sql", name: "broken", source: "SELECT * FROM no_such_table" },
      {
        id: "e2",
        type: "sql",
        name: "dependent",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: ${name} is the SQL cell reference syntax.
        source: "SELECT count(*) FROM positions WHERE quantity > ${broken}",
      },
      { id: "e3", type: "calc", name: "loop_a", source: "loop_b + 1" },
      { id: "e4", type: "calc", name: "loop_b", source: "loop_a + 1" },
      {
        id: "e5",
        type: "sql",
        name: "orphan",
        // ${missing_name} exercises "unresolved": explicit-reference languages
        // (SQL) wait for the name; identifier-based ones (calc) would instead
        // fail at runtime with a ReferenceError, since unknown identifiers are
        // not reported as dependencies.
        // biome-ignore lint/suspicious/noTemplateCurlyInString: ${name} is the SQL cell reference syntax.
        source: "SELECT * FROM positions WHERE quantity > ${missing_name}",
      },
    ],
  });
  return <Notebook document={doc} onDocumentChange={setDoc} cellTypes={CELL_TYPES} />;
};

export const DocumentValidation: Story = () => {
  const [doc, setDoc] = useState<NotebookDocument>({
    version: 1,
    cells: [
      { id: "v1", type: "calc", name: "twice", source: "1" },
      { id: "v2", type: "calc", name: "twice", source: "2" },
      { id: "v3", type: "calc", name: "3bad", source: "3" },
      { id: "v4", type: "vanished", name: "ghost", source: "" },
    ],
  });
  return <Notebook document={doc} onDocumentChange={setDoc} cellTypes={CELL_TYPES} />;
};
