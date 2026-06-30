import { describe, expect, it } from "vitest";
import {
  areasToFC,
  arrowsToFC,
  bearing,
  kindOfLayer,
  overlayBounds,
  pointsToFC,
  vectorsToFC,
} from "./layers";
import type { ColorResolver } from "./types";

/** Identity resolver so tests assert the raw color string flows into properties. */
const id: ColorResolver = (c) => c;

describe("bearing", () => {
  it("is 0 due north and 90 due east", () => {
    expect(bearing([0, 0], [0, 1])).toBeCloseTo(0, 5);
    expect(bearing([0, 0], [1, 0])).toBeCloseTo(90, 1);
  });
});

describe("pointsToFC", () => {
  it("builds Point features with index, default color/radius, and optional label", () => {
    const fc = pointsToFC(
      [
        { at: [4, 2], label: "A" },
        { at: [1, 1], color: "red", radius: 9 },
      ],
      id,
    );
    expect(fc.features).toHaveLength(2);
    const [a, b] = fc.features;
    expect(a?.geometry).toEqual({ type: "Point", coordinates: [4, 2] });
    expect(a?.properties).toMatchObject({
      _idx: 0,
      color: "var(--sf-color-primary)",
      radius: 5,
      label: "A",
    });
    expect(b?.properties).toMatchObject({ _idx: 1, color: "red", radius: 9 });
    expect(b?.properties).not.toHaveProperty("label");
  });
});

describe("areasToFC", () => {
  it("accepts a bare ring (sugar) and nests it; carries fill/stroke defaults", () => {
    const fc = areasToFC(
      [
        {
          polygon: [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        },
      ],
      id,
    );
    const f = fc.features[0];
    expect(f?.geometry).toEqual({
      type: "Polygon",
      coordinates: [
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0, 0],
        ],
      ],
    });
    expect(f?.properties).toMatchObject({ fillOpacity: 0.2, strokeWidth: 1.5 });
  });

  it("keeps already-nested rings intact", () => {
    const fc = areasToFC(
      [
        {
          polygon: [
            [
              [0, 0],
              [2, 0],
              [2, 2],
              [0, 0],
            ],
          ],
        },
      ],
      id,
    );
    expect((fc.features[0]?.geometry as { coordinates: unknown }).coordinates).toEqual([
      [
        [0, 0],
        [2, 0],
        [2, 2],
        [0, 0],
      ],
    ]);
  });
});

describe("vectorsToFC", () => {
  it("builds LineStrings with dashed defaulting to false", () => {
    const fc = vectorsToFC(
      [
        {
          path: [
            [0, 0],
            [1, 1],
          ],
        },
        {
          path: [
            [2, 2],
            [3, 3],
          ],
          dashed: true,
        },
      ],
      id,
    );
    expect(fc.features[0]?.properties).toMatchObject({ dashed: false, width: 2 });
    expect(fc.features[1]?.properties).toMatchObject({ dashed: true });
  });
});

describe("arrowsToFC", () => {
  it("emits one rotated point per arrow vector, at the final vertex", () => {
    const fc = arrowsToFC(
      [
        {
          path: [
            [0, 0],
            [0, 1],
          ],
          arrow: true,
        },
        {
          path: [
            [0, 0],
            [1, 1],
          ],
        }, // no arrow → skipped
        { path: [[0, 0]], arrow: true }, // too short → skipped
      ],
      id,
    );
    expect(fc.features).toHaveLength(1);
    const f = fc.features[0];
    expect(f?.geometry).toEqual({ type: "Point", coordinates: [0, 1] });
    // North-bound line → ➤ (points east) rotated 270° clockwise points north.
    expect(f?.properties?.rotate).toBeCloseTo(270, 1);
  });
});

describe("overlayBounds", () => {
  it("spans every overlay coordinate, or null when empty", () => {
    expect(overlayBounds({})).toBeNull();
    expect(
      overlayBounds({
        points: [{ at: [0, 0] }],
        vectors: [
          {
            path: [
              [1, 1],
              [2, 2],
            ],
          },
        ],
        areas: [
          {
            polygon: [
              [-1, -1],
              [0, 0],
              [0, -1],
              [-1, -1],
            ],
          },
        ],
      }),
    ).toEqual([
      [-1, -1],
      [2, 2],
    ]);
  });
});

describe("kindOfLayer", () => {
  it("maps layer ids back to feature kinds", () => {
    expect(kindOfLayer("sf-points-circle")).toBe("point");
    expect(kindOfLayer("sf-areas-fill")).toBe("area");
    expect(kindOfLayer("sf-vectors-line-dashed")).toBe("vector");
  });
});
