import { describe, expect, it } from "vitest";
import {
  activeTitleId,
  buildMarkers,
  buildTitleItems,
  type VerticalFormEntry,
  type VerticalFormTitle,
} from "./VerticalForm";

describe("buildMarkers", () => {
  it("sorts entries by content offset (Map order is not DOM order)", () => {
    const entries: VerticalFormEntry[] = [
      { id: "b", top: 200, height: 80, label: "B", level: 1 },
      { id: "a", top: 0, height: 80, label: "A", level: 1 },
      { id: "c", top: 100, height: 80, label: "C", level: 1 },
    ];
    expect(buildMarkers(entries).map((m) => m.id)).toEqual(["a", "c", "b"]);
  });

  it("emits a filled block span (its height) for every row", () => {
    const [marker] = buildMarkers([{ id: "a", top: 40, height: 120, label: "A", level: 1 }]);
    expect(marker?.height).toBe(120);
  });

  it("gives named entries a labeled header, unnamed ones a bare block", () => {
    const [named, unnamed] = buildMarkers([
      { id: "n", top: 0, height: 80, label: "Name", level: 2 },
      { id: "u", top: 90, height: 80, level: 2 },
    ]);
    expect(named?.kind).toBe("header");
    expect(named?.label).toBe("Name");
    expect(unnamed?.kind).toBe("block");
    expect(unnamed?.label).toBeUndefined();
  });

  it("carries level and tone through", () => {
    const [marker] = buildMarkers([
      { id: "x", top: 0, height: 80, label: "X", level: 2, tone: "danger" },
    ]);
    expect(marker?.level).toBe(2);
    expect(marker?.tone).toBe("danger");
  });

  it("does not mutate the input array", () => {
    const entries: VerticalFormEntry[] = [
      { id: "b", top: 200, height: 80, label: "B", level: 1 },
      { id: "a", top: 0, height: 80, label: "A", level: 1 },
    ];
    buildMarkers(entries);
    expect(entries.map((e) => e.id)).toEqual(["b", "a"]);
  });
});

describe("buildTitleItems", () => {
  it("keeps top-level titles flush and indents deeper ones", () => {
    const titles: VerticalFormTitle[] = [
      { id: "s", label: "Account", level: 1, top: 0, height: 40 },
      { id: "f", label: "Email", level: 2, top: 40, height: 40 },
    ];
    const items = buildTitleItems(titles);
    expect(items[0]).toEqual({ value: "s", label: "Account" });
    expect(items[1]?.value).toBe("f");
    expect(items[1]?.label.endsWith("Email")).toBe(true);
    expect(items[1]?.label.length).toBeGreaterThan("Email".length);
  });
});

describe("activeTitleId", () => {
  const titles: VerticalFormTitle[] = [
    { id: "a", label: "A", level: 1, top: 0, height: 80 },
    { id: "b", label: "B", level: 1, top: 100, height: 80 },
    { id: "c", label: "C", level: 1, top: 200, height: 80 },
  ];

  it("returns the last title at or above the viewport top", () => {
    expect(activeTitleId(titles, 0, 500)).toBe("a");
    expect(activeTitleId(titles, 120, 500)).toBe("b");
    expect(activeTitleId(titles, 205, 500)).toBe("c");
  });

  it("clamps to the last title once scrolled to the bottom", () => {
    expect(activeTitleId(titles, 500, 500)).toBe("c");
  });

  it("returns empty when there are no titles", () => {
    expect(activeTitleId([], 0, 500)).toBe("");
  });

  it("defaults to the first title so the nav is never empty at rest", () => {
    // First title sits below the top (content padding above it): still active.
    const padded: VerticalFormTitle[] = [
      { id: "a", label: "A", level: 1, top: 24, height: 80 },
      { id: "b", label: "B", level: 1, top: 140, height: 80 },
    ];
    expect(activeTitleId(padded, 0, 500)).toBe("a");
  });
});
