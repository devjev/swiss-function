import { describe, expect, it } from "vitest";
import { isTouchHandle } from "./sensors";

// Vitest runs in node here: build the three-element chain the function walks
// from plain objects that pass its `instanceof Element` check.
class FakeElement {
  constructor(
    public touchAction: string,
    public parentElement: FakeElement | null = null,
  ) {}
}

describe("isTouchHandle", () => {
  const touchActionOf = (el: Element) => (el as unknown as FakeElement).touchAction;
  const withElement = <T>(run: () => T): T => {
    const g = globalThis as { Element?: unknown };
    const before = g.Element;
    g.Element = FakeElement;
    try {
      return run();
    } finally {
      g.Element = before;
    }
  };
  const el = (touchAction: string, parent: FakeElement | null = null) =>
    new FakeElement(touchAction, parent) as unknown as Element;

  it("is a handle when the target or an element up to the draggable gave up touch scrolling", () => {
    withElement(() => {
      const row = el("auto");
      const grip = el("none", row as unknown as FakeElement);
      const glyph = el("auto", grip as unknown as FakeElement);
      expect(isTouchHandle(glyph, row, touchActionOf)).toBe(true);
      expect(isTouchHandle(grip, row, touchActionOf)).toBe(true);
    });
  });

  it("is not a handle on a row that still scrolls", () => {
    withElement(() => {
      const row = el("auto");
      const cell = el("manipulation", row as unknown as FakeElement);
      expect(isTouchHandle(cell, row, touchActionOf)).toBe(false);
    });
  });

  it("does not look past the draggable node", () => {
    withElement(() => {
      const chart = el("none");
      const row = el("auto", chart as unknown as FakeElement);
      const cell = el("auto", row as unknown as FakeElement);
      expect(isTouchHandle(cell, row, touchActionOf)).toBe(false);
    });
  });

  it("is false for a target that is not an element", () => {
    withElement(() => expect(isTouchHandle(null, null, touchActionOf)).toBe(false));
  });
});
