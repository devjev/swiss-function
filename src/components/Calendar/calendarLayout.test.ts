import { describe, expect, it } from "vitest";
import {
  type CalendarEvent,
  dayEventCount,
  eventOccursOnDay,
  fitWeekDays,
  GUTTER_UNITS,
  HOUR_UNITS,
  lastDay,
  layoutDay,
  layoutWeekRow,
  SHORT_WEEK_COLUMN_UNITS,
  stepWeekWindow,
  timedEnd,
  WEEK_COLUMN_UNITS,
  weekWindow,
  weekWindowStart,
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

describe("layoutDay: short events", () => {
  const day = new Date(2026, 2, 10);
  const at = (id: string, h: number, m1: number, m2: number): CalendarEvent => ({
    id,
    title: id,
    start: new Date(2026, 2, 10, h, m1),
    end: new Date(2026, 2, 10, h, m2),
  });
  // One unit, the height of a line of text, as a fraction of the day.
  const oneLine = 1 / (24 * HOUR_UNITS);

  it("draws a 15-minute event one line tall", () => {
    const [block] = layoutDay([at("s", 9, 0, 15)], day);
    expect(block?.height).toBeCloseTo(oneLine);
  });

  it("sets two short events in a row side by side, so neither covers the other", () => {
    const out = layoutDay([at("a", 9, 0, 15), at("b", 9, 15, 30)], day);
    expect(pick(out, "a").column).not.toBe(pick(out, "b").column);
    expect(new Set(out.map((b) => b.columns))).toEqual(new Set([2]));
  });

  it("keeps an event longer than a line at its own height", () => {
    const [block] = layoutDay([at("h", 9, 0, 59)], day);
    expect(block?.height).toBeCloseTo(59 / (24 * 60));
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

describe("fitWeekDays: day columns for a width", () => {
  const seven = GUTTER_UNITS + 7 * WEEK_COLUMN_UNITS;
  const three = GUTTER_UNITS + 3 * SHORT_WEEK_COLUMN_UNITS;

  it("shows the week when every column keeps its floor", () => {
    expect(fitWeekDays(seven)).toBe(7);
    expect(fitWeekDays(64)).toBe(7);
  });

  it("drops to three days just under that, and to one under the three-day floor", () => {
    expect(fitWeekDays(seven - 0.01)).toBe(3);
    expect(fitWeekDays(three)).toBe(3);
    expect(fitWeekDays(three - 0.01)).toBe(1);
    expect(fitWeekDays(0)).toBe(1);
  });

  it("follows the density: the same pixels are fewer units at the larger unit", () => {
    // A 1280px desktop frame at the compact 20px unit, and a tablet upright
    // (768px) and three phones at the touch density's 24px unit.
    expect(fitWeekDays(1280 / 20)).toBe(7);
    expect(fitWeekDays(768 / 24)).toBe(3);
    expect(fitWeekDays(390 / 24)).toBe(3);
    expect(fitWeekDays(360 / 24)).toBe(3);
    expect(fitWeekDays(320 / 24)).toBe(1);
  });
});

describe("weekWindow: the days on screen", () => {
  // Wednesday 2026-03-11, in the ISO week Mon 9 .. Sun 15.
  const focused = new Date(2026, 2, 11, 15, 30);
  const dates = (days: Date[]) => days.map((d) => d.getDate());

  it("seven days are the ISO week that holds the focused date", () => {
    expect(weekWindowStart(focused, 7)).toEqual(new Date(2026, 2, 9));
    expect(dates(weekWindow(focused, 7))).toEqual([9, 10, 11, 12, 13, 14, 15]);
  });

  it("three days and one day start at the focused date, at midnight", () => {
    expect(weekWindowStart(focused, 3)).toEqual(new Date(2026, 2, 11));
    expect(dates(weekWindow(focused, 3))).toEqual([11, 12, 13]);
    expect(weekWindow(focused, 1)).toEqual([new Date(2026, 2, 11)]);
  });

  it("runs across a month end", () => {
    expect(dates(weekWindow(new Date(2026, 2, 30), 3))).toEqual([30, 31, 1]);
  });

  it("steps by the days on screen, so windows meet without a gap or a repeat", () => {
    for (const days of [7, 3, 1] as const) {
      const next = stepWeekWindow(focused, days, 1);
      const here = weekWindow(focused, days);
      const there = weekWindow(next, days);
      const last = here[here.length - 1] as Date;
      expect(there[0]).toEqual(new Date(2026, 2, last.getDate() + 1));
      // And back again.
      expect(weekWindow(stepWeekWindow(next, days, -1), days)).toEqual(here);
    }
  });

  it("a step keeps the time of day of the focused date", () => {
    expect(stepWeekWindow(focused, 3, 1)).toEqual(new Date(2026, 2, 14, 15, 30));
    expect(stepWeekWindow(focused, 1, -1)).toEqual(new Date(2026, 2, 10, 15, 30));
  });
});

describe("a sliced week: the strip and the hour grid over three days or one", () => {
  // Wed 11 .. Fri 13.
  const start = new Date(2026, 2, 11);

  it("clips a week-long bar to the three columns and flags both ends", () => {
    const out = layoutWeekRow([allDay("oncall", 9, 15)], start, 3);
    expect(out[0]).toMatchObject({
      startCol: 0,
      endCol: 2,
      continuesBefore: true,
      continuesAfter: true,
    });
  });

  it("flags only the clipped end, and leaves out events outside the window", () => {
    const out = layoutWeekRow(
      [allDay("conf", 10, 12), allDay("ship", 13), allDay("past", 9, 10), allDay("later", 14)],
      start,
      3,
    );
    expect(out.map((b) => b.event.id).sort()).toEqual(["conf", "ship"]);
    expect(pick(out, "conf")).toMatchObject({
      startCol: 0,
      endCol: 1,
      continuesBefore: true,
      continuesAfter: false,
    });
    expect(pick(out, "ship")).toMatchObject({
      startCol: 2,
      endCol: 2,
      continuesBefore: false,
      continuesAfter: false,
    });
    // Disjoint in the window: they share the top lane.
    expect(pick(out, "conf").lane).toBe(0);
    expect(pick(out, "ship").lane).toBe(0);
  });

  it("one day: every bar is one column, in a lane of its own", () => {
    const out = layoutWeekRow([allDay("oncall", 9, 15), allDay("conf", 10, 12)], start, 1);
    expect(out.map((b) => [b.startCol, b.endCol])).toEqual([
      [0, 0],
      [0, 0],
    ]);
    expect(new Set(out.map((b) => b.lane))).toEqual(new Set([0, 1]));
    expect(out.every((b) => b.continuesBefore && b.continuesAfter)).toBe(true);
  });

  it("the hour grid of each day in the window keeps its overlap columns", () => {
    const on = (id: string, d: number, h1: number, m1: number, h2: number, m2: number) => ({
      id,
      title: id,
      start: new Date(2026, 2, d, h1, m1),
      end: new Date(2026, 2, d, h2, m2),
    });
    const events: CalendarEvent[] = [
      on("planning", 11, 10, 0, 11, 30),
      on("sync", 11, 10, 30, 12, 0),
      on("interview", 12, 11, 0, 12, 0),
      on("monday", 9, 9, 0, 10, 0),
    ];
    const [wed, thu, fri] = weekWindow(start, 3).map((day) => layoutDay(events, day));
    expect(wed?.map((b) => [b.event.id, b.column, b.columns])).toEqual([
      ["planning", 0, 2],
      ["sync", 1, 2],
    ]);
    expect(thu?.map((b) => [b.event.id, b.column, b.columns])).toEqual([["interview", 0, 1]]);
    expect(fri).toEqual([]);
  });
});
