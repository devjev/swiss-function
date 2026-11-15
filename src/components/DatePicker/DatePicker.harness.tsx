import { useState } from "react";
import type { DateLevel } from "../../lib/date";
import { formatISODate } from "../../lib/date";
import { DatePicker } from "./DatePicker";

/** Named veto rules, so a spec can pick one by name: a function prop cannot
 *  cross the component-test boundary and still answer synchronously. */
const RULES: Record<string, (d: Date, level: DateLevel) => boolean> = {
  /** Only 2024-2026 have data; Q1 is closed; July and August are out; and no
   *  weekend day can be picked. One rule per level, as a consumer would. */
  levels: (d, level) => {
    if (level === "year") return d.getFullYear() < 2024 || d.getFullYear() > 2026;
    if (level === "quarter") return d.getMonth() < 3;
    if (level === "month") return d.getMonth() === 6 || d.getMonth() === 7;
    if (level === "day") return d.getDay() === 0 || d.getDay() === 6;
    return false;
  },
  /** Every odd year is out, to show a step vetoed at the top level. */
  oddYears: (d, level) => level === "year" && d.getFullYear() % 2 === 1,
};

export function PathHarness({
  path,
  rule,
  value,
  minDate,
  maxDate,
}: {
  path: DateLevel[];
  /** A key of RULES above. */
  rule?: string;
  /** ISO date the picker starts on. */
  value?: string;
  minDate?: string;
  maxDate?: string;
}) {
  const [date, setDate] = useState<Date | null>(value ? new Date(`${value}T00:00:00`) : null);
  return (
    <div style={{ width: 280 }}>
      <DatePicker
        aria-label="Date"
        path={path}
        value={date}
        onChange={setDate}
        isDateDisabled={rule ? RULES[rule] : undefined}
        minDate={minDate ? new Date(`${minDate}T00:00:00`) : undefined}
        maxDate={maxDate ? new Date(`${maxDate}T00:00:00`) : undefined}
      />
      <output data-testid="committed">{date ? formatISODate(date) : "none"}</output>
    </div>
  );
}
