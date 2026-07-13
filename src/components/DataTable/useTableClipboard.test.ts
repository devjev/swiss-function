import { describe, expect, it } from "vitest";
import { serializeSelection } from "./useTableClipboard";

// A 3x3 grid of values; header names per column index.
const value = (r: number, c: number) => `r${r}c${c}`;
const header = (c: number) => ["name", "age", "role"][c] ?? `col${c}`;

describe("serializeSelection", () => {
  it("emits TSV for the selected rectangle without a header row by default", () => {
    const tsv = serializeSelection(
      { start: { row: 0, col: 0 }, end: { row: 1, col: 1 } },
      null,
      value,
    );
    expect(tsv).toBe("r0c0\tr0c1\nr1c0\tr1c1");
  });

  it("prepends the selected columns' headers when getHeader is provided", () => {
    const tsv = serializeSelection(
      { start: { row: 0, col: 0 }, end: { row: 1, col: 1 } },
      null,
      value,
      header,
    );
    expect(tsv).toBe("name\tage\nr0c0\tr0c1\nr1c0\tr1c1");
  });

  it("only includes headers for the selected column span (offset selection)", () => {
    const tsv = serializeSelection(
      { start: { row: 2, col: 1 }, end: { row: 2, col: 2 } },
      null,
      value,
      header,
    );
    expect(tsv).toBe("age\trole\nr2c1\tr2c2");
  });

  it("serializes a single active cell, with its header when requested", () => {
    expect(serializeSelection(null, { row: 1, col: 2 }, value)).toBe("r1c2");
    expect(serializeSelection(null, { row: 1, col: 2 }, value, header)).toBe("role\nr1c2");
  });

  it("returns an empty string with no selection", () => {
    expect(serializeSelection(null, null, value, header)).toBe("");
  });
});
