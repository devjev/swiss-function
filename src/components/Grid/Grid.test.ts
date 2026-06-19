import { describe, expect, it } from "vitest";
import { redistribute, splitTracks, tokenizeTemplate } from "./Grid";

describe("splitTracks", () => {
  it("splits simple space-separated tracks", () => {
    expect(splitTracks("200px 1fr auto")).toEqual(["200px", "1fr", "auto"]);
  });

  it("does not split inside function parentheses", () => {
    expect(splitTracks("minmax(0, 1fr) 200px")).toEqual(["minmax(0, 1fr)", "200px"]);
    expect(splitTracks("repeat(3, 1fr) auto")).toEqual(["repeat(3, 1fr)", "auto"]);
  });

  it("collapses extra whitespace and trims", () => {
    expect(splitTracks("  1fr   2fr  ")).toEqual(["1fr", "2fr"]);
  });
});

describe("tokenizeTemplate", () => {
  it("expands a numeric column count to per-track minmax tokens", () => {
    expect(tokenizeTemplate(3)).toEqual(["minmax(0, 1fr)", "minmax(0, 1fr)", "minmax(0, 1fr)"]);
  });

  it("maps an array: numbers become fr, strings pass through", () => {
    expect(tokenizeTemplate(["auto", 1])).toEqual(["auto", "1fr"]);
    expect(tokenizeTemplate([2, "200px", 1])).toEqual(["2fr", "200px", "1fr"]);
  });

  it("tokenizes a raw string template (paren-aware)", () => {
    expect(tokenizeTemplate("auto minmax(0, 1fr)")).toEqual(["auto", "minmax(0, 1fr)"]);
  });
});

describe("redistribute", () => {
  it("moves the boundary, preserving the pair's sum", () => {
    expect(redistribute([200, 200], 0, 50)).toEqual([250, 150]);
  });

  it("clamps so neither track drops below the minimum", () => {
    // Growing track 0 by 300 would shrink track 1 below min (48) — clamp.
    expect(redistribute([200, 200], 0, 300, 48)).toEqual([352, 48]);
    expect(redistribute([200, 200], 0, -300, 48)).toEqual([48, 352]);
  });

  it("returns the input unchanged for an out-of-range index", () => {
    const sizes = [100, 100];
    expect(redistribute(sizes, 5, 10)).toBe(sizes);
  });
});
