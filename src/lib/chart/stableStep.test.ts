import { describe, expect, it } from "vitest";
import { domainKeyOf, type StepSession, stableValue } from "./stableStep";

const TARGET = 80;
const KEY = "0.00000:100.000";

describe("stableValue", () => {
  it("adopts the candidate on first call and records it in the session", () => {
    const session: StepSession<number> = {};
    const result = stableValue(session, 5, undefined, TARGET, KEY);
    expect(result).toBe(5);
    expect(session.value).toBe(5);
    expect(session.domainKey).toBe(KEY);
    expect(session.spacingPx).toBeUndefined();
  });

  it("keeps the previous value while its spacing sits inside the band", () => {
    const session: StepSession<number> = { value: 5, domainKey: KEY };
    // Candidate differs (2), but the kept value still yields 100px ≈ 1.25×
    // the 80px target — well inside [0.7, 1.6] × target.
    const result = stableValue(session, 2, 100, TARGET, KEY);
    expect(result).toBe(5);
    expect(session.value).toBe(5);
  });

  it("keeps at both band edges inclusively (>= low and <= high keep)", () => {
    // low edge: 0.7 × 80 = 56px exactly still keeps.
    const atLow: StepSession<number> = { value: 5, domainKey: KEY };
    expect(stableValue(atLow, 2, 0.7 * TARGET, TARGET, KEY)).toBe(5);
    // high edge: 1.6 × 80 = 128px exactly still keeps.
    const atHigh: StepSession<number> = { value: 5, domainKey: KEY };
    expect(stableValue(atHigh, 10, 1.6 * TARGET, TARGET, KEY)).toBe(5);
  });

  it("adopts the candidate when spacing falls below the low edge", () => {
    const session: StepSession<number> = { value: 5, domainKey: KEY };
    const result = stableValue(session, 2, 0.7 * TARGET - 0.01, TARGET, KEY);
    expect(result).toBe(2);
    expect(session.value).toBe(2);
  });

  it("adopts the candidate when spacing rises above the high edge", () => {
    const session: StepSession<number> = { value: 5, domainKey: KEY };
    const result = stableValue(session, 10, 1.6 * TARGET + 0.01, TARGET, KEY);
    expect(result).toBe(10);
    expect(session.value).toBe(10);
  });

  it("resets on domain change even when the old value's spacing is in band", () => {
    const session: StepSession<number> = { value: 5, domainKey: KEY };
    const result = stableValue(session, 2, TARGET, TARGET, "0.00000:50.0000");
    expect(result).toBe(2);
    expect(session.value).toBe(2);
    expect(session.domainKey).toBe("0.00000:50.0000");
  });

  it("adopts when no spacing for the kept value is provided", () => {
    const session: StepSession<number> = { value: 5, domainKey: KEY };
    expect(stableValue(session, 2, undefined, TARGET, KEY)).toBe(2);
  });

  it("mutates the session observably: keep records spacing, adopt clears it", () => {
    const session: StepSession<number> = {};
    stableValue(session, 5, undefined, TARGET, KEY);
    expect(session).toEqual({ value: 5, spacingPx: undefined, domainKey: KEY });
    stableValue(session, 2, 90, TARGET, KEY);
    expect(session).toEqual({ value: 5, spacingPx: 90, domainKey: KEY });
    stableValue(session, 2, 300, TARGET, KEY);
    expect(session).toEqual({ value: 2, spacingPx: undefined, domainKey: KEY });
  });

  it("honors custom band edges", () => {
    const session: StepSession<number> = { value: 5, domainKey: KEY };
    // 60px is inside the default band (0.75×) but below a custom low of 0.9.
    const result = stableValue(session, 2, 60, TARGET, KEY, { low: 0.9, high: 1.2 });
    expect(result).toBe(2);
    const wide: StepSession<number> = { value: 5, domainKey: KEY };
    // 200px (2.5×) is outside the default band but inside a custom high of 3.
    expect(stableValue(wide, 2, 200, TARGET, KEY, { high: 3 })).toBe(5);
  });

  it("works with non-numeric values (time-axis rungs)", () => {
    type Rung = { unit: string; step: number };
    const session: StepSession<Rung> = {};
    const hourly: Rung = { unit: "hour", step: 1 };
    const threeHourly: Rung = { unit: "hour", step: 3 };
    expect(stableValue(session, hourly, undefined, TARGET, KEY)).toBe(hourly);
    // The held rung's spacing is still in band → keep the same object.
    expect(stableValue(session, threeHourly, 70, TARGET, KEY)).toBe(hourly);
    // It drifted too dense → adopt the coarser rung.
    expect(stableValue(session, threeHourly, 30, TARGET, KEY)).toBe(threeHourly);
  });
});

describe("domainKeyOf", () => {
  it("is stable under float jitter far below 6 significant digits", () => {
    expect(domainKeyOf([1.5 + 1e-12, 3.7 - 1e-12])).toBe(domainKeyOf([1.5, 3.7]));
    expect(domainKeyOf([123456.789 + 1e-12, 234567.891])).toBe(
      domainKeyOf([123456.789, 234567.891]),
    );
  });

  it("changes for a real domain move", () => {
    expect(domainKeyOf([0, 100])).not.toBe(domainKeyOf([0, 101]));
    expect(domainKeyOf([0, 100])).not.toBe(domainKeyOf([1, 100]));
    expect(domainKeyOf([1.2341, 1.2349])).not.toBe(domainKeyOf([1.2342, 1.2349]));
  });

  it("formats as lo:hi at 6 significant digits", () => {
    expect(domainKeyOf([0, 100])).toBe("0.00000:100.000");
    expect(domainKeyOf([-2.5, 1234567])).toBe("-2.50000:1.23457e+6");
  });
});
