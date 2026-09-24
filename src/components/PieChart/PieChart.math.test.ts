import { describe, expect, it } from "vitest";
import {
  arcPath,
  pieRadius,
  placeSliceLabels,
  polar,
  preparePie,
  ringTicks,
  sliceAngles,
  sliceCentroid,
} from "./PieChart.math";

const DATA = [
  { name: "Equity", value: 50 },
  { name: "Bonds", value: 30 },
  { name: "Cash", value: 20 },
];

const measure = (t: string) => t.length * 7;
const ellipsize = (text: string, maxPx: number, m: (t: string) => number) => {
  if (m(text) <= maxPx) return text;
  for (let i = text.length - 1; i > 0; i--) {
    const candidate = `${text.slice(0, i)}…`;
    if (m(candidate) <= maxPx) return candidate;
  }
  return "";
};

describe("preparePie", () => {
  it("orders by value and gives each part its share", () => {
    const { slices, total } = preparePie([
      { name: "Cash", value: 20 },
      { name: "Equity", value: 50 },
      { name: "Bonds", value: 30 },
    ]);
    expect(total).toBe(100);
    expect(slices.map((s) => s.name)).toEqual(["Equity", "Bonds", "Cash"]);
    expect(slices.map((s) => s.share)).toEqual([0.5, 0.3, 0.2]);
    expect(slices.map((s) => s.index)).toEqual([0, 1, 2]);
  });

  it("keeps the supplied order under sort none, ties included", () => {
    const { slices } = preparePie(
      [
        { name: "A", value: 10 },
        { name: "B", value: 40 },
        { name: "C", value: 10 },
      ],
      { sort: "none" },
    );
    expect(slices.map((s) => s.name)).toEqual(["A", "B", "C"]);
  });

  it("breaks value ties on the supplied order", () => {
    const { slices } = preparePie([
      { name: "A", value: 10 },
      { name: "B", value: 10 },
    ]);
    expect(slices.map((s) => s.name)).toEqual(["A", "B"]);
  });

  it("drops parts that carry no share of a whole", () => {
    const { slices, total } = preparePie([
      { name: "A", value: 10 },
      { name: "Zero", value: 0 },
      { name: "Negative", value: -5 },
      { name: "Broken", value: Number.NaN },
    ]);
    expect(slices.map((s) => s.name)).toEqual(["A"]);
    expect(total).toBe(10);
  });

  it("returns nothing when no part is positive", () => {
    expect(preparePie([{ name: "A", value: 0 }])).toEqual({ slices: [], total: 0 });
    expect(preparePie([])).toEqual({ slices: [], total: 0 });
  });

  it("groups the tail into one part that reports what it stands for", () => {
    const { slices } = preparePie(
      [
        { name: "A", value: 50 },
        { name: "B", value: 30 },
        { name: "C", value: 10 },
        { name: "D", value: 6 },
        { name: "E", value: 4 },
      ],
      { maxSlices: 3 },
    );
    expect(slices.map((s) => s.name)).toEqual(["A", "B", "Other"]);
    const other = slices[2];
    expect(other?.value).toBe(20);
    expect(other?.share).toBeCloseTo(0.2);
    expect(other?.aggregated).toBe(true);
    expect(other?.count).toBe(3);
  });

  it("leaves the parts alone when they already fit under the cap", () => {
    const { slices } = preparePie(DATA, { maxSlices: 3 });
    expect(slices.map((s) => s.name)).toEqual(["Equity", "Bonds", "Cash"]);
    expect(slices.every((s) => !s.aggregated)).toBe(true);
  });

  it("names the grouped part as asked", () => {
    const { slices } = preparePie(DATA, { maxSlices: 2, otherLabel: "Rest" });
    expect(slices[1]?.name).toBe("Rest");
    expect(slices[1]?.count).toBe(2);
  });

  it("keeps the shares summing to one after grouping", () => {
    const { slices } = preparePie(DATA, { maxSlices: 2 });
    const sum = slices.reduce((t, s) => t + s.share, 0);
    expect(sum).toBeCloseTo(1);
  });
});

describe("sliceAngles", () => {
  it("runs clockwise from 12 o'clock and closes the circle", () => {
    const angles = sliceAngles([{ share: 0.5 }, { share: 0.25 }, { share: 0.25 }]);
    expect(angles[0]?.start).toBe(0);
    expect(angles[0]?.end).toBeCloseTo(Math.PI);
    expect(angles[1]?.start).toBeCloseTo(Math.PI);
    expect(angles[2]?.end).toBeCloseTo(Math.PI * 2);
  });

  it("closes the last slice on the first, whatever the shares round to", () => {
    const thirds = [{ share: 1 / 3 }, { share: 1 / 3 }, { share: 1 / 3 }];
    const angles = sliceAngles(thirds, 30);
    const start = (30 * Math.PI) / 180;
    expect(angles[0]?.start).toBeCloseTo(start);
    expect(angles[2]?.end).toBeCloseTo(start + Math.PI * 2);
  });

  it("puts a slice's mid-angle halfway across it", () => {
    const [first] = sliceAngles([{ share: 1 }]);
    expect(first?.mid).toBeCloseTo(Math.PI);
  });
});

describe("polar / sliceCentroid", () => {
  it("maps 12, 3, 6 and 9 o'clock to the screen", () => {
    expect(polar(100, 100, 50, 0)).toEqual({ x: 100, y: 50 });
    const right = polar(100, 100, 50, Math.PI / 2);
    expect(right.x).toBeCloseTo(150);
    expect(right.y).toBeCloseTo(100);
    const bottom = polar(100, 100, 50, Math.PI);
    expect(bottom.y).toBeCloseTo(150);
    const left = polar(100, 100, 50, (3 * Math.PI) / 2);
    expect(left.x).toBeCloseTo(50);
  });

  it("anchors a wedge halfway out and a ring in the band of ink", () => {
    expect(sliceCentroid(0, 0, 100, 0, 0).y).toBeCloseTo(-50);
    expect(sliceCentroid(0, 0, 100, 60, 0).y).toBeCloseTo(-80);
  });
});

describe("arcPath", () => {
  it("draws a wedge from the centre", () => {
    const d = arcPath(100, 100, 50, 0, 0, Math.PI / 2);
    expect(d.startsWith("M 100 100 L 100 50")).toBe(true);
    expect(d).toContain("A 50 50 0 0 1 150 100");
    expect(d.endsWith("Z")).toBe(true);
  });

  it("sets the large-arc flag past a half turn", () => {
    expect(arcPath(0, 0, 10, 0, 0, Math.PI * 0.9)).toContain("0 0 1");
    expect(arcPath(0, 0, 10, 0, 0, Math.PI * 1.5)).toContain("0 1 1");
  });

  it("draws a ring segment as two arcs wound opposite ways", () => {
    const d = arcPath(100, 100, 50, 30, 0, Math.PI / 2);
    expect(d).toContain("A 50 50 0 0 1");
    expect(d).toContain("A 30 30 0 0 0");
    expect(d.startsWith("M 100 50")).toBe(true);
  });

  it("draws a whole turn as a pair of half arcs, not a degenerate one", () => {
    const d = arcPath(100, 100, 50, 0, 0, Math.PI * 2);
    expect(d.match(/A /g)).toHaveLength(2);
    expect(d).toContain("150");
  });

  it("leaves the hole open on a whole-turn ring", () => {
    const d = arcPath(100, 100, 50, 25, 0, Math.PI * 2);
    expect(d.match(/A /g)).toHaveLength(4);
    // The inner circle winds the other way, so the non-zero rule cuts it out.
    expect(d).toContain("A 25 25 0 1 0");
  });

  it("clamps an inner radius past the outer one, and draws nothing with no room", () => {
    expect(arcPath(0, 0, 10, 40, 0, 1)).toContain("A 10 10");
    expect(arcPath(0, 0, 0, 0, 0, 1)).toBe("");
  });
});

describe("pieRadius", () => {
  it("fits the smaller of the two reserved axes", () => {
    expect(pieRadius(400, 300, 0, 0)).toBe(150);
    expect(pieRadius(400, 300, 100, 0)).toBe(100);
    expect(pieRadius(400, 300, 0, 50)).toBe(100);
  });

  it("never goes negative when the labels want more than there is", () => {
    expect(pieRadius(100, 100, 200, 0)).toBe(0);
  });
});

describe("placeSliceLabels", () => {
  const base = {
    cx: 200,
    cy: 150,
    radius: 100,
    width: 400,
    height: 300,
    leaderPx: 6,
    gapPx: 4,
    lineHeight: 16,
    measureName: measure,
    measureValue: measure,
    ellipsize,
  };

  it("anchors right-hand labels at their start and left-hand ones at their end", () => {
    const { slices } = preparePie(DATA);
    const placed = placeSliceLabels(slices, sliceAngles(slices), base);
    expect(placed).toHaveLength(3);
    // Equity spans 12 to 6 o'clock, so its mid-angle points right.
    expect(placed[0]?.anchor).toBe("start");
    expect(placed[0]?.x).toBeGreaterThan(base.cx);
    // Cash ends the circle on the left.
    expect(placed[2]?.anchor).toBe("end");
    expect(placed[2]?.x).toBeLessThan(base.cx);
  });

  it("returns the labels in slice order whatever order it placed them in", () => {
    const { slices } = preparePie([
      { name: "Small", value: 5 },
      { name: "Big", value: 95 },
    ]);
    const placed = placeSliceLabels(slices, sliceAngles(slices), base);
    expect(placed.map((p) => p.index)).toEqual([...placed.map((p) => p.index)].sort());
  });

  it("runs the leader from the arc out to the text", () => {
    const { slices } = preparePie([{ name: "All", value: 1 }]);
    const [placed] = placeSliceLabels(slices, sliceAngles(slices), base);
    if (!placed) throw new Error("expected a label");
    const arcToCentre = Math.hypot(placed.leader.x1 - base.cx, placed.leader.y1 - base.cy);
    const tipToCentre = Math.hypot(placed.leader.x2 - base.cx, placed.leader.y2 - base.cy);
    expect(arcToCentre).toBeCloseTo(base.radius);
    expect(tipToCentre).toBeCloseTo(base.radius + base.leaderPx);
  });

  it("drops the smaller slice's label when two would collide", () => {
    // Four slivers in a row all point at nearly the same angle, so only the
    // first can have its line.
    const { slices } = preparePie(
      [
        { name: "Big", value: 96 },
        { name: "Sliver A", value: 2 },
        { name: "Sliver B", value: 1 },
        { name: "Sliver C", value: 1 },
      ],
      { sort: "none" },
    );
    const placed = placeSliceLabels(slices, sliceAngles(slices), base);
    const names = placed.map((p) => p.name);
    expect(names).toContain("Big");
    expect(names).toContain("Sliver A");
    expect(names).not.toContain("Sliver C");
  });

  it("ellipsizes a name to its room and keeps the full text for a title", () => {
    const { slices } = preparePie([{ name: "A very long holding name indeed", value: 1 }]);
    const placed = placeSliceLabels(slices, sliceAngles(slices), { ...base, width: 260 });
    expect(placed[0]?.name.endsWith("…")).toBe(true);
    expect(placed[0]?.title).toBe("A very long holding name indeed");
  });

  it("gives a name no title when it was printed whole", () => {
    const { slices } = preparePie([{ name: "Cash", value: 1 }]);
    const [placed] = placeSliceLabels(slices, sliceAngles(slices), base);
    expect(placed?.title).toBeUndefined();
  });

  it("takes the printed figure's width out of the name's room", () => {
    const { slices } = preparePie([{ name: "Equity", value: 1 }]);
    const withValue = placeSliceLabels(slices, sliceAngles(slices), {
      ...base,
      width: 260,
      values: ["100%"],
    });
    expect(withValue[0]?.value).toBe("100%");
    expect(withValue[0]?.name.length).toBeLessThan("Equity".length + 1);
  });

  it("drops a label with no room at all rather than mangling it", () => {
    const { slices } = preparePie([{ name: "Equity", value: 1 }]);
    expect(placeSliceLabels(slices, sliceAngles(slices), { ...base, width: 212 })).toEqual([]);
  });

  it("drops a label whose line would fall outside the plot", () => {
    const { slices } = preparePie([{ name: "All", value: 1 }]);
    // Started at 6 o'clock, the one slice's mid-angle points straight up, so
    // its label sits above a centre that is itself near the top edge.
    const angles = sliceAngles(slices, 180);
    expect(placeSliceLabels(slices, angles, { ...base, cy: 50 })).toEqual([]);
    expect(placeSliceLabels(slices, angles, { ...base, cy: 150 })).toHaveLength(1);
  });

  it("places nothing in an empty box", () => {
    const { slices } = preparePie(DATA);
    expect(placeSliceLabels(slices, sliceAngles(slices), { ...base, width: 0 })).toEqual([]);
    expect(placeSliceLabels(slices, sliceAngles(slices), { ...base, radius: 0 })).toEqual([]);
  });
});

describe("ringTicks", () => {
  it("ticks every step and marks the quarters", () => {
    const ticks = ringTicks(0, 5);
    expect(ticks).toHaveLength(20);
    expect(ticks.filter((t) => t.major)).toHaveLength(4);
    expect(ticks[0]?.angle).toBe(0);
    expect(ticks[5]?.angle).toBeCloseTo(Math.PI / 2);
  });

  it("measures the shares from the pie's own start angle", () => {
    const ticks = ringTicks(90, 25);
    expect(ticks[0]?.angle).toBeCloseTo(Math.PI / 2);
    expect(ticks.every((t) => t.major)).toBe(true);
  });
});
