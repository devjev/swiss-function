import { afterEach, describe, expect, it, vi } from "vitest";
import { AUTO_MARK_CAP, resolveMarks } from "./Slider.math";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveMarks", () => {
  it("returns no ticks for false / undefined", () => {
    expect(resolveMarks(false, 0, 100, 1)).toEqual([]);
    expect(resolveMarks(undefined, 0, 100, 1)).toEqual([]);
  });

  it("returns no ticks when the span is non-positive", () => {
    expect(resolveMarks(true, 10, 10, 1)).toEqual([]);
    expect(resolveMarks([5], 10, 0, 1)).toEqual([]);
  });

  it("auto-generates one tick per step from min to max", () => {
    const marks = resolveMarks(true, 0, 10, 1);
    expect(marks).toHaveLength(11);
    expect(marks[0]).toEqual({ value: 0, position: 0, label: undefined });
    expect(marks[5]).toEqual({ value: 5, position: 0.5, label: undefined });
    expect(marks[10]).toEqual({ value: 10, position: 1, label: undefined });
  });

  it("respects min/max other than 0..100 when normalizing positions", () => {
    const marks = resolveMarks(true, -10, 10, 10);
    expect(marks.map((m) => m.value)).toEqual([-10, 0, 10]);
    expect(marks.map((m) => m.position)).toEqual([0, 0.5, 1]);
  });

  it("renders none and warns when auto-ticks exceed the cap", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    // 0..100 step 1 => 101 ticks, over the cap.
    expect(resolveMarks(true, 0, 100, 1)).toEqual([]);
    expect(warn).toHaveBeenCalledOnce();
    // Exactly at the cap still renders.
    expect(resolveMarks(true, 0, AUTO_MARK_CAP - 1, 1)).toHaveLength(AUTO_MARK_CAP);
  });

  it("falls back to a step of 1 when step is non-positive", () => {
    expect(resolveMarks(true, 0, 4, 0)).toHaveLength(5);
  });

  it("places explicit numeric ticks", () => {
    const marks = resolveMarks([0, 50, 100], 0, 100, 1);
    expect(marks).toEqual([
      { value: 0, position: 0, label: undefined },
      { value: 50, position: 0.5, label: undefined },
      { value: 100, position: 1, label: undefined },
    ]);
  });

  it("carries labels on object ticks", () => {
    const marks = resolveMarks([{ value: 25, label: "¼" }], 0, 100, 1);
    expect(marks).toEqual([{ value: 25, position: 0.25, label: "¼" }]);
  });

  it("drops out-of-range explicit ticks", () => {
    const marks = resolveMarks([-5, 50, 150], 0, 100, 1);
    expect(marks.map((m) => m.value)).toEqual([50]);
  });

  it("does not mutate an explicit marks array", () => {
    const input = [10, 20, 30];
    resolveMarks(input, 0, 100, 1);
    expect(input).toEqual([10, 20, 30]);
  });
});
