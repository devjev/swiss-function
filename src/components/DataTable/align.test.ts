import { describe, expect, it } from "vitest";
import { type LeafColumnDef, resolveAlign } from "./types";

type Row = { name: string; amount: number; active: boolean };

const col = (extra: Partial<LeafColumnDef<Row>>): LeafColumnDef<Row> => ({
  id: "c",
  header: "C",
  accessor: "name",
  ...extra,
});

describe("resolveAlign", () => {
  it("ends a number column, so the digits line up", () => {
    expect(resolveAlign(col({ edit: { type: "number" } }))).toBe("end");
    expect(resolveAlign(col({ edit: { type: "number", decimals: 2 } }))).toBe("end");
  });

  it("centres a boolean column under its title", () => {
    expect(resolveAlign(col({ edit: { type: "boolean" } }))).toBe("center");
  });

  it("starts text, dates and selects", () => {
    expect(resolveAlign(col({ edit: { type: "text" } }))).toBe("start");
    expect(resolveAlign(col({ edit: { type: "date" } }))).toBe("start");
    expect(resolveAlign(col({ edit: { type: "select", options: [] } }))).toBe("start");
  });

  it("starts a column that declares no type", () => {
    expect(resolveAlign(col({}))).toBe("start");
  });

  it("takes a declared align over the type's", () => {
    expect(resolveAlign(col({ align: "start", edit: { type: "number" } }))).toBe("start");
    expect(resolveAlign(col({ align: "end" }))).toBe("end");
    expect(resolveAlign(col({ align: "center", edit: { type: "number" } }))).toBe("center");
  });
});
