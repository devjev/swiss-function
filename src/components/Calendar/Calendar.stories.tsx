import type { Story } from "@ladle/react";
import { useState } from "react";
import { Calendar, type CalendarEvent, type CalendarView } from "./Calendar";

// A fixed anchor so the stories render identically every run: Wednesday
// 2026-03-11, in the ISO week Mon 2026-03-09 .. Sun 2026-03-15. `NOW` fixes the
// reference clock (via the `now` prop) so the today marker and week now-line are
// deterministic, which is what makes these stories safe for the VRT gate.
const FOCUS = new Date(2026, 2, 11);
const NOW = new Date(2026, 2, 11, 10, 30);
const at = (d: number, h = 0, min = 0) => new Date(2026, 2, d, h, min);

const EVENTS: CalendarEvent[] = [
  // A week-long duty (spans the whole row) and a 3-day conference.
  { id: "oncall", title: "On call", allDay: true, start: at(9), end: at(15), tone: "warning" },
  { id: "conf", title: "Design conference", allDay: true, start: at(10), end: at(12) },
  { id: "deadline", title: "Ship v3", allDay: true, start: at(13), tone: "danger" },

  // Monday.
  { id: "standup-9", title: "Standup", start: at(9, 9, 0), end: at(9, 9, 15) },
  { id: "review", title: "Design review", start: at(9, 14, 0), end: at(9, 15, 30) },

  // Wednesday: two overlapping meetings to show side-by-side columns.
  { id: "standup-11", title: "Standup", start: at(11, 9, 0), end: at(11, 9, 15) },
  { id: "planning", title: "Planning", start: at(11, 10, 0), end: at(11, 11, 30) },
  { id: "sync", title: "Platform sync", start: at(11, 10, 30), end: at(11, 12, 0) },
  { id: "lunch", title: "Lunch", start: at(11, 12, 30), end: at(11, 13, 30) },
  {
    id: "1on1",
    title: "1:1 with Ana",
    start: at(11, 15, 0),
    end: at(11, 15, 30),
    color: "#7c3aed",
  },

  // Thursday.
  {
    id: "release",
    title: "Release window",
    start: at(12, 16, 0),
    end: at(12, 17, 0),
    tone: "success",
  },
  {
    id: "interview",
    title: "Interview",
    start: at(12, 11, 0),
    end: at(12, 12, 0),
    color: "#0891b2",
  },

  // Friday.
  { id: "retro", title: "Sprint retro", start: at(13, 15, 0), end: at(13, 16, 0) },
];

const wrap = (children: React.ReactNode) => (
  <div style={{ height: 640, maxWidth: 1000 }}>{children}</div>
);

export default { title: "Calendar" };

export const Playground: Story<{
  defaultView: CalendarView;
  showWeekNumbers: boolean;
}> = ({ defaultView, showWeekNumbers }) => {
  const [last, setLast] = useState("(click a day, hour slot, or event)");
  return (
    <div style={{ height: 640, maxWidth: 1000 }}>
      <Calendar
        events={EVENTS}
        defaultValue={FOCUS}
        now={NOW}
        defaultView={defaultView}
        showWeekNumbers={showWeekNumbers}
        onEventClick={(e) => setLast(`event: ${e.title}`)}
        onDateClick={(d) => setLast(`date: ${d.toLocaleString()}`)}
        onViewChange={(v) => setLast(`view: ${v}`)}
      />
      <p
        style={{
          marginTop: "var(--sf-unit)",
          fontFamily: "var(--sf-font-mono)",
          fontSize: "var(--sf-font-size-sm)",
          color: "var(--sf-color-fg-subtle)",
        }}
      >
        {last}
      </p>
    </div>
  );
};
Playground.args = { defaultView: "month", showWeekNumbers: false };
Playground.argTypes = {
  defaultView: { options: ["month", "week", "year"], control: { type: "inline-radio" } },
};

export const Month: Story = () =>
  wrap(<Calendar events={EVENTS} value={FOCUS} now={NOW} view="month" />);

export const Week: Story = () =>
  wrap(<Calendar events={EVENTS} value={FOCUS} now={NOW} view="week" />);

export const Year: Story = () =>
  wrap(<Calendar events={EVENTS} value={FOCUS} now={NOW} view="year" />);

export const WithWeekNumbers: Story = () =>
  wrap(<Calendar events={EVENTS} value={FOCUS} now={NOW} view="month" showWeekNumbers />);

export const OverlappingTimed: Story = () =>
  wrap(<Calendar events={EVENTS} value={FOCUS} now={NOW} view="week" />);

export const Empty: Story = () =>
  wrap(<Calendar events={[]} value={FOCUS} now={NOW} view="month" />);

export const Controlled: Story = () => {
  const [value, setValue] = useState(FOCUS);
  const [view, setView] = useState<CalendarView>("month");
  return wrap(
    <Calendar
      events={EVENTS}
      value={value}
      now={NOW}
      onNavigate={setValue}
      view={view}
      onViewChange={setView}
    />,
  );
};
