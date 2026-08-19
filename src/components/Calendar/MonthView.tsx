import { cx } from "../../lib/cx";
import { isoWeek, isSameDay, monthGrid } from "../../lib/date";
import type { CalendarViewProps } from "./Calendar";
import styles from "./Calendar.module.css";
import { type CalendarEvent, layoutWeekRow, type RowBar, weekdayLabels } from "./calendarLayout";

/** Lanes drawn per week row before events collapse into a "+N more" chip. */
const MAX_LANES = 3;

const WEEKDAYS = weekdayLabels("short");

function eventVars(event: CalendarEvent): React.CSSProperties | undefined {
  return event.color ? ({ "--cal-event-color": event.color } as React.CSSProperties) : undefined;
}

/** The month grid: 7 columns × 6 weeks, multi-day events as spanning bars. */
export function MonthView({
  focused,
  today,
  events,
  onEventClick,
  onDateClick,
  renderEvent,
  showWeekNumbers,
  onDrillDown,
}: CalendarViewProps) {
  const cells = monthGrid(focused.getFullYear(), focused.getMonth());
  const rows = Array.from({ length: 6 }, (_, r) => cells.slice(r * 7, r * 7 + 7));
  const focusedMonth = focused.getMonth();

  return (
    <div className={cx(styles.month, showWeekNumbers && styles.withWeekNum)}>
      <div className={styles.monthHead}>
        {showWeekNumbers && <div className={styles.weekNumHead} aria-hidden="true" />}
        {WEEKDAYS.map((label, i) => (
          <div key={label} className={styles.weekdayHead} data-weekend={i >= 5 || undefined}>
            {label}
          </div>
        ))}
      </div>
      <div className={styles.monthBody}>
        {rows.map((row) => {
          const weekStart = row[0]?.date;
          if (!weekStart) return null;
          const bars = layoutWeekRow(events, weekStart, 7);
          const visible = bars.filter((b) => b.lane < MAX_LANES);
          const hiddenPerCol = (col: number) =>
            bars.filter((b) => b.lane >= MAX_LANES && b.startCol <= col && b.endCol >= col).length;
          const lead = showWeekNumbers ? 1 : 0;

          return (
            <div key={weekStart.getTime()} className={styles.weekRow}>
              {showWeekNumbers && (
                <div
                  className={styles.weekNum}
                  aria-hidden="true"
                  style={{ gridColumn: 1, gridRow: "1 / -1" }}
                >
                  {isoWeek(weekStart)}
                </div>
              )}
              {row.map((cell, col) => {
                const isToday = isSameDay(cell.date, today);
                const outside = cell.date.getMonth() !== focusedMonth;
                const dow = cell.date.getDay();
                return (
                  <button
                    key={cell.date.getTime()}
                    type="button"
                    className={styles.dayCell}
                    data-today={isToday || undefined}
                    data-outside={outside || undefined}
                    data-weekend={dow === 0 || dow === 6 || undefined}
                    style={{ gridColumn: col + 1 + lead, gridRow: "1 / -1" }}
                    onClick={() => onDateClick?.(cell.date)}
                  >
                    <span className={styles.dayNum}>{cell.date.getDate()}</span>
                  </button>
                );
              })}
              {visible.map((bar) => (
                <MonthBar
                  key={bar.event.id}
                  bar={bar}
                  weekNumCols={showWeekNumbers ? 1 : 0}
                  onEventClick={onEventClick}
                  render={renderEvent ? (e) => renderEvent(e, { view: "month" }) : undefined}
                />
              ))}
              {row.map((cell, col) => {
                const n = hiddenPerCol(col);
                if (n === 0) return null;
                return (
                  <button
                    key={`more-${cell.date.getTime()}`}
                    type="button"
                    className={styles.more}
                    style={{
                      gridColumn: col + 1 + (showWeekNumbers ? 1 : 0),
                      gridRow: MAX_LANES + 2,
                    }}
                    onClick={() => onDrillDown?.(cell.date, "week")}
                  >
                    +{n} more
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MonthBar({
  bar,
  weekNumCols,
  onEventClick,
  render,
}: {
  bar: RowBar;
  weekNumCols: number;
  onEventClick?: (event: CalendarEvent, e: React.MouseEvent) => void;
  render?: (event: CalendarEvent) => React.ReactNode;
}) {
  const { event } = bar;
  return (
    <button
      type="button"
      className={styles.bar}
      data-tone={event.tone ?? "primary"}
      data-continues-before={bar.continuesBefore || undefined}
      data-continues-after={bar.continuesAfter || undefined}
      style={{
        gridColumn: `${bar.startCol + 1 + weekNumCols} / ${bar.endCol + 2 + weekNumCols}`,
        gridRow: bar.lane + 2,
        ...eventVars(event),
      }}
      title={event.title}
      onClick={(e) => onEventClick?.(event, e)}
    >
      {bar.continuesBefore && <span className={styles.barArrow}>‹</span>}
      <span className={styles.barLabel}>{render ? render(event) : event.title}</span>
      {bar.continuesAfter && <span className={styles.barArrow}>›</span>}
    </button>
  );
}
