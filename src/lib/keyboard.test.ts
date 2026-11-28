import { describe, expect, it } from "vitest";
import { hiddenInsets, keyboardOpen } from "./keyboard";

const LAYOUT = 844;

describe("keyboardOpen", () => {
  it("is false with the whole window visible, or a bar's height missing", () => {
    expect(keyboardOpen(LAYOUT, { offsetTop: 0, height: 844 })).toBe(false);
    expect(keyboardOpen(LAYOUT, { offsetTop: 0, height: 790 })).toBe(false);
    expect(keyboardOpen(LAYOUT, null)).toBe(false);
  });

  it("is true when a keyboard takes the bottom of the window", () => {
    expect(keyboardOpen(LAYOUT, { offsetTop: 0, height: 500 })).toBe(true);
  });

  it("is false while the page is pinch-zoomed", () => {
    expect(keyboardOpen(LAYOUT, { offsetTop: 120, height: 400, scale: 2 })).toBe(false);
  });
});

describe("hiddenInsets", () => {
  const full = { top: 0, bottom: 844 };

  it("is nothing while no keyboard is open, however the box is scrolled", () => {
    expect(
      hiddenInsets({ top: -300, bottom: 1200 }, LAYOUT, { offsetTop: 0, height: 844 }),
    ).toEqual({
      top: 0,
      bottom: 0,
      open: false,
    });
  });

  it("is the part under the keyboard for a box filling the window", () => {
    expect(hiddenInsets(full, LAYOUT, { offsetTop: 0, height: 500 })).toEqual({
      top: 0,
      bottom: 344,
      open: true,
    });
  });

  it("adds the part the browser panned out at the top", () => {
    expect(hiddenInsets(full, LAYOUT, { offsetTop: 120, height: 500 })).toEqual({
      top: 120,
      bottom: 224,
      open: true,
    });
  });

  it("is nothing for a box inside the visible part", () => {
    expect(
      hiddenInsets({ top: 200, bottom: 400 }, LAYOUT, { offsetTop: 100, height: 500 }),
    ).toEqual({
      top: 0,
      bottom: 0,
      open: true,
    });
  });
});
