import { describe, expect, it } from "vitest";
import { buildFeatures } from "./childWindow";

// The DOM-facing helpers (syncStyles, syncThemeAttr, watchChildClosed) are
// exercised against real popup windows in PopOut.spec.tsx (Playwright CT);
// only the pure feature-string math is unit-tested here.

const opener = (over: Partial<Window> = {}): Window =>
  ({ screenX: 100, screenY: 50, outerHeight: 800, innerHeight: 720, ...over }) as Window;

describe("buildFeatures", () => {
  it("is a bare popup without a rect", () => {
    expect(buildFeatures(undefined, opener())).toBe("popup=yes");
  });

  it("translates client coordinates to screen coordinates", () => {
    expect(buildFeatures({ left: 20, top: 10, width: 640, height: 480 }, opener())).toBe(
      // top = screenY 50 + chrome (800 - 720) + 10
      "popup=yes,width=640,height=480,left=120,top=140",
    );
  });

  it("emits only the fields the rect provides", () => {
    expect(buildFeatures({ width: 300 }, opener())).toBe("popup=yes,width=300");
  });

  it("rounds fractional rects and clamps negative chrome height", () => {
    expect(
      buildFeatures(
        { left: 10.6, top: 0.4, width: 99.5 },
        opener({ outerHeight: 700, innerHeight: 720 }),
      ),
    ).toBe("popup=yes,width=100,left=111,top=50");
  });
});
