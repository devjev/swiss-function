import { describe, expect, it } from "vitest";
import { clamp, formatValue, parseDraft, sanitizeDraft } from "./digitInputMicroFormat";

const int = { decimals: 0, allowNegative: false };
const money = { decimals: 2, allowNegative: false };
const signed = { decimals: 0, allowNegative: true };

describe("sanitizeDraft", () => {
  it("keeps digits, drops everything else", () => {
    expect(sanitizeDraft("12ab3", int)).toBe("123");
    expect(sanitizeDraft("1 2-3", int)).toBe("123");
  });

  it("strips decimal points when decimals is 0", () => {
    expect(sanitizeDraft("1.2.3", int)).toBe("123");
  });

  it("keeps a single decimal point and caps decimal places", () => {
    expect(sanitizeDraft("1.2.3", money)).toBe("1.23");
    expect(sanitizeDraft("1.239", money)).toBe("1.23");
    expect(sanitizeDraft("12.", money)).toBe("12.");
  });

  it("keeps a leading minus only when negatives are allowed", () => {
    expect(sanitizeDraft("-5", signed)).toBe("-5");
    expect(sanitizeDraft("-5", int)).toBe("5");
    expect(sanitizeDraft("5-3", signed)).toBe("53");
  });
});

describe("parseDraft", () => {
  it("parses complete numbers", () => {
    expect(parseDraft("42")).toBe(42);
    expect(parseDraft("4.25")).toBe(4.25);
    expect(parseDraft("-7")).toBe(-7);
  });

  it("returns null for empty or incomplete drafts", () => {
    expect(parseDraft("")).toBeNull();
    expect(parseDraft("-")).toBeNull();
    expect(parseDraft(".")).toBeNull();
    expect(parseDraft("-.")).toBeNull();
  });
});

describe("formatValue", () => {
  it("renders null as empty string", () => {
    expect(formatValue(null)).toBe("");
    expect(formatValue(undefined)).toBe("");
  });

  it("stringifies numbers", () => {
    expect(formatValue(42)).toBe("42");
    expect(formatValue(4.25)).toBe("4.25");
  });
});

describe("clamp", () => {
  it("passes null through", () => {
    expect(clamp(null, 0, 10)).toBeNull();
  });

  it("clamps to bounds", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it("treats missing bounds as open", () => {
    expect(clamp(-100, undefined, 10)).toBe(-100);
    expect(clamp(100, 0, undefined)).toBe(100);
  });
});
