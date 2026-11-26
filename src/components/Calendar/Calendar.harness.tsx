import { useState } from "react";
import { Calendar, type CalendarEvent, type CalendarProps } from "./Calendar";

/** A fixed anchor so the CT grid renders identically every run: Wed 2026-03-11. */
const FOCUS = new Date(2026, 2, 11);
const at = (d: number, h = 0, min = 0) => new Date(2026, 2, d, h, min);

export const HARNESS_EVENTS: CalendarEvent[] = [
  { id: "oncall", title: "On call", allDay: true, start: at(9), end: at(15), tone: "warning" },
  { id: "conf", title: "Design conference", allDay: true, start: at(10), end: at(12) },
  { id: "planning", title: "Planning", start: at(11, 10, 0), end: at(11, 11, 30) },
  { id: "sync", title: "Platform sync", start: at(11, 10, 30), end: at(11, 12, 0) },
  { id: "retro", title: "Sprint retro", start: at(13, 15, 0), end: at(13, 16, 0) },
];

/**
 * CT mount wrapper. Function props can't cross the Playwright CT boundary, so
 * the harness owns the callbacks and mirrors each firing into `data-*`
 * attributes on a probe element the spec reads. Uncontrolled by default so the
 * spec can drive navigation and view switching through the real UI.
 */
/** A 15-minute event, for the short-block layout (opt-in, so the other
 *  specs' counts stay as they are). */
const STANDUP: CalendarEvent = {
  id: "standup",
  title: "Standup",
  start: at(11, 9, 0),
  end: at(11, 9, 15),
};

/** Six more events on Wed 11, so the month grid has a "+N more" key. */
const BUSY_DAY: CalendarEvent[] = Array.from({ length: 6 }, (_, i) => ({
  id: `busy-${i}`,
  title: `Review ${i + 1}`,
  start: at(11, 13 + i, 0),
  end: at(11, 13 + i, 30),
}));

export function CalendarHarness({
  events: given = HARNESS_EVENTS,
  shortEvent = false,
  busyDay = false,
  width = 960,
  ...props
}: Partial<CalendarProps> & {
  shortEvent?: boolean;
  busyDay?: boolean;
  /** The frame's width in px: the calendar reads it, not the viewport. */
  width?: number;
}) {
  const events = [...given, ...(shortEvent ? [STANDUP] : []), ...(busyDay ? BUSY_DAY : [])];
  const [lastEvent, setLastEvent] = useState("");
  const [lastDate, setLastDate] = useState("");
  const [lastView, setLastView] = useState("");
  const [lastNav, setLastNav] = useState("");
  const [clicks, setClicks] = useState(0);

  return (
    <div style={{ height: 620, width }}>
      <Calendar
        events={events}
        defaultValue={FOCUS}
        onEventClick={(e) => {
          setLastEvent(e.id);
          setClicks((n) => n + 1);
        }}
        onDateClick={(d) =>
          setLastDate(
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
              d.getDate(),
            ).padStart(2, "0")}T${String(d.getHours()).padStart(2, "0")}`,
          )
        }
        onViewChange={(v) => setLastView(v)}
        onNavigate={(d) => setLastNav(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`)}
        {...props}
      />
      <div
        data-testid="mirror"
        data-last-event={lastEvent}
        data-last-date={lastDate}
        data-last-view={lastView}
        data-last-nav={lastNav}
        data-clicks={clicks}
      />
    </div>
  );
}
