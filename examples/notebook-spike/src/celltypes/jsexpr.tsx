/**
 * A JS-expression cell type: the deliberately different second engine that
 * proves the contract is not SQL-shaped. Lives entirely in the app (consumer
 * side); `new Function` is the consumer's own security posture, never the
 * library's. Dependencies are identifiers that match other cells' names.
 */
import type {CellType} from "../contract";
import {ResultTable} from "../notebook/ResultTable";

const IDENT = /\b[A-Za-z_$][A-Za-z0-9_$]*\b/g;

export const jsExprCellType: CellType = {
  type: "js",
  label: "JS expression",
  findDependencies: (source, knownNames) => {
    const found = new Set<string>();
    const stripped = source
      .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""')
      .replace(/\/\/[^\n]*/g, "")
      .replace(/\/\*[\s\S]*?\*\//g, "");
    for (const match of stripped.match(IDENT) ?? []) {
      if (knownNames.includes(match)) found.add(match);
    }
    return [...found];
  },
  execute: ({source, inputs}) => {
    const names = Object.keys(inputs);
    const fn = new Function(...names, `"use strict"; return (${source});`);
    return fn(...names.map((n) => inputs[n]));
  },
  renderResult: (value) => {
    if (Array.isArray(value) && value.length > 0 && typeof value[0] === "object" && value[0] !== null) {
      const rows = value as Record<string, unknown>[];
      return <ResultTable columns={Object.keys(rows[0] as object)} rows={rows} />;
    }
    return <code>{typeof value === "object" ? JSON.stringify(value) : String(value)}</code>;
  },
};
