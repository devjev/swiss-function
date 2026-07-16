import { afterEach, describe, expect, it, vi } from "vitest";
import {
  capacityMax,
  formatValueText,
  maskStringToUlps,
  normalizeConfig,
  parseDecimalText,
  popDigit,
  pushDigit,
  signedCanonical,
  signedToValue,
  stepSigned,
  stepUlps,
  ulpsToCanonical,
  ulpsToCells,
  ulpsToMaskString,
  ulpsToValue,
  valueToSignedParts,
  valueToUlps,
} from "./digitMath";

// digits=3, decimals=2 → capacity 99999 ulps (999.99), the plan's `_ _ _._ _ %` shape.
const P32 = { digits: 3, decimals: 2 };
const PIN6 = { digits: 6, decimals: 0 };

describe("normalizeConfig", () => {
  afterEach(() => vi.restoreAllMocks());

  it("passes sane configs through untouched", () => {
    expect(normalizeConfig(3, 2)).toEqual({ digits: 3, decimals: 2 });
    expect(normalizeConfig(1, 0)).toEqual({ digits: 1, decimals: 0 });
  });

  it("coerces degenerate configs with a dev warning", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(normalizeConfig(0, -1)).toEqual({ digits: 1, decimals: 0 });
    expect(normalizeConfig(2.7, 1.2)).toEqual({ digits: 2, decimals: 1 });
    expect(normalizeConfig(Number.NaN, 2)).toEqual({ digits: 1, decimals: 2 });
    expect(warn).toHaveBeenCalled();
  });

  it("caps combined precision at 15 so ulps stay exact doubles", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(normalizeConfig(12, 8)).toEqual({ digits: 12, decimals: 3 });
    expect(normalizeConfig(20, 4)).toEqual({ digits: 15, decimals: 0 });
  });
});

describe("pushDigit / popDigit (calculator model)", () => {
  it("pushes digits in from the right", () => {
    expect(pushDigit(null, 4, P32)).toBe(4); // _ _ _._ _ → 000.04
    expect(pushDigit(4, 2, P32)).toBe(42); //             → 000.42
    expect(pushDigit(42, 5, P32)).toBe(425); //           → 004.25
  });

  it("rejects a push that would drop the most-significant typed digit", () => {
    expect(pushDigit(99999, 1, P32)).toBe(99999); // all cells significant
    expect(pushDigit(10000, 1, P32)).toBe(10000); // MSD occupied even with zeros after
    expect(pushDigit(9999, 9, P32)).toBe(99999); // one cell left → accepted
  });

  it("pops back toward pristine", () => {
    expect(popDigit(425)).toBe(42);
    expect(popDigit(10)).toBe(1);
    expect(popDigit(7)).toBe(null); // last digit → pristine
    expect(popDigit(0)).toBe(null); // typed zero is indistinguishable on screen
    expect(popDigit(null)).toBe(null);
  });
});

describe("stepUlps", () => {
  it("steps one least-significant unit and clamps at both ends", () => {
    expect(stepUlps(42, 1, P32)).toBe(43);
    expect(stepUlps(42, -1, P32)).toBe(41);
    expect(stepUlps(0, -1, P32)).toBe(0);
    expect(stepUlps(capacityMax(P32), 1, P32)).toBe(capacityMax(P32));
  });

  it("un-pristines from null: down → 0, up → 1", () => {
    expect(stepUlps(null, -1, P32)).toBe(0);
    expect(stepUlps(null, 1, P32)).toBe(1);
  });
});

describe("valueToUlps / ulpsToValue", () => {
  it("round-trips exactly at fixed precision (0.07 is the classic float trap)", () => {
    expect(valueToUlps(0.07, P32)).toEqual({ ulps: 7, clamped: false });
    expect(valueToUlps(999.99, P32)).toEqual({ ulps: 99999, clamped: false });
    expect(ulpsToValue(7, P32)).toBe(0.07);
    expect(ulpsToValue(null, P32)).toBe(null);
  });

  it("rounds excess precision SILENTLY — only range clamping flags", () => {
    // Rounding must not warn: float artifacts (0.1 + 0.2) would trip it constantly.
    expect(valueToUlps(1.267, P32)).toEqual({ ulps: 127, clamped: false });
    expect(valueToUlps(0.1 + 0.2, P32)).toEqual({ ulps: 30, clamped: false });
  });

  it("clamps out-of-range and rejects non-finite values", () => {
    expect(valueToUlps(1234.5, P32)).toEqual({ ulps: 99999, clamped: true });
    expect(valueToUlps(-3, P32)).toEqual({ ulps: 0, clamped: true });
    expect(valueToUlps(Number.NaN, P32)).toEqual({ ulps: null, clamped: true });
    expect(valueToUlps(Number.POSITIVE_INFINITY, P32)).toEqual({ ulps: null, clamped: true });
  });
});

describe("ulpsToCells / ulpsToCanonical", () => {
  it("left-zero-pads to capacity", () => {
    expect(ulpsToCells(425, P32)).toEqual(["0", "0", "4", "2", "5"]);
    expect(ulpsToCells(0, P32)).toEqual(["0", "0", "0", "0", "0"]);
    expect(ulpsToCells(null, P32)).toBe(null);
    expect(ulpsToCells(123456, PIN6)).toEqual(["1", "2", "3", "4", "5", "6"]);
  });

  it("canonical string always uses '.' regardless of the display separator", () => {
    expect(ulpsToCanonical(425, P32)).toBe("4.25");
    expect(ulpsToCanonical(0, P32)).toBe("0.00");
    expect(ulpsToCanonical(null, P32)).toBe("");
    expect(ulpsToCanonical(7, PIN6)).toBe("7");
  });
});

describe("parseDecimalText", () => {
  it("parses plain decimals with the default separator", () => {
    expect(parseDecimalText("12.5", ".", P32)).toBe(1250);
    expect(parseDecimalText(" 4.2500 ", ".", P32)).toBe(425);
    expect(parseDecimalText("42", ".", P32)).toBe(4200);
  });

  it("respects a comma separator and treats the other glyph as grouping", () => {
    expect(parseDecimalText("12,5", ",", P32)).toBe(1250);
    expect(parseDecimalText("1,234.56", ".", { digits: 4, decimals: 2 })).toBe(123456);
  });

  it("ignores units and other noise", () => {
    expect(parseDecimalText("42 %", ".", P32)).toBe(4200);
    expect(parseDecimalText("CHF 12.30", ".", { digits: 4, decimals: 2 })).toBe(1230);
  });

  it("returns null when no digits survive", () => {
    expect(parseDecimalText("abc", ".", P32)).toBe(null);
    expect(parseDecimalText("", ".", P32)).toBe(null);
    expect(parseDecimalText(".", ".", P32)).toBe(null);
  });

  it("rounds extra fraction digits and clamps to capacity", () => {
    expect(parseDecimalText("1.267", ".", P32)).toBe(127);
    expect(parseDecimalText("12345.67", ".", P32)).toBe(99999);
  });

  it("falls back to '.' when the configured separator is not a single char", () => {
    expect(parseDecimalText("12.5", "", P32)).toBe(1250);
  });
});

describe("ulpsToMaskString / maskStringToUlps (mask mode)", () => {
  it("round-trips complete values and treats partial strings as null", () => {
    expect(ulpsToMaskString(425, P32)).toBe("00425");
    expect(ulpsToMaskString(null, P32)).toBe("");
    expect(maskStringToUlps("00425", P32)).toBe(425);
    expect(maskStringToUlps("425", P32)).toBe(null); // partial → no value yet
    expect(maskStringToUlps("", P32)).toBe(null);
  });
});

describe("formatValueText", () => {
  it("reads 'blank' when pristine, appends string units, ignores node units", () => {
    expect(formatValueText(null, P32, "%")).toBe("blank");
    expect(formatValueText(4250, P32, "%")).toBe("42.50 %");
    expect(formatValueText(4250, P32, undefined)).toBe("42.50");
    expect(formatValueText(4250, P32, { node: true })).toBe("42.50");
  });
});

describe("valueToSignedParts", () => {
  it("splits a value into magnitude ulps + sign", () => {
    expect(valueToSignedParts(42.5, P32)).toEqual({ ulps: 4250, sign: 1, clamped: false });
    expect(valueToSignedParts(-42.5, P32)).toEqual({ ulps: 4250, sign: -1, clamped: false });
    expect(valueToSignedParts(0, P32)).toEqual({ ulps: 0, sign: 1, clamped: false });
    expect(valueToSignedParts(null, P32)).toEqual({ ulps: null, sign: 1, clamped: false });
  });

  it("clamps the magnitude to capacity, keeping the sign", () => {
    expect(valueToSignedParts(-9999, P32)).toEqual({ ulps: 99999, sign: -1, clamped: true });
  });
});

describe("signedToValue", () => {
  it("applies the sign; null stays null and zero is +0", () => {
    expect(signedToValue(4250, -1, P32)).toBe(-42.5);
    expect(signedToValue(4250, 1, P32)).toBe(42.5);
    expect(signedToValue(0, -1, P32)).toBe(0);
    expect(Object.is(signedToValue(0, -1, P32), -0)).toBe(false);
    expect(signedToValue(null, -1, P32)).toBeNull();
  });
});

describe("stepSigned", () => {
  it("steps the signed magnitude, crossing zero into negatives", () => {
    expect(stepSigned(1, 1, -1, P32)).toEqual({ ulps: 0, sign: 1 }); // +1 → 0
    expect(stepSigned(0, 1, -1, P32)).toEqual({ ulps: 1, sign: -1 }); // 0 → -1
    expect(stepSigned(1, -1, -1, P32)).toEqual({ ulps: 2, sign: -1 }); // -1 → -2
    expect(stepSigned(1, -1, 1, P32)).toEqual({ ulps: 0, sign: 1 }); // -1 → 0
    expect(stepSigned(null, 1, -1, P32)).toEqual({ ulps: 1, sign: -1 }); // pristine down → -1
  });

  it("clamps to ±capacity", () => {
    expect(stepSigned(99999, 1, 1, P32)).toEqual({ ulps: 99999, sign: 1 });
    expect(stepSigned(99999, -1, -1, P32)).toEqual({ ulps: 99999, sign: -1 });
  });
});

describe("signedCanonical", () => {
  it("prefixes a minus only for a non-zero negative magnitude", () => {
    expect(signedCanonical(4250, -1, P32)).toBe("-42.50");
    expect(signedCanonical(4250, 1, P32)).toBe("42.50");
    expect(signedCanonical(0, -1, P32)).toBe("0.00"); // no -0
    expect(signedCanonical(null, -1, P32)).toBe("");
  });
});
