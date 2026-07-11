import { useState } from "react";
import type { ArrowTableLike } from "../../lib/fromArrow";
import { createSqlCellType, proseCellType } from "./cellTypes";
import { Notebook } from "./Notebook";
import type { CellType, NotebookDocument, SqlExecutor } from "./types";

/** CT harness: a controlled Notebook over a deterministic in-memory engine,
 *  so specs exercise the real reactive path without an external database. */

const POSITIONS = [
  { instrument: "ALPHA 2027", quantity: 12500 },
  { instrument: "BETA 2031", quantity: 8000 },
  { instrument: "GAMMA 2029", quantity: 20000 },
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

const executor: SqlExecutor = async (sql) => {
  await new Promise((resolve) => setTimeout(resolve, 30));
  if (/no_such_table/i.test(sql)) throw new Error("Catalog Error: no_such_table");
  const limit = /quantity\s*>\s*(\d+)/.exec(sql);
  const rows = POSITIONS.filter((p) => p.quantity > (limit ? Number(limit[1]) : 0));
  if (/count\(\*\)/i.test(sql)) return arrow([{ n: rows.length }]);
  return arrow(rows);
};

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

const DOCS: Record<string, NotebookDocument> = {
  playground: {
    version: 1,
    cells: [
      { id: "p0", type: "prose", source: "**hello**" },
      { id: "p1", type: "calc", name: "min_qty", source: "10000" },
      {
        id: "p2",
        type: "sql",
        name: "big",
        // biome-ignore lint/suspicious/noTemplateCurlyInString: SQL cell reference syntax.
        source: "SELECT * FROM positions WHERE quantity > ${min_qty}",
      },
      { id: "p3", type: "calc", name: "verdict", source: "big.numRows + ' rows'" },
    ],
  },
  errors: {
    version: 1,
    cells: [
      { id: "x1", type: "sql", name: "broken", source: "SELECT * FROM no_such_table" },
      // biome-ignore lint/suspicious/noTemplateCurlyInString: SQL cell reference syntax.
      { id: "x2", type: "sql", name: "child", source: "SELECT count(*) FROM t WHERE q > ${broken}" },
    ],
  },
};

export function NotebookHarness({ doc = "playground" }: { doc?: keyof typeof DOCS }) {
  const [document, setDocument] = useState<NotebookDocument>(DOCS[doc] as NotebookDocument);
  return (
    <Notebook
      document={document}
      onDocumentChange={setDocument}
      cellTypes={[proseCellType, calcCellType, createSqlCellType({ executor })]}
    />
  );
}
