/**
 * The pure parts of the registered block types: reading tabular text for the
 * data block, and searching a tree for the query block.
 */

import type { Bullet, BulletId, OutlinerValue } from "../Outliner";
import { plainLabel } from "../Outliner/zoom";

export interface DataTableSource {
  columns: string[];
  rows: Record<string, unknown>[];
  /** The columns whose every value is a number. */
  numeric: Set<string>;
}

/** Delimited text as rows of fields. Fields may be quoted, a quote inside a
 *  quoted field is doubled, and a quoted field may hold the delimiter and line
 *  breaks (RFC 4180). */
export function parseDelimited(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i] as string;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
      continue;
    }
    if (ch === '"' && field === "") quoted = true;
    else if (ch === delimiter) {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else field += ch;
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

const NUMBER = /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?$/;

function withNumbers(columns: string[], rows: Record<string, unknown>[]): DataTableSource {
  const numeric = new Set<string>();
  for (const column of columns) {
    const values = rows.map((r) => r[column]).filter((v) => v !== "" && v != null);
    const all =
      values.length > 0 &&
      values.every((v) => typeof v === "number" || NUMBER.test(String(v).trim()));
    if (!all) continue;
    numeric.add(column);
    for (const r of rows) {
      const v = r[column];
      if (typeof v === "string" && v.trim() !== "") r[column] = Number(v);
    }
  }
  return { columns, rows, numeric };
}

/** A data block's text as a table. `csv` and `tsv` take their first line as
 *  the header; `json` is an array of objects (the columns are the keys, in
 *  the order they first appear). Throws with a plain message when the text is
 *  not that. */
export function parseData(language: string, text: string): DataTableSource {
  if (language === "json") {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch (error) {
      throw new Error(`not valid JSON (${error instanceof Error ? error.message : "parse error"})`);
    }
    if (!Array.isArray(parsed) || parsed.some((r) => r === null || typeof r !== "object")) {
      throw new Error("the JSON is not an array of objects");
    }
    const columns: string[] = [];
    for (const r of parsed as Record<string, unknown>[]) {
      for (const key of Object.keys(r)) if (!columns.includes(key)) columns.push(key);
    }
    return withNumbers(
      columns,
      (parsed as Record<string, unknown>[]).map((r) => ({ ...r })),
    );
  }
  const [header, ...lines] = parseDelimited(text, language === "tsv" ? "\t" : ",");
  if (!header) throw new Error("no rows");
  const columns = header.map((name, i) => name.trim() || `Column ${i + 1}`);
  return withNumbers(
    columns,
    lines.map((line) =>
      Object.fromEntries(columns.map((name, i) => [name, (line[i] ?? "").trim()])),
    ),
  );
}

export interface QueryResult {
  /** The block the result is. */
  id: BulletId;
  /** Its markdown. */
  content: string;
  /** Where it is: the texts of its ancestors, outermost first. */
  path?: string;
}

/** The blocks of a tree whose text holds every word of the query (case does
 *  not matter), in document order. `{{...}}` blocks are skipped, so a query
 *  block does not find itself. */
export function searchBlocks(tree: OutlinerValue, query: string, limit = 50): QueryResult[] {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const out: QueryResult[] = [];
  if (words.length === 0) return out;
  const walk = (list: Bullet[], path: string[]) => {
    for (const bullet of list) {
      if (out.length >= limit) return;
      const text = bullet.content.toLowerCase();
      if (
        !/^\{\{[\s\S]*\}\}$/.test(bullet.content.trim()) &&
        words.every((w) => text.includes(w))
      ) {
        out.push({ id: bullet.id, content: bullet.content, path: path.join(" › ") || undefined });
      }
      if (bullet.children?.length) walk(bullet.children, [...path, plainLabel(bullet.content)]);
    }
  };
  walk(tree, []);
  return out;
}
