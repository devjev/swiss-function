import { describe, expect, it } from "vitest";
import { formatEditDisplay } from "./editors";

describe("formatEditDisplay", () => {
  it("shows booleans as the editor's True/False labels", () => {
    expect(formatEditDisplay(true, { type: "boolean" })).toBe("True");
    expect(formatEditDisplay(false, { type: "boolean" })).toBe("False");
  });

  it("shows a select value's label, not the raw value", () => {
    const config = {
      type: "select" as const,
      options: [
        { value: "admin", label: "Admin" },
        { value: "user", label: "User" },
      ],
    };
    expect(formatEditDisplay("admin", config)).toBe("Admin");
    // Unknown value falls back to the raw string.
    expect(formatEditDisplay("ghost", config)).toBe("ghost");
  });

  it("formats numbers with the configured decimals and unit", () => {
    expect(formatEditDisplay(43.7, { type: "number", decimals: 1, unit: "%" })).toBe("43.7 %");
    expect(formatEditDisplay(5, { type: "number" })).toBe("5");
    expect(formatEditDisplay(null, { type: "number", decimals: 2 })).toBe("");
  });

  it("formats dates as ISO YYYY-MM-DD (matching DatePicker)", () => {
    expect(formatEditDisplay(new Date(2022, 1, 1), { type: "date" })).toBe("2022-02-01");
    expect(formatEditDisplay(null, { type: "date" })).toBe("");
  });

  it("passes text through", () => {
    expect(formatEditDisplay("hello", { type: "text" })).toBe("hello");
    expect(formatEditDisplay(null, { type: "text" })).toBe("");
  });
});
