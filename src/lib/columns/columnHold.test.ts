import { describe, expect, it } from "vitest";
import { COLUMN_HOLD_VAR, columnShrinkAttr, holdMin, isHoldableLength } from "./columnHold";

describe("holdMin", () => {
  it("raises one floor to the preferred width times the hold property", () => {
    expect(holdMin(["48px"], "120px")).toBe("max(48px, calc(120px * var(--sf-column-hold)))");
  });

  it("keeps every floor as its own max() argument", () => {
    expect(holdMin(["calc(var(--sf-unit) * 3)", "137px"], "calc(var(--sf-unit) * 8)")).toBe(
      "max(calc(var(--sf-unit) * 3), 137px, calc(calc(var(--sf-unit) * 8) * var(--sf-column-hold)))",
    );
  });

  it("reads the property the table roots set", () => {
    expect(COLUMN_HOLD_VAR).toBe("--sf-column-hold");
  });
});

describe("columnShrinkAttr", () => {
  it("leaves the attribute off under auto, where the stylesheet reads the token", () => {
    expect(columnShrinkAttr("auto")).toBeUndefined();
    expect(columnShrinkAttr("squeeze")).toBe("squeeze");
    expect(columnShrinkAttr("hold")).toBe("hold");
  });
});

describe("isHoldableLength", () => {
  it("accepts lengths, percentages and calc()", () => {
    for (const size of ["120px", "12rem", "30%", "0.5em", ".5em", "calc(100% - 2rem)"]) {
      expect(isHoldableLength(size)).toBe(true);
    }
  });

  it("rejects flexible and keyword sizes", () => {
    for (const size of ["1fr", "0.5fr", "auto", "min-content", "minmax(4rem, 1fr)", ""]) {
      expect(isHoldableLength(size)).toBe(false);
    }
  });
});
