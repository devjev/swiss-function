import type { Story } from "@ladle/react";
import { useState } from "react";
import { DatePicker, type DatePickerProps } from "./DatePicker";
import { formatISODate } from "./dateMath";

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
