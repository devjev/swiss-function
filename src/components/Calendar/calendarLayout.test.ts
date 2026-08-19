import { describe, expect, it } from "vitest";
import {
  type CalendarEvent,
  dayEventCount,
  eventOccursOnDay,
  lastDay,
  layoutDay,
  layoutWeekRow,
  timedEnd,
} from "./calendarLayout";

/** A timed event on 2026-03-10 from `h1:00` to `h2:00`. */
function timed(id: string, h1: number, h2: number): CalendarEvent {
  return {
    id,
    title: id,
    start: new Date(2026, 2, 10, h1, 0),
    end: new Date(2026, 2, 10, h2, 0),
  };
}
function allDay(id: string, d1: number, d2?: number): CalendarEvent {
  return {
    id,
    title: id,
    allDay: true,
    start: new Date(2026, 2, d1),
    end: d2 != null ? new Date(2026, 2, d2) : undefined,
  };
}

/** Find a laid-out entry by event id (throws if missing, so no undefined). */
function pick<T extends { event: CalendarEvent }>(out: T[], id: string): T {
  const found = out.find((b) => b.event.id === id);
  if (!found) throw new Error(`no entry for ${id}`);
  return found;
}

describe("timedEnd / lastDay", () => {
  it("defaults a no-end timed event to +30min", () => {
    const e: CalendarEvent = { id: "e", title: "e", start: new Date(2026, 2, 10, 9, 0) };
    expect(timedEnd(e).getTime()).toBe(new Date(2026, 2, 10, 9, 30).getTime());
  });

  it("lastDay of an all-day range is the inclusive end day", () => {
    expect(lastDay(allDay("e", 10, 12))).toEqual(new Date(2026, 2, 12));
    expect(lastDay(allDay("e", 10))).toEqual(new Date(2026, 2, 10));
  });

  it("a timed event ending at midnight belongs to the previous day", () => {
    const e: CalendarEvent = {
      id: "e",
      title: "e",
      start: new Date(2026, 2, 10, 22, 0),
      end: new Date(2026, 2, 11, 0, 0),
    };
    expect(lastDay(e)).toEqual(new Date(2026, 2, 10));
  });
});

describe("eventOccursOnDay / dayEventCount", () => {
  it("all-day range covers each day inclusively", () => {
    const e = allDay("e", 10, 12);
    expect(eventOccursOnDay(e, new Date(2026, 2, 9))).toBe(false);
    expect(eventOccursOnDay(e, new Date(2026, 2, 10))).toBe(true);
    expect(eventOccursOnDay(e, new Date(2026, 2, 12))).toBe(true);
    expect(eventOccursOnDay(e, new Date(2026, 2, 13))).toBe(false);
  });

  it("timed event occurs only on days its interval touches", () => {
    const e = timed("e", 9, 10);
    expect(eventOccursOnDay(e, new Date(2026, 2, 10))).toBe(true);
    expect(eventOccursOnDay(e, new Date(2026, 2, 11))).toBe(false);
  });

  it("counts events on a day", () => {
    const evs = [timed("a", 9, 10), timed("b", 9, 11), allDay("c", 10)];
    expect(dayEventCount(evs, new Date(2026, 2, 10))).toBe(3);
    expect(dayEventCount(evs, new Date(2026, 2, 11))).toBe(0);
  });
});

describe("layoutDay: overlap columns", () => {
  const day = new Date(2026, 2, 10);

  it("disjoint events all take column 0 of a single-column layout", () => {
    const out = layoutDay([timed("a", 9, 10), timed("b", 11, 12)], day);
    expect(out.map((b) => [b.column, b.columns])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it("two overlapping events split into two columns", () => {
    const out = layoutDay([timed("a", 9, 11), timed("b", 10, 12)], day);
    expect(pick(out, "a").column).toBe(0);
    expect(pick(out, "b").column).toBe(1);
    expect(pick(out, "a").columns).toBe(2);
    expect(pick(out, "b").columns).toBe(2);
  });

  it("a third event overlapping both widens the cluster to 3 columns", () => {
    const out = layoutDay([timed("a", 9, 12), timed("b", 10, 12), timed("c", 11, 12)], day);
    expect(new Set(out.map((b) => b.columns))).toEqual(new Set([3]));
    expect(new Set(out.map((b) => b.column))).toEqual(new Set([0, 1, 2]));
  });

  it("reuses a freed column after an event ends (chained, not all-overlapping)", () => {
    // a: 9-10 and b: 9-11 overlap (different columns); c: 10-11 overlaps b but
    // starts exactly as a ends, so it reuses a's freed column.
    const out = layoutDay([timed("a", 9, 10), timed("b", 9, 11), timed("c", 10, 11)], day);
    expect(pick(out, "a").column).not.toBe(pick(out, "b").column);
    expect(pick(out, "c").column).toBe(pick(out, "a").column);
    // All three are one connected cluster → 2 columns wide.
    expect(new Set(out.map((b) => b.columns))).toEqual(new Set([2]));
  });

  it("top/height are day fractions and exclude all-day events", () => {
    const out = layoutDay([timed("a", 6, 12), allDay("x", 10)], day);
    expect(out).toHaveLength(1);
    expect(out[0]?.top).toBeCloseTo(0.25);
    expect(out[0]?.height).toBeCloseTo(0.25);
  });

  it("clips an event that starts the previous night to the day top", () => {
    const e: CalendarEvent = {
      id: "e",
      title: "e",
      start: new Date(2026, 2, 9, 22, 0),
      end: new Date(2026, 2, 10, 2, 0),
    };
    const out = layoutDay([e], day);
    expect(out[0]?.top).toBe(0);
    expect(out[0]?.height).toBeCloseTo(2 / 24);
  });
});

describe("layoutWeekRow: multi-day lanes", () => {
  // Row = Mon 2026-03-09 .. Sun 2026-03-15 (7 columns).
  const rowStart = new Date(2026, 2, 9);

  it("places a single-day event in one column, lane 0", () => {
    const out = layoutWeekRow([allDay("a", 11)], rowStart);
    expect(out).toEqual([
      {
        event: expect.objectContaining({ id: "a" }),
        lane: 0,
        startCol: 2,
        endCol: 2,
        continuesBefore: false,
        continuesAfter: false,
      },
    ]);
  });

  it("spans a multi-day event across columns", () => {
    const out = layoutWeekRow([allDay("a", 10, 13)], rowStart);
    expect(out[0]).toMatchObject({
      startCol: 1,
      endCol: 4,
      continuesBefore: false,
      continuesAfter: false,
    });
  });

  it("clips an event that starts before / ends after the row and flags it", () => {
    const out = layoutWeekRow([allDay("a", 7, 17)], rowStart);
    expect(out[0]).toMatchObject({
      startCol: 0,
      endCol: 6,
      continuesBefore: true,
      continuesAfter: true,
    });
  });

  it("stacks overlapping bars into separate lanes, disjoint bars share a lane", () => {
    const out = layoutWeekRow(
      [allDay("a", 9, 11), allDay("b", 10, 12), allDay("c", 13, 14)],
      rowStart,
    );
    expect(pick(out, "a").lane).toBe(0);
    expect(pick(out, "b").lane).toBe(1); // overlaps a
    expect(pick(out, "c").lane).toBe(0); // disjoint from a → reuses lane 0
  });

  it("gives earlier/longer events the top lanes", () => {
    const out = layoutWeekRow([allDay("short", 12), allDay("long", 9, 15)], rowStart);
    expect(pick(out, "long").lane).toBe(0);
    expect(pick(out, "short").lane).toBe(1);
  });
});
