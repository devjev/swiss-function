import { useEffect, useRef } from "react";
import { cx } from "../../lib/cx";
import { addDays, isSameDay, startOfDay, startOfISOWeek } from "../../lib/date";
import { Pane } from "../Pane";
import type { CalendarViewProps } from "./Calendar";
import styles from "./Calendar.module.css";
import {
  type CalendarEvent,
  dayDelta,
  lastDay,
  layoutDay,
  layoutWeekRow,
  type RowBar,
  type TimedBlock,
  timedEnd,
  weekdayLabels,
} from "./calendarLayout";

const HOURS = Array.from({ length: 24 }, (_, h) => h);
const WEEKDAYS = weekdayLabels("short");

const hh = (h: number) => `${String(h).padStart(2, "0")}:00`;
const hhmm = (d: Date) =>
  `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

/** Strip events: all-day, plus any multi-day event (spans 2+ calendar days). */
function isStripEvent(e: CalendarEvent): boolean {
  return Boolean(e.allDay) || dayDelta(startOfDay(e.start), lastDay(e)) >= 1;
}

function eventVars(event: CalendarEvent): React.CSSProperties | undefined {
  return event.color ? ({ "--cal-event-color": event.color } as React.CSSProperties) : undefined;
}

/** The week view: an all-day strip pinned above a scrollable 24-hour grid, with
 *  overlapping timed events split into side-by-side columns. */
export function WeekView({
  focused,
  today,
  now,
  events,
  onEventClick,
  onDateClick,
  renderEvent,
}: CalendarViewProps) {
  const weekStart = startOfISOWeek(focused);
  const days = HOURS.slice(0, 7).map((i) => addDays(weekStart, i));
  const stripEvents = events.filter(isStripEvent);
  const gridEvents = events.filter((e) => !isStripEvent(e));
  const stripBars = layoutWeekRow(stripEvents, weekStart, 7);

  // Open on the working day: scroll the hour grid to ~07:00 on mount and when
  // the week changes, so timed events aren't hidden below the midnight fold.
  const bodyRef = useRef<HTMLDivElement>(null);
  const weekKey = weekStart.getTime();
  // biome-ignore lint/correctness/useExhaustiveDependencies: weekKey is the re-run trigger, not an input; the effect resets the scroll each time the week changes, it doesn't read it.
  useEffect(() => {
    const el = bodyRef.current;
    if (el) el.scrollTop = el.scrollHeight * (7 / 24);
  }, [weekKey]);

  return (
    <Pane className={styles.week}>
      <Pane.Header className={styles.weekHead}>
        <div className={styles.weekHeadRow}>
          <div className={styles.timeGutterHead} aria-hidden="true" />
          {days.map((day) => {
            const isToday = isSameDay(day, today);
            const dow = day.getDay();
            return (
              <div
                key={day.getTime()}
                className={styles.weekDayHead}
                data-today={isToday || undefined}
                data-weekend={dow === 0 || dow === 6 || undefined}
              >
                <span className={styles.weekDayName}>{WEEKDAYS[(day.getDay() + 6) % 7]}</span>
                <span className={styles.weekDayNum}>{day.getDate()}</span>
              </div>
            );
          })}
        </div>
        {stripBars.length > 0 && (
          <div
            className={styles.allDayStrip}
            style={{ "--cal-strip-lanes": maxLane(stripBars) + 1 } as React.CSSProperties}
          >
            <div className={styles.allDayLabel} aria-hidden="true">
              all-day
            </div>
            {stripBars.map((bar) => (
              <StripBar
                key={bar.event.id}
                bar={bar}
                onEventClick={onEventClick}
                render={renderEvent ? (e) => renderEvent(e, { view: "week" }) : undefined}
              />
            ))}
          </div>
        )}
      </Pane.Header>
      <Pane.Body ref={bodyRef} className={styles.weekBody}>
        <div className={styles.hourGrid}>
          <div className={styles.timeGutter}>
            {HOURS.map((h) => (
              <div key={h} className={styles.hourLabel}>
                <span>{hh(h)}</span>
              </div>
            ))}
          </div>
          {days.map((day) => {
            const isToday = isSameDay(day, today);
            const blocks = layoutDay(gridEvents, day);
            const nowFrac = isToday
              ? (now.getTime() - startOfDay(now).getTime()) / 86_400_000
              : null;
            return (
              <div
                key={day.getTime()}
                className={styles.dayColumn}
                data-today={isToday || undefined}
              >
                {HOURS.map((h) => (
                  <button
                    key={h}
                    type="button"
                    className={styles.hourSlot}
                    aria-label={`${hh(h)} ${day.toLocaleDateString()}`}
                    onClick={() =>
                      onDateClick?.(new Date(day.getFullYear(), day.getMonth(), day.getDate(), h))
                    }
                  />
                ))}
                {blocks.map((block) => (
                  <TimedBlockView
                    key={block.event.id}
                    block={block}
                    onEventClick={onEventClick}
                    render={renderEvent ? (e) => renderEvent(e, { view: "week" }) : undefined}
                  />
                ))}
                {nowFrac != null && (
                  <div
                    className={styles.nowLine}
                    style={{ top: `${nowFrac * 100}%` }}
                    aria-hidden="true"
                  />
                )}
              </div>
            );
          })}
        </div>
      </Pane.Body>
    </Pane>
  );
}

function maxLane(bars: RowBar[]): number {
  let m = 0;
  for (const b of bars) m = Math.max(m, b.lane);
  return m;
}

function StripBar({
  bar,
  onEventClick,
  render,
}: {
  bar: RowBar;
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
        gridColumn: `${bar.startCol + 2} / ${bar.endCol + 3}`,
        gridRow: bar.lane + 1,
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

function TimedBlockView({
  block,
  onEventClick,
  render,
}: {
  block: TimedBlock;
  onEventClick?: (event: CalendarEvent, e: React.MouseEvent) => void;
  render?: (event: CalendarEvent) => React.ReactNode;
}) {
  const { event } = block;
  const gap = 2; // px between side-by-side columns
  const widthPct = 100 / block.columns;
  // A block under ~40 min is too short for two lines: show the title inline with
  // the time, and drop it entirely when even that won't fit (~20 min).
  const tiny = block.height < 0.028;
  const compact = block.height < 0.045;
  return (
    <button
      type="button"
      className={cx(styles.block, compact && styles.blockTiny)}
      data-tone={event.tone ?? "primary"}
      style={{
        top: `${block.top * 100}%`,
        height: `${block.height * 100}%`,
        left: `calc(${block.column * widthPct}% + ${gap / 2}px)`,
        width: `calc(${widthPct}% - ${gap}px)`,
        ...eventVars(event),
      }}
      title={event.title}
      onClick={(e) => onEventClick?.(event, e)}
    >
      {render ? (
        render(event)
      ) : (
        <>
          <span className={styles.blockTime}>
            {hhmm(event.start)}
            {event.end ? `-${hhmm(timedEnd(event))}` : ""}
          </span>
          {!tiny && <span className={styles.blockTitle}>{event.title}</span>}
        </>
      )}
    </button>
  );
}
