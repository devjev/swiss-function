import type { Story } from "@ladle/react";
import { useState } from "react";
import { DatePicker, type DatePickerProps } from "./DatePicker";
import { type DatePickerPrecision, formatISODate, formatPeriod } from "./dateMath";

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
