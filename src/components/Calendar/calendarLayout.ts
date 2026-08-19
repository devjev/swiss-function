/** Pure event-layout math for `Calendar`. No React, no DOM. Local-time Dates
 *  throughout (see `lib/date`). Two hard problems live here and are unit-tested
 *  directly:
 *   - `layoutDay`: overlapping TIMED events packed into side-by-side columns
 *     within a day (the week view's hour grid).
 *   - `layoutWeekRow`: events (single- or multi-day) packed into stacked lanes
 *     across a week's 7 day columns, as spanning bars (the month grid and the
 *     week view's all-day strip).
 */

import { addDays, isSameDay, startOfDay } from "../../lib/date";

/** Semantic fill for an event; maps to the shared tone tokens. Neutral is the
 *  resting default. Use a tone when the colour MEANS a status. */
export type CalendarEventTone = "neutral" | "primary" | "success" | "warning" | "danger";

/** One scheduled item. `end` omitted → a point/short event. `allDay` events are
 *  day-granular (their `end`, if given, is the INCLUSIVE last day). */
export interface CalendarEvent {
  id: string;
  start: Date;
  /** Exclusive end for timed events; inclusive last day for `allDay`. */
  end?: Date;
  allDay?: boolean;
  title: string;
  /** Semantic colour (a status). Default `"primary"`. */
  tone?: CalendarEventTone;
  /** Explicit CSS colour: the escape hatch for a consumer-owned category
   *  palette when a `tone` isn't enough. Wins over `tone`. */
  color?: string;
  /** Echoed back untouched in `onEventClick`, so the consumer can round-trip
   *  its own record. */
  data?: unknown;
}

export type CalendarView = "month" | "week" | "year";

/** Locale-aware weekday labels, Monday-first (ISO). `2024-01-01` is a Monday. */
export function weekdayLabels(format: "short" | "narrow" = "short"): string[] {
  const monday = new Date(2024, 0, 1);
  return Array.from({ length: 7 }, (_, i) =>
    addDays(monday, i).toLocaleDateString(undefined, { weekday: format }),
  );
}

/** Default length (minutes) of a timed event with no `end`, so it still has a
 *  visible block in the hour grid. */
const DEFAULT_EVENT_MINUTES = 30;
const DAY_MS = 86_400_000;
/** Smallest drawn block height, as a fraction of the day (~15 min), so a
 *  zero-length event stays grabbable. */
const MIN_BLOCK = 15 / (24 * 60);

/** Resolved end instant of a timed event (never mutates the event). */
export function timedEnd(event: CalendarEvent): Date {
  if (event.end) return event.end;
  return new Date(event.start.getTime() + DEFAULT_EVENT_MINUTES * 60_000);
}

/** Inclusive last calendar day an event touches (all-day and timed alike). */
export function lastDay(event: CalendarEvent): Date {
  if (event.allDay) return startOfDay(event.end ?? event.start);
  // A timed event ending exactly at midnight belongs to the previous day.
  const end = timedEnd(event);
  const endDay = startOfDay(end);
  return end.getTime() === endDay.getTime() && !isSameDay(end, event.start)
    ? addDays(endDay, -1)
    : endDay;
}

/** Whole days between two dates (b - a), by calendar day, DST-safe. */
export function dayDelta(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

/** Does the event touch `day` (any part of it)? */
export function eventOccursOnDay(event: CalendarEvent, day: Date): boolean {
  const d = startOfDay(day);
  if (event.allDay) {
    return (
      d.getTime() >= startOfDay(event.start).getTime() && d.getTime() <= lastDay(event).getTime()
    );
  }
  // Timed: the half-open interval [start, end) overlaps [d, d+1day).
  const next = addDays(d, 1).getTime();
  return event.start.getTime() < next && timedEnd(event).getTime() > d.getTime();
}

/** Events touching `day`, in stable start order. */
export function eventsOnDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events
    .filter((e) => eventOccursOnDay(e, day))
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** How many events touch `day`: the year-view density read. */
export function dayEventCount(events: CalendarEvent[], day: Date): number {
  let n = 0;
  for (const e of events) if (eventOccursOnDay(e, day)) n++;
  return n;
}

// --- Timed overlap columns (week-view hour grid) ---------------------------

/** A timed event placed in the day's hour grid. `top`/`height` are fractions of
 *  the day (0 = 00:00, 1 = 24:00); `column`/`columns` split the width across a
 *  connected overlap cluster so simultaneous events sit side by side. */
export interface TimedBlock {
  event: CalendarEvent;
  top: number;
  height: number;
  column: number;
  columns: number;
}

/** Lay out the day's TIMED events (all-day events are excluded; they belong in
 *  the all-day strip). Overlapping events form a cluster and share the width in
 *  equal columns (the familiar day/week-view read). Pure and O(n·k). */
export function layoutDay(events: CalendarEvent[], day: Date): TimedBlock[] {
  const dayStart = startOfDay(day).getTime();
  const items = events
    .filter((e) => !e.allDay && eventOccursOnDay(e, day))
    .map((e) => {
      const top = Math.max(0, (e.start.getTime() - dayStart) / DAY_MS);
      const bottom = Math.min(1, (timedEnd(e).getTime() - dayStart) / DAY_MS);
      return { event: e, top, bottom: Math.max(bottom, top + MIN_BLOCK) };
    })
    // Earlier first; longer first on a tie so wide blocks anchor low columns.
    .sort((a, b) => a.top - b.top || b.bottom - a.bottom);

  const out: TimedBlock[] = [];
  let cluster: { top: number; bottom: number; column: number; event: CalendarEvent }[] = [];
  let colEnds: number[] = [];
  let clusterBottom = 0;

  const flush = () => {
    const cols = cluster.reduce((m, c) => Math.max(m, c.column + 1), 1);
    for (const c of cluster) {
      out.push({
        event: c.event,
        top: c.top,
        height: Math.max(c.bottom - c.top, MIN_BLOCK),
        column: c.column,
        columns: cols,
      });
    }
    cluster = [];
    colEnds = [];
    clusterBottom = 0;
  };

  for (const it of items) {
    // A new item that starts after everything so far ends closes the cluster.
    if (cluster.length && it.top >= clusterBottom) flush();
    let col = colEnds.findIndex((end) => end <= it.top);
    if (col === -1) {
      col = colEnds.length;
      colEnds.push(it.bottom);
    } else {
      colEnds[col] = it.bottom;
    }
    cluster.push({ top: it.top, bottom: it.bottom, column: col, event: it.event });
    clusterBottom = Math.max(clusterBottom, it.bottom);
  }
  if (cluster.length) flush();
  return out;
}

// --- Multi-day lanes (month grid + all-day strip) --------------------------

/** An event drawn as a horizontal bar across a week row's day columns. `lane`
 *  is its vertical slot; `startCol`/`endCol` are inclusive 0-based day columns;
 *  the `continues*` flags mark a bar clipped at a week boundary (draw an arrow). */
export interface RowBar {
  event: CalendarEvent;
  lane: number;
  startCol: number;
  endCol: number;
  continuesBefore: boolean;
  continuesAfter: boolean;
}

/** Pack the events overlapping the `columns`-day row starting at `rowStart` into
 *  stacked lanes (no two bars in one lane overlap a column). Multi-day events
 *  span columns; a bar clipped by the row edge gets a `continues*` flag. Sorted
 *  so earlier/longer events take the top lanes, the stable calendar read. */
export function layoutWeekRow(events: CalendarEvent[], rowStart: Date, columns = 7): RowBar[] {
  const rowStartDay = startOfDay(rowStart);
  const rowEndDay = addDays(rowStartDay, columns - 1);

  const bars = events
    .filter(
      (e) =>
        startOfDay(e.start).getTime() <= rowEndDay.getTime() &&
        lastDay(e).getTime() >= rowStartDay.getTime(),
    )
    .map((e) => {
      const rawStart = dayDelta(rowStartDay, e.start);
      const rawEnd = dayDelta(rowStartDay, lastDay(e));
      return {
        event: e,
        startCol: Math.max(0, rawStart),
        endCol: Math.min(columns - 1, rawEnd),
        continuesBefore: rawStart < 0,
        continuesAfter: rawEnd > columns - 1,
      };
    })
    // Earlier start first; longer span first on a tie.
    .sort(
      (a, b) =>
        a.startCol - b.startCol ||
        b.endCol - b.startCol - (a.endCol - a.startCol) ||
        a.event.start.getTime() - b.event.start.getTime(),
    );

  const laneEnds: number[] = []; // last occupied column per lane
  const out: RowBar[] = [];
  for (const b of bars) {
    let lane = laneEnds.findIndex((end) => end < b.startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(b.endCol);
    } else {
      laneEnds[lane] = b.endCol;
    }
    out.push({ ...b, lane });
  }
  return out;
}
