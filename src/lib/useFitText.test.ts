import { describe, expect, it } from "vitest";
import { fitScale } from "./useFitText";

describe("fitScale", () => {
  it("is 1 when the text fits or nothing is laid out", () => {
    expect(fitScale(200, 150, 0.5)).toBe(1);
    expect(fitScale(200, 200, 0.5)).toBe(1);
    expect(fitScale(0, 150, 0.5)).toBe(1);
  });

  it("is the ratio, rounded down, when the text is too wide", () => {
    expect(fitScale(131, 180, 0.5)).toBe(0.727);
    expect(fitScale(100, 300, 0.25)).toBe(0.333);
  });

  it("stops at the minimum scale", () => {
    expect(fitScale(50, 300, 0.5)).toBe(0.5);
  });
});
