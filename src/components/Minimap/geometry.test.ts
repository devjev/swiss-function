import { describe, expect, it } from "vitest";
import {
  decimateLabels,
  grabZone,
  markerRailHeight,
  markerRailY,
  railContentHeight,
  railScrollForBand,
  railVisibleNext,
  resolveMarkerHeight,
  resolveMarkerTop,
  scrollTopForRailPress,
  scrollTopForThumbTop,
  thumbGeometry,
} from "./geometry";

describe("railContentHeight (min-block scrollable rail)", () => {
  it("returns the rail height when the smallest span already meets the floor", () => {
    // Smallest span is 20px, floor is 12px → no growth.
    expect(railContentHeight([20, 40, 80], 400, 12, 40)).toBe(400);
  });

  it("scales up so the smallest span reaches the floor", () => {
    // Smallest span 6px, floor 12px → scale 2 → 800.
    expect(railContentHeight([6, 30], 400, 12, 40)).toBe(800);
  });

  it("caps the scale so a tiny span cannot explode the height", () => {
    // Smallest span 0.1px would need scale 120; capped at 40.
    expect(railContentHeight([0.1], 400, 12, 40)).toBe(400 * 40);
  });

  it("ignores zero-extent markers and returns rail height when there are no spans", () => {
    expect(railContentHeight([0, 0], 400, 12, 40)).toBe(400);
    expect(railContentHeight([], 400, 12, 40)).toBe(400);
  });
});

describe("railScrollForBand (edge-triggered follow)", () => {
  // Content 1200 tall in a 400 viewport; band is 30 tall; margin 24.
  it("holds the scroll when the band is comfortably in view", () => {
    expect(railScrollForBand(200, 30, 400, 1200, 100, 24)).toBe(100);
  });

  it("scrolls up when the band is above the margin", () => {
    // Band top 100, current scroll 200 → band at -100 in view → scroll to 100-24.
    expect(railScrollForBand(100, 30, 400, 1200, 200, 24)).toBe(76);
  });

  it("scrolls down when the band is below the margin", () => {
    // Band bottom 1000+30 vs viewport bottom (400 - 24) at scroll 500.
    expect(railScrollForBand(1000, 30, 400, 1200, 500, 24)).toBe(1000 + 30 - (400 - 24));
  });

  it("never scrolls past the content extent", () => {
    expect(railScrollForBand(1190, 30, 400, 1200, 0, 24)).toBe(800);
  });
});

describe("resolveMarkerTop", () => {
  it("uses top when present", () => {
    expect(resolveMarkerTop({ top: 500 }, 10000)).toBe(500);
  });

  it("resolves topFraction against scrollHeight", () => {
    expect(resolveMarkerTop({ topFraction: 0.25 }, 10000)).toBe(2500);
  });

  it("prefers top when both are present", () => {
    expect(resolveMarkerTop({ top: 0.5, topFraction: 0.9 }, 10000)).toBe(0.5);
  });

  it("drops a marker with neither field", () => {
    expect(resolveMarkerTop({ label: "orphan" }, 10000)).toBeNull();
  });

  it("drops non-finite positions", () => {
    expect(resolveMarkerTop({ top: Number.NaN }, 10000)).toBeNull();
    expect(resolveMarkerTop({ topFraction: Number.POSITIVE_INFINITY }, 10000)).toBeNull();
  });
});

describe("markerRailY (proportional scale)", () => {
  it("maps proportionally", () => {
    expect(markerRailY(5000, 10000, 400)).toBe(200);
  });

  it("clamps to the rail", () => {
    expect(markerRailY(-50, 10000, 400)).toBe(0);
    expect(markerRailY(20000, 10000, 400)).toBe(400);
  });

  it("guards zero scrollHeight", () => {
    expect(markerRailY(100, 0, 400)).toBe(0);
  });
});

describe("markerRailHeight", () => {
  it("scales proportionally with a floor", () => {
    expect(markerRailHeight(1000, 10000, 400, 2)).toBe(40);
    expect(markerRailHeight(10, 10000, 400, 2)).toBe(2);
  });
});

describe("thumbGeometry (proportional scale)", () => {
  it("sizes the band to the viewport ratio", () => {
    const { height } = thumbGeometry(0, 2000, 500, 400, 2);
    expect(height).toBe(100); // 500/2000 * 400
  });

  it("frames exactly the visible content: markers inside the band are the markers on screen", () => {
    // The whole point of the proportional scale (the correspondence contract).
    const scrollHeight = 100000;
    const clientHeight = 800;
    const railHeight = 400;
    const scrollTop = 40000;
    const { top, height } = thumbGeometry(scrollTop, scrollHeight, clientHeight, railHeight, 2);
    // A heading at the top of the viewport maps to the band's top edge…
    expect(markerRailY(scrollTop, scrollHeight, railHeight)).toBeCloseTo(top, 6);
    // …and one at the bottom of the viewport to the band's bottom edge.
    expect(markerRailY(scrollTop + clientHeight, scrollHeight, railHeight)).toBeCloseTo(
      top + height,
      6,
    );
  });

  it("keeps only a visibility floor for very long content", () => {
    const { height } = thumbGeometry(0, 100000, 800, 400, 2);
    expect(height).toBeCloseTo(3.2, 6); // honest proportional size, above the 2px floor
    expect(thumbGeometry(0, 400000, 800, 400, 2).height).toBe(2); // floor engages
  });

  it("reaches exactly the rail bottom at full scroll", () => {
    const scrollHeight = 100000;
    const clientHeight = 800;
    const { top, height } = thumbGeometry(
      scrollHeight - clientHeight,
      scrollHeight,
      clientHeight,
      400,
      2,
    );
    expect(top + height).toBeCloseTo(400, 6);
  });

  it("is at the top at scrollTop 0", () => {
    expect(thumbGeometry(0, 2000, 500, 400, 2).top).toBe(0);
  });

  it("fills the rail when there is no overflow", () => {
    expect(thumbGeometry(0, 400, 500, 400, 2)).toEqual({ top: 0, height: 400 });
  });
});

describe("grabZone", () => {
  it("wraps a tiny visual band in the minimum target size", () => {
    const visual = thumbGeometry(40000, 400000, 800, 400, 2);
    const zone = grabZone(visual, 400, 24);
    expect(zone.height).toBe(24);
    // Centered on the visual band.
    expect(zone.top + zone.height / 2).toBeCloseTo(visual.top + visual.height / 2, 6);
  });

  it("matches a large visual band exactly", () => {
    const visual = thumbGeometry(0, 2000, 500, 400, 2);
    expect(grabZone(visual, 400, 24)).toEqual(visual);
  });

  it("clamps into the rail at the extremes", () => {
    const atTop = grabZone({ top: 0, height: 3 }, 400, 24);
    expect(atTop.top).toBe(0);
    const atBottom = grabZone({ top: 397, height: 3 }, 400, 24);
    expect(atBottom.top + atBottom.height).toBe(400);
  });
});

describe("scrollTopForThumbTop (drag inversion)", () => {
  it("round-trips with thumbGeometry on the same scale", () => {
    const scrollHeight = 100000;
    const clientHeight = 800;
    const railHeight = 400;
    for (const scrollTop of [0, 12345, 50000, 99200]) {
      const { top } = thumbGeometry(scrollTop, scrollHeight, clientHeight, railHeight, 0);
      expect(scrollTopForThumbTop(top, scrollHeight, clientHeight, railHeight)).toBeCloseTo(
        scrollTop,
        6,
      );
    }
  });

  it("clamps to the scrollable range", () => {
    expect(scrollTopForThumbTop(-100, 2000, 500, 400)).toBe(0);
    expect(scrollTopForThumbTop(1000, 2000, 500, 400)).toBe(1500);
  });

  it("guards the no-overflow division", () => {
    expect(scrollTopForThumbTop(100, 400, 500, 400)).toBe(0);
  });
});

describe("scrollTopForRailPress", () => {
  it("centers the viewport on the pressed content position", () => {
    const scrollHeight = 2000;
    const clientHeight = 500;
    const railHeight = 400;
    const pressY = 200; // mid-rail = mid-document
    const scrollTop = scrollTopForRailPress(pressY, scrollHeight, clientHeight, railHeight);
    // The content position under the press sits at the viewport's center.
    expect(scrollTop + clientHeight / 2).toBeCloseTo((pressY / railHeight) * scrollHeight, 6);
  });

  it("clamps at the extremes", () => {
    expect(scrollTopForRailPress(0, 2000, 500, 400)).toBe(0);
    expect(scrollTopForRailPress(400, 2000, 500, 400)).toBe(1500);
  });
});

describe("railVisibleNext (hysteresis)", () => {
  it("shows a hidden rail on any overflow", () => {
    expect(railVisibleNext(false, 501, 500, 144)).toBe(true);
    expect(railVisibleNext(false, 500, 500, 144)).toBe(false);
  });

  it("collapses a visible rail only with the rail width as slack", () => {
    // Content fits, but not by the rail width: hold visible (no flicker loop).
    expect(railVisibleNext(true, 450, 500, 144)).toBe(true);
    // Fits with the slack: collapse.
    expect(railVisibleNext(true, 356, 500, 144)).toBe(false);
  });
});

describe("decimateLabels", () => {
  it("keeps all labels when spaced", () => {
    const labels = [
      { y: 0, level: 1 },
      { y: 50, level: 2 },
      { y: 100, level: 3 },
    ];
    expect(decimateLabels(labels, 24)).toEqual([true, true, true]);
  });

  it("drops the deepest level first on collision", () => {
    const labels = [
      { y: 100, level: 3 },
      { y: 110, level: 1 },
    ];
    expect(decimateLabels(labels, 24)).toEqual([false, true]);
  });

  it("breaks level ties by document order", () => {
    const labels = [
      { y: 100, level: 2 },
      { y: 110, level: 2 },
    ];
    expect(decimateLabels(labels, 24)).toEqual([true, false]);
  });

  it("keeps later labels that clear the kept set", () => {
    // A dozen clustered h3s: only those a line-height apart survive.
    const labels = Array.from({ length: 12 }, (_, i) => ({ y: 100 + i * 8, level: 3 }));
    const visible = decimateLabels(labels, 24);
    const keptYs = labels.filter((_, i) => visible[i]).map((l) => l.y);
    expect(keptYs.length).toBeGreaterThan(1);
    for (let i = 1; i < keptYs.length; i++) {
      expect((keptYs[i] ?? 0) - (keptYs[i - 1] ?? 0)).toBeGreaterThanOrEqual(24);
    }
  });

  it("a shallow label evicts nothing already kept but loses to it", () => {
    // level 1 processed first even though it is later in the document.
    const labels = [
      { y: 100, level: 2 },
      { y: 112, level: 1 },
    ];
    expect(decimateLabels(labels, 24)).toEqual([false, true]);
  });
});

describe("resolveMarkerHeight", () => {
  it("uses height when present", () => {
    expect(resolveMarkerHeight({ top: 0, height: 900 }, 10000)).toBe(900);
  });

  it("resolves heightFraction against scrollHeight", () => {
    expect(resolveMarkerHeight({ top: 0, heightFraction: 0.25 }, 10000)).toBe(2500);
  });

  it("prefers height when both are present", () => {
    expect(resolveMarkerHeight({ top: 0, height: 900, heightFraction: 0.25 }, 10000)).toBe(900);
  });

  it("returns 0 for a bare rule", () => {
    expect(resolveMarkerHeight({ top: 0 }, 10000)).toBe(0);
  });
});
