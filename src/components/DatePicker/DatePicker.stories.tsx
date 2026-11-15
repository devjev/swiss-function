import type { Story } from "@ladle/react";
import { useState } from "react";
import { type DatePickerPrecision, formatISODate, formatPeriod } from "../../lib/date";
import { DatePicker, type DatePickerProps } from "./DatePicker";

export default { title: "DatePicker" };

export const Playground: Story<DatePickerProps> = (args) => (
  <div style={{ width: "16rem" }}>
    <DatePicker {...args} />
  </div>
);
Playground.args = {
  "aria-label": "Date",
  showWeekNumbers: false,
  clearable: true,
  disabled: false,
};
Playground.argTypes = {
  size: { options: ["sm", "md", "lg"], control: { type: "radio" }, defaultValue: "md" },
  precision: {
    options: ["day", "week", "month", "year"],
    control: { type: "radio" },
    defaultValue: "day",
  },
};

/**
 * Typing is the fastest path: try `2026-07`, `12 jul`, `tomorrow`, `+7` or a
 * bare `12` — the calendar follows and the footer echoes what Enter commits.
 * Committed values render ISO (`YYYY-MM-DD`), weeks start on Monday.
 */
export const FreeTextEntry: Story = () => {
  const [date, setDate] = useState<Date | null>(new Date(2026, 6, 4));
  return (
    <div style={{ width: "16rem", display: "grid", gap: "0.5rem" }}>
      <DatePicker aria-label="Date" value={date} onChange={setDate} />
      <div style={{ fontFamily: "var(--sf-font-mono)", fontSize: "var(--sf-font-size-sm)" }}>
        value: {date ? formatISODate(date) : "null"}
      </div>
    </div>
  );
};

/** ISO week numbers in a leading column — the full ISO 8601 posture. */
export const WeekNumbers: Story = () => (
  <div style={{ width: "16rem" }}>
    <DatePicker
      aria-label="Week-numbered date"
      defaultValue={new Date(2026, 0, 15)}
      showWeekNumbers
    />
  </div>
);

/**
 * `minDate`/`maxDate` bound the range; `isDateDisabled` vetoes days on top
 * (weekends here). Disabled days render struck through and keyboard
 * navigation skips them.
 */
export const Constrained: Story = () => {
  const today = new Date();
  const max = new Date(today);
  max.setDate(max.getDate() + 60);
  return (
    <div style={{ width: "16rem" }}>
      <DatePicker
        aria-label="Booking date"
        minDate={today}
        maxDate={max}
        isDateDisabled={(d) => d.getDay() === 0 || d.getDay() === 6}
        placeholder="Weekday, next 60d"
      />
    </div>
  );
};

export const Sizes: Story = () => (
  <div style={{ width: "16rem", display: "grid", gap: "0.5rem" }}>
    <DatePicker aria-label="Small" size="sm" />
    <DatePicker aria-label="Medium" size="md" />
    <DatePicker aria-label="Large" size="lg" />
  </div>
);

/** A controlled picker at a given precision, echoing the committed value. */
function PrecisionDemo({
  precision,
  label,
  hint,
}: {
  precision: DatePickerPrecision;
  label: string;
  hint: string;
}) {
  const [date, setDate] = useState<Date | null>(new Date(2026, 6, 4));
  return (
    <div style={{ width: "16rem", display: "grid", gap: "0.5rem" }}>
      <DatePicker aria-label={label} precision={precision} value={date} onChange={setDate} />
      <div style={{ fontFamily: "var(--sf-font-mono)", fontSize: "var(--sf-font-size-sm)" }}>
        value: {date ? `${formatISODate(date)} (${formatPeriod(date, precision)})` : "null"}
      </div>
      <div style={{ fontSize: "var(--sf-font-size-sm)" }}>{hint}</div>
    </div>
  );
}

/**
 * `precision="week"` picks whole ISO weeks: click any row (or its week
 * number), or type `w29`, `2026-w29`, even `12 jul` — everything resolves to
 * the week and commits its Monday. The field shows `YYYY-Www`.
 */
export const WeekPrecision: Story = () => (
  <PrecisionDemo precision="week" label="Week" hint="Try typing w29, 2026-w30, or 12 jul." />
);

/**
 * `precision="month"` swaps the calendar for a year of month cells; the
 * paddles page by year. Type `2026-07`, `jul` or `jul 2027`; the value
 * commits the 1st and the field shows `YYYY-MM`.
 */
export const MonthPrecision: Story = () => (
  <PrecisionDemo precision="month" label="Month" hint="Try typing jul, 2026-11, or dec 2027." />
);

/**
 * `precision="year"` shows a 12-year page; the paddles move a dozen years.
 * Type `2028` and Enter commits Jan 1. The field shows `YYYY`.
 */
export const YearPrecision: Story = () => (
  <PrecisionDemo precision="year" label="Year" hint="Try typing 2028, or today." />
);

/**
 * Constraints at coarse precision use OVERLAP: a week (or month) stays
 * pickable while any of its days is in range, so the week containing the
 * Wednesday minimum is still selectable.
 */
export const ConstrainedWeek: Story = () => {
  const [date, setDate] = useState<Date | null>(new Date(2026, 6, 15));
  return (
    <div style={{ width: "16rem" }}>
      <DatePicker
        aria-label="Delivery week"
        precision="week"
        value={date}
        onChange={setDate}
        minDate={new Date(2026, 6, 15)}
        maxDate={new Date(2026, 8, 30)}
      />
    </div>
  );
};

/**
 * `path` turns the popup into a drill-down: one step at a time, each pick
 * narrowing the next. The trail in the header says where you are, and every
 * value in it goes back to its step; the paddles step the context (the year
 * over a month, the month over a day). The last step commits.
 */
export const PathYearMonthDay: Story = () => {
  const [date, setDate] = useState<Date | null>(null);
  return (
    <div style={{ display: "grid", gap: "var(--sf-unit)", width: "16rem" }}>
      <DatePicker
        aria-label="Report date"
        path={["year", "month", "day"]}
        value={date}
        onChange={setDate}
      />
      <span style={{ fontFamily: "var(--sf-font-mono)" }}>{date ? formatISODate(date) : "—"}</span>
    </div>
  );
};

/** Four paths side by side. The last step is the precision: the quarter path
 *  commits a quarter start and shows `2026-Q3`, the week path a Monday. */
export const PathShapes: Story = () => {
  const [a, setA] = useState<Date | null>(new Date(2026, 6, 14));
  const [b, setB] = useState<Date | null>(new Date(2026, 6, 14));
  const [c, setC] = useState<Date | null>(new Date(2026, 6, 14));
  const [d, setD] = useState<Date | null>(new Date(2026, 6, 14));
  const row = { display: "grid", gap: "calc(var(--sf-unit) / 4)" } as const;
  return (
    <div style={{ display: "grid", gap: "calc(var(--sf-unit) * 1.5)", width: "16rem" }}>
      <div style={row}>
        <span>year › quarter › month</span>
        <DatePicker
          aria-label="Year, quarter, month"
          path={["year", "quarter", "month"]}
          value={a}
          onChange={setA}
        />
      </div>
      <div style={row}>
        <span>year › quarter</span>
        <DatePicker
          aria-label="Year, quarter"
          path={["year", "quarter"]}
          value={b}
          onChange={setB}
        />
      </div>
      <div style={row}>
        <span>year › week › day</span>
        <DatePicker
          aria-label="Year, week, day"
          path={["year", "week", "day"]}
          value={c}
          onChange={setC}
        />
      </div>
      <div style={row}>
        <span>month › day (this year)</span>
        <DatePicker aria-label="Month, day" path={["month", "day"]} value={d} onChange={setD} />
      </div>
    </div>
  );
};

/** Steps that carry no data are disabled at every level: `isDateDisabled` is
 *  asked with the period and the level it is being picked at. Here only
 *  2024-2026 have data, Q1 is closed, the summer months are out, and weekends
 *  cannot be picked. */
export const PathDisabledSteps: Story = () => {
  const [date, setDate] = useState<Date | null>(null);
  return (
    <div style={{ display: "grid", gap: "var(--sf-unit)", width: "16rem" }}>
      <DatePicker
        aria-label="Reporting date"
        path={["year", "quarter", "month", "day"]}
        value={date}
        onChange={setDate}
        isDateDisabled={(d, level) => {
          if (level === "year") return d.getFullYear() < 2024 || d.getFullYear() > 2026;
          if (level === "quarter") return d.getMonth() < 3;
          if (level === "month") return d.getMonth() === 6 || d.getMonth() === 7;
          return d.getDay() === 0 || d.getDay() === 6;
        }}
      />
      <span style={{ fontFamily: "var(--sf-font-mono)" }}>{date ? formatISODate(date) : "—"}</span>
    </div>
  );
};
