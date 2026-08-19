import { addDays, isSameDay, monthGrid, startOfDay } from "../../lib/date";
import type { CalendarViewProps } from "./Calendar";
import styles from "./Calendar.module.css";
import { type CalendarEvent, lastDay, weekdayLabels } from "./calendarLayout";

const MONTHS = Array.from({ length: 12 }, (_, m) => m);
const WEEKDAYS_NARROW = weekdayLabels("narrow");

function monthName(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString(undefined, { month: "long" });
}

/** Count events touching each day of the year, once. Keyed by day timestamp. */
function densityMap(events: CalendarEvent[], year: number): Map<number, number> {
  const counts = new Map<number, number>();
  for (const e of events) {
    let d = startOfDay(e.start);
    const end = lastDay(e);
    // Bound the walk so a stray decade-long event can't spin.
    for (let i = 0; d.getTime() <= end.getTime() && i < 400; i++) {
      if (d.getFullYear() === year) counts.set(d.getTime(), (counts.get(d.getTime()) ?? 0) + 1);
      d = addDays(d, 1);
    }
  }
  return counts;
}

/** 1..3 density buckets for the day dot; 0 means no dot. */
function densityLevel(count: number): 0 | 1 | 2 | 3 {
  if (count <= 0) return 0;
  if (count <= 1) return 1;
  if (count <= 3) return 2;
  return 3;
}

/** The year view: twelve mini month grids, each day carrying a density dot when
 *  it has events. Click a day to drill into its week; a month title opens that
 *  month. */
export function YearView({ focused, today, events, onDrillDown }: CalendarViewProps) {
  const year = focused.getFullYear();
  const counts = densityMap(events, year);

  return (
    <div className={styles.year}>
      {MONTHS.map((month) => {
        const cells = monthGrid(year, month);
        return (
          <div key={month} className={styles.miniMonth}>
            <button
              type="button"
              className={styles.miniTitle}
              onClick={() => onDrillDown?.(new Date(year, month, 1), "month")}
            >
              {monthName(year, month)}
            </button>
            <div className={styles.miniWeekdays} aria-hidden="true">
              {WEEKDAYS_NARROW.map((label, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed 7-weekday set; narrow labels repeat (T/T, S/S) so the index is the identity.
                <span key={i}>{label}</span>
              ))}
            </div>
            <div className={styles.miniGrid}>
              {cells.map((cell) => {
                const outside = cell.date.getMonth() !== month;
                const isToday = isSameDay(cell.date, today);
                const level = outside ? 0 : densityLevel(counts.get(cell.date.getTime()) ?? 0);
                return (
                  <button
                    key={cell.date.getTime()}
                    type="button"
                    className={styles.miniDay}
                    data-outside={outside || undefined}
                    data-today={isToday || undefined}
                    onClick={() => onDrillDown?.(cell.date, "week")}
                  >
                    <span className={styles.miniDayNum}>{cell.date.getDate()}</span>
                    {/* Always rendered (hidden at level 0) so the slot is reserved
                        and day numbers stay aligned across cells. */}
                    <span className={styles.densityDot} data-density={level} />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
