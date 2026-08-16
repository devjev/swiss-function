import { describe, expect, it } from "vitest";
import {
  barEdges,
  barLevels,
  computePeaks,
  formatTime,
  quantizeSteps,
  rebucket,
} from "./AudioPlayer.math";

describe("formatTime", () => {
  it("formats sub-minute and sub-hour times", () => {
    expect(formatTime(0)).toBe("0:00");
    expect(formatTime(9)).toBe("0:09");
    expect(formatTime(59)).toBe("0:59");
    expect(formatTime(61)).toBe("1:01");
    expect(formatTime(600)).toBe("10:00");
  });

  it("switches to h:mm:ss from one hour", () => {
    expect(formatTime(3600)).toBe("1:00:00");
    expect(formatTime(3661)).toBe("1:01:01");
  });

  it("pads elapsed to the reference's width", () => {
    expect(formatTime(12, 225)).toBe("0:12");
    expect(formatTime(12, 3661)).toBe("0:00:12");
    expect(formatTime(0, 3600)).toBe("0:00:00");
  });

  it("ignores a reference smaller than the value", () => {
    expect(formatTime(3661, 60)).toBe("1:01:01");
  });

  it("renders unknown times as --:--", () => {
    expect(formatTime(Number.NaN)).toBe("--:--");
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe("--:--");
    expect(formatTime(-1)).toBe("--:--");
  });

  it("truncates fractional seconds", () => {
    expect(formatTime(59.9)).toBe("0:59");
  });
});

describe("computePeaks", () => {
  it("takes the max absolute sample per bucket", () => {
    const channel = new Float32Array([0.1, -0.8, 0.2, 0.3, -0.1, 0.5, 0.4, 0.0]);
    const peaks = Array.from(computePeaks([channel], 4));
    expect(peaks.map((v) => Math.round(v * 10) / 10)).toEqual([0.8, 0.3, 0.5, 0.4]);
  });

  it("takes the max across channels", () => {
    const left = new Float32Array([0.1, 0.1]);
    const right = new Float32Array([-0.9, 0.2]);
    const peaks = computePeaks([left, right], 2);
    expect(peaks[0]).toBeCloseTo(0.9);
    expect(peaks[1]).toBeCloseTo(0.2);
  });

  it("handles fewer samples than buckets", () => {
    const peaks = computePeaks([new Float32Array([0.5])], 4);
    expect(peaks).toHaveLength(4);
    expect(peaks[0]).toBeCloseTo(0.5);
  });

  it("handles empty input", () => {
    expect(Array.from(computePeaks([], 4))).toEqual([0, 0, 0, 0]);
    expect(Array.from(computePeaks([new Float32Array(0)], 2))).toEqual([0, 0]);
    expect(computePeaks([new Float32Array([1])], 0)).toHaveLength(0);
  });

  it("handles mismatched channel lengths", () => {
    const long = new Float32Array([0.1, 0.2, 0.3, 0.4]);
    const short = new Float32Array([0.9]);
    const peaks = computePeaks([long, short], 2);
    expect(peaks[0]).toBeCloseTo(0.9);
    expect(peaks[1]).toBeCloseTo(0.4);
  });
});

describe("rebucket", () => {
  it("returns a copy at identical size", () => {
    const peaks = new Float32Array([0.1, 0.2]);
    const out = rebucket(peaks, 2);
    expect(out).not.toBe(peaks);
    expect(Array.from(out)).toEqual([0.10000000149011612, 0.20000000298023224]);
  });

  it("max-pools when downsampling", () => {
    const peaks = new Float32Array([0.1, 0.9, 0.2, 0.3, 0.8, 0.1]);
    const out = rebucket(peaks, 3);
    expect(out[0]).toBeCloseTo(0.9);
    expect(out[1]).toBeCloseTo(0.3);
    expect(out[2]).toBeCloseTo(0.8);
  });

  it("stretches when upsampling", () => {
    const out = rebucket(new Float32Array([0.4, 0.6]), 4);
    expect(Array.from(out).map((v) => Math.round(v * 10) / 10)).toEqual([0.4, 0.4, 0.6, 0.6]);
  });

  it("handles empty input and zero buckets", () => {
    expect(Array.from(rebucket(new Float32Array(0), 3))).toEqual([0, 0, 0]);
    expect(rebucket(new Float32Array([1]), 0)).toHaveLength(0);
  });
});

describe("barEdges", () => {
  it("covers every bin exactly once, monotonically", () => {
    const edges = barEdges(128, 24);
    expect(edges[0]).toBe(0);
    expect(edges[edges.length - 1]).toBe(128);
    expect(edges).toHaveLength(25);
    for (let i = 1; i < edges.length; i++) {
      expect(edges[i] ?? -1).toBeGreaterThan(edges[i - 1] ?? -1);
    }
  });

  it("is log-spaced: later bars span more bins", () => {
    const edges = barEdges(128, 16);
    const firstWidth = (edges[1] ?? 0) - (edges[0] ?? 0);
    const lastWidth = (edges[16] ?? 0) - (edges[15] ?? 0);
    expect(lastWidth).toBeGreaterThan(firstWidth);
  });

  it("degrades safely when there are fewer bins than bars", () => {
    const edges = barEdges(4, 8);
    expect(edges[0]).toBe(0);
    expect(edges[edges.length - 1]).toBe(4);
    for (let i = 1; i < edges.length; i++) {
      expect(edges[i] ?? -1).toBeGreaterThanOrEqual(edges[i - 1] ?? -1);
    }
  });
});

describe("barLevels", () => {
  it("normalizes the per-bar max to 0..1", () => {
    const freq = new Uint8Array(128);
    freq[0] = 255;
    freq[127] = 51;
    const levels = barLevels(freq, 8);
    expect(levels[0]).toBe(1);
    expect(levels[7]).toBeCloseTo(0.2);
  });

  it("registers a narrow peak in exactly one bar", () => {
    const freq = new Uint8Array(128);
    freq[64] = 200;
    const levels = barLevels(freq, 16);
    expect(levels.filter((v) => v > 0)).toHaveLength(1);
  });

  it("handles empty input", () => {
    expect(Array.from(barLevels(new Uint8Array(0), 4))).toEqual([0, 0, 0, 0]);
    expect(barLevels(new Uint8Array([255]), 0)).toHaveLength(0);
  });
});

describe("quantizeSteps", () => {
  it("snaps onto discrete rungs", () => {
    expect(quantizeSteps(0.5, 10)).toBe(0.5);
    expect(quantizeSteps(0.44, 10)).toBeCloseTo(0.4);
    expect(quantizeSteps(0.46, 10)).toBeCloseTo(0.5);
  });

  it("never drops below one rung", () => {
    expect(quantizeSteps(0, 10)).toBe(0.1);
    expect(quantizeSteps(0.001, 10)).toBe(0.1);
  });

  it("clamps out-of-range input", () => {
    expect(quantizeSteps(1.5, 4)).toBe(1);
    expect(quantizeSteps(-1, 4)).toBe(0.25);
  });

  it("returns 0 for a degenerate step count", () => {
    expect(quantizeSteps(0.5, 0)).toBe(0);
  });
});
