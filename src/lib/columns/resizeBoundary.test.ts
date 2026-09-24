import { describe, expect, it } from "vitest";
import { describeColumnWidth, formatColumnWidth } from "./resizeBoundary";

describe("formatColumnWidth", () => {
  it("prints unit multiples and px, dropping trailing zeros", () => {
    expect(formatColumnWidth(288, 24, false)).toBe("12u · 288px");
    expect(formatColumnWidth(300, 24, false)).toBe("12.5u · 300px");
    expect(formatColumnWidth(301, 24, false)).toBe("12.54u · 301px");
  });
  it("says min at the floor", () => {
    expect(formatColumnWidth(168, 24, true)).toBe("7u · 168px · min");
  });
  it("falls back to px until the unit is measured", () => {
    expect(formatColumnWidth(168.4, null, false)).toBe("168px");
    expect(formatColumnWidth(168, 0, true)).toBe("168px · min");
  });
});

describe("describeColumnWidth", () => {
  it("reads as px, with minimum at the floor", () => {
    expect(describeColumnWidth(240, false)).toBe("240 px");
    expect(describeColumnWidth(167.6, true)).toBe("168 px, minimum");
  });
});
