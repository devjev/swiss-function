import { describe, expect, it } from "vitest";
import { type LabelRequest, labelBox, placeAnnotationLabels } from "./annotationLabels";

const measure = (text: string) => text.length * 8;

describe("labelBox", () => {
  it("places the box by the text anchor", () => {
    expect(labelBox({ x: 100, y: 50, anchor: "start" }, 40, 10).left).toBe(100);
    expect(labelBox({ x: 100, y: 50, anchor: "middle" }, 40, 10).left).toBe(80);
    expect(labelBox({ x: 100, y: 50, anchor: "end" }, 40, 10).left).toBe(60);
  });
});

describe("placeAnnotationLabels", () => {
  const above = { x: 4, y: 96, anchor: "start" } as const;
  const below = { x: 4, y: 114, anchor: "start" } as const;

  it("keeps the preferred spot when nothing is in the way", () => {
    const requests: LabelRequest[] = [{ text: "Entry", spots: [above, below] }];
    expect(placeAnnotationLabels(requests, measure, 12)).toEqual([above]);
  });

  it("moves a later label to its other side when it would overlap an earlier one", () => {
    const requests: LabelRequest[] = [
      { text: "Entry", spots: [above, below] },
      {
        text: "Target",
        spots: [
          { x: 10, y: 98, anchor: "start" },
          { x: 10, y: 130, anchor: "start" },
        ],
      },
    ];
    const out = placeAnnotationLabels(requests, measure, 12);
    expect(out[0]).toEqual(above);
    expect(out[1]?.y).toBe(130);
  });

  it("keeps the preferred spot when every spot overlaps", () => {
    const requests: LabelRequest[] = [
      { text: "Entry", spots: [above] },
      { text: "Stop", spots: [below] },
      { text: "Mid", spots: [above, below] },
    ];
    expect(placeAnnotationLabels(requests, measure, 12)[2]).toEqual(above);
  });

  it("passes over annotations without a label and keeps the indices", () => {
    const out = placeAnnotationLabels([null, { text: "A", spots: [above] }], measure, 12);
    expect(out).toEqual([null, above]);
  });

  it("depends on the order of the array alone", () => {
    const a: LabelRequest = { text: "Entry", spots: [above, below] };
    const b: LabelRequest = { text: "Exit", spots: [above, below] };
    expect(placeAnnotationLabels([a, b], measure, 12)).toEqual([above, below]);
    expect(placeAnnotationLabels([a, b], measure, 12)).toEqual(
      placeAnnotationLabels([a, b], measure, 12),
    );
  });
});
