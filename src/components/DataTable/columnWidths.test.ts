import { describe, expect, it } from "vitest";
import { buildColumnTemplate } from "./columnWidths";

describe("buildColumnTemplate", () => {
  it("emits a fluid minmax track for an auto-sized column", () => {
    expect(buildColumnTemplate([{ id: "a" }], {})).toBe("minmax(calc(var(--sf-unit) * 5), 1fr)");
  });

  it("emits a unit-multiple track for a static width", () => {
    expect(buildColumnTemplate([{ id: "a", width: 8 }], {})).toBe("calc(var(--sf-unit) * 8)");
  });

  it("emits a fixed px track when an override is present", () => {
    expect(buildColumnTemplate([{ id: "a", width: 8 }], { a: 240 })).toBe("240px");
  });

  it("an override wins over a static width", () => {
    const auto = buildColumnTemplate([{ id: "a" }], { a: 120 });
    expect(auto).toBe("120px");
  });

  it("joins tracks in column order, mixing all three cases", () => {
    expect(
      buildColumnTemplate([{ id: "a", width: 6 }, { id: "b" }, { id: "c", width: 10 }], { b: 200 }),
    ).toBe("calc(var(--sf-unit) * 6) 200px calc(var(--sf-unit) * 10)");
  });
});
