import type { HTMLAttributes, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { forwardRef, useState } from "react";
import { cx } from "../../lib/cx";
import {
  addDays,
  addMonthsClamped,
  addWeeks,
  addYearsClamped,
  startOfDay,
  startOfISOWeek,
} from "../../lib/date";
import { Glyph } from "../../lib/icons";
import { Button } from "../Button";
import { ChevronLeft, ChevronRight } from "../Icon";
import { ToggleGroup } from "../ToggleGroup";
import styles from "./Calendar.module.css";
import type { CalendarEvent, CalendarView } from "./calendarLayout";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";
import { YearView } from "./YearView";

export type { CalendarEvent, CalendarEventTone, CalendarView } from "./calendarLayout";

/** Everything the three view components need from the root. */
export interface CalendarViewProps {
  focused: Date;
  today: Date;
  /** The reference "now" instant (its day is `today`); drives the week now-line. */
  now: Date;
  events: CalendarEvent[];
  onEventClick?: (event: CalendarEvent, e: ReactMouseEvent) => void;
  onDateClick?: (date: Date) => void;
  renderEvent?: (event: CalendarEvent, ctx: { view: CalendarView }) => ReactNode;
  showWeekNumbers: boolean;
  /** Switch to a narrower view focused on `date` (day cell → week / month). */
  onDrillDown?: (date: Date, view: CalendarView) => void;
}

export interface CalendarProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  /** The scheduled items to show. */
  events: CalendarEvent[];
  /** The focused date (which month / week / year is shown), controlled. */
  value?: Date;
  /** Uncontrolled focused date. Default: today. */
  defaultValue?: Date;
  /** Fired when navigation changes the focused date (prev/next/today, or a
   *  drill-down from the year/month view). */
  onNavigate?: (date: Date) => void;
  /** The active view (controlled). */
  view?: CalendarView;
  /** Uncontrolled view. Default `"month"`. */
  defaultView?: CalendarView;
  onViewChange?: (view: CalendarView) => void;
  /** Click on an event chip / block. */
  onEventClick?: (event: CalendarEvent, e: ReactMouseEvent) => void;
  /** Click on an empty day cell (month/year) or hour slot (week): the
   *  create-here hook; the consumer opens its own editor. */
  onDateClick?: (date: Date) => void;
  /** Custom event body. Default: the event's `title` (+ time in the week view). */
  renderEvent?: (event: CalendarEvent, ctx: { view: CalendarView }) => ReactNode;
  /** Show the ISO week-number column (month/week views). Default `false`. */
  showWeekNumbers?: boolean;
  /** Component height. The week view scrolls its hour grid inside this. Default
   *  `calc(var(--sf-unit) * 24)`. */
  height?: number | string;
  /** Override the reference "now". Its day is highlighted as today and it places
   *  the week view's now-line; default `new Date()`. Pass a fixed value to make
   *  the today marker deterministic (e.g. for snapshot / visual tests). */
  now?: Date;
}

const VIEW_LABEL: Record<CalendarView, string> = { month: "Month", week: "Week", year: "Year" };
const VIEWS: CalendarView[] = ["month", "week", "year"];

/** The header title for the current view + focused date. */
function titleFor(focused: Date, view: CalendarView): string {
  if (view === "year") return String(focused.getFullYear());
  if (view === "month") {
    return focused.toLocaleDateString(undefined, { month: "long", year: "numeric" });
  }
  // Week: the Monday-to-Sunday range, built day-first (ISO) rather than trusting
  // the locale's day/month field order.
  const mon = startOfISOWeek(focused);
  const sun = addDays(mon, 6);
  const short = (d: Date) => d.toLocaleDateString(undefined, { month: "short" });
  const y = sun.getFullYear();
  if (mon.getMonth() === sun.getMonth() && mon.getFullYear() === y) {
    return `${mon.getDate()}-${sun.getDate()} ${short(sun)} ${y}`;
  }
  if (mon.getFullYear() === y) {
    return `${mon.getDate()} ${short(mon)} - ${sun.getDate()} ${short(sun)} ${y}`;
  }
  return `${mon.getDate()} ${short(mon)} ${mon.getFullYear()} - ${sun.getDate()} ${short(sun)} ${y}`;
}

/**
 * A scheduling calendar: shows events / schedules in **Month**, **Week**, and
 * **Year** views, with a prev / next / today toolbar and a view switcher. Not
 * the `DatePicker` (that picks a value into a field); this is a surface for
 * reading and clicking into a schedule. Events carry an optional time (`allDay`
 * for whole-day items); the week view lays overlapping timed events out in
 * side-by-side columns and multi-day events span as bars. Renders a
 * `<div role="group">`; extends `HTMLAttributes<HTMLDivElement>` (minus `onChange`).
 * Weeks start on Monday (ISO 8601), matching `DatePicker`.
 */
export const Calendar = forwardRef<HTMLDivElement, CalendarProps>(function Calendar(
  {
    events,
    value,
    defaultValue,
    onNavigate,
    view,
    defaultView = "month",
    onViewChange,
    onEventClick,
    onDateClick,
    renderEvent,
    showWeekNumbers = false,
    height,
    now,
    className,
    style,
    ...rest
  },
  ref,
) {
  const focusedControlled = value !== undefined;
  const [focusedUncontrolled, setFocusedUncontrolled] = useState(() =>
    startOfDay(defaultValue ?? now ?? new Date()),
  );
  const focused = focusedControlled ? value : focusedUncontrolled;

  const viewControlled = view !== undefined;
  const [viewUncontrolled, setViewUncontrolled] = useState(defaultView);
  const currentView = viewControlled ? view : viewUncontrolled;

  // The reference "now": a fixed `now` prop (deterministic tests) or the live
  // clock, read each render so the marker stays correct across midnight on a
  // long-lived surface (never frozen at mount).
  const nowRef = now ?? new Date();
  const today = startOfDay(nowRef);

  const navigate = (next: Date) => {
    if (!focusedControlled) setFocusedUncontrolled(next);
    onNavigate?.(next);
  };
  const changeView = (next: CalendarView) => {
    if (!viewControlled) setViewUncontrolled(next);
    onViewChange?.(next);
  };

  const step = (dir: -1 | 1) => {
    if (currentView === "month") navigate(addMonthsClamped(focused, dir));
    else if (currentView === "week") navigate(addWeeks(focused, dir));
    else navigate(addYearsClamped(focused, dir));
  };

  const drillDown = (date: Date, toView: CalendarView) => {
    navigate(startOfDay(date));
    changeView(toView);
  };

  const viewProps: CalendarViewProps = {
    focused,
    today,
    now: nowRef,
    events,
    onEventClick,
    onDateClick,
    renderEvent,
    showWeekNumbers,
    onDrillDown: drillDown,
  };

  const rootStyle = {
    ...style,
    ...(height != null ? { height: typeof height === "number" ? `${height}px` : height } : {}),
  };

  return (
    // biome-ignore lint/a11y/useSemanticElements: a labelled scheduling surface is a group of controls, not a <fieldset> (which imposes form semantics).
    <div
      {...rest}
      ref={ref}
      role="group"
      aria-label="Calendar"
      className={cx(styles.root, className)}
      style={rootStyle}
      data-view={currentView}
    >
      <div className={styles.toolbar}>
        <div className={styles.nav}>
          <Button
            variant="ghost"
            size="sm"
            tight
            aria-label={`Previous ${currentView}`}
            onClick={() => step(-1)}
          >
            <Glyph slot="chevronLeft" fallback={ChevronLeft} />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => navigate(today)}>
            Today
          </Button>
          <Button
            variant="ghost"
            size="sm"
            tight
            aria-label={`Next ${currentView}`}
            onClick={() => step(1)}
          >
            <Glyph slot="chevronRight" fallback={ChevronRight} />
          </Button>
        </div>
        <h2 className={styles.title} aria-live="polite">
          {titleFor(focused, currentView)}
        </h2>
        <ToggleGroup
          size="sm"
          value={[currentView]}
          onValueChange={(v) => {
            const next = v[0] as CalendarView | undefined;
            if (next) changeView(next);
          }}
          aria-label="Calendar view"
        >
          {VIEWS.map((v) => (
            <ToggleGroup.Item key={v} value={v}>
              {VIEW_LABEL[v]}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup>
      </div>

      <div className={styles.viewport}>
        {currentView === "month" && <MonthView {...viewProps} />}
        {currentView === "week" && <WeekView {...viewProps} />}
        {currentView === "year" && <YearView {...viewProps} />}
      </div>
    </div>
  );
});
