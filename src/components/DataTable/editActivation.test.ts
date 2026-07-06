import { describe, expect, it } from "vitest";
import { resolveEditActivation } from "./editActivation";

describe("resolveEditActivation", () => {
  it("defaults to double when nothing is set", () => {
    expect(resolveEditActivation({})).toBe("double");
  });

  it("uses the table level when column and cell are unset", () => {
    expect(resolveEditActivation({ table: "single" })).toBe("single");
  });

  it("column overrides table", () => {
    expect(resolveEditActivation({ table: "double", column: "single" })).toBe("single");
    expect(resolveEditActivation({ table: "single", column: "double" })).toBe("double");
  });

  it("cell overrides column and table", () => {
    expect(resolveEditActivation({ table: "double", column: "double", cell: "single" })).toBe(
      "single",
    );
    expect(resolveEditActivation({ table: "single", column: "single", cell: "double" })).toBe(
      "double",
    );
  });
});
