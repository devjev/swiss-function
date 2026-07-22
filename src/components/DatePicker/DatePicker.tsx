import { Popover as BasePopover } from "@base-ui/react/popover";
import type { FocusEvent, HTMLAttributes, KeyboardEvent } from "react";
import { forwardRef, useEffect, useId, useMemo, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import type { BoxElevation } from "../Box";
import styles from "./DatePicker.module.css";
import type { DatePickerPrecision } from "./dateMath";
import {
  addDays,
  addMonthsClamped,
  addPeriods,
  formatISODate,
  formatISOMonth,
  formatISOWeek,
  formatISOYear,
  formatPeriod,
  isoWeek,
  isoWeekYear,
  isSameDay,
  isSamePeriod,
  mondayIndex,
  monthGrid,
  periodDisabled,
  startOfDay,
  startOfPeriod,
  yearPageStart,
} from "./dateMath";
import { type MonthView, type ParsedText, parseDateText } from "./parseDateText";

export type { DatePickerPrecision } from "./dateMath";

const PLACEHOLDERS: Record<DatePickerPrecision, string> = {
  day: "YYYY-MM-DD",
  week: "YYYY-Www",
  month: "YYYY-MM",
  year: "YYYY",
};

export interface DatePickerProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  /** Selected date (controlled). Pass with `onChange`. */
  value?: Date | null;
  /** Initial selection (uncontrolled). */
  defaultValue?: Date | null;
  /** Called with the picked date, or `null` when cleared. */
  onChange?: (date: Date | null) => void;
  /** The unit the picker commits. Coarser precisions pick whole periods: the
   *  value is normalized to the period start (ISO-week Monday, the 1st, or
   *  Jan 1) and displays as `YYYY-Www` / `YYYY-MM` / `YYYY`. Default `"day"`. */
  precision?: DatePickerPrecision;
  /** Placeholder for the text field. Default the precision's ISO shape
   *  (`YYYY-MM-DD` / `YYYY-Www` / `YYYY-MM` / `YYYY`). */
  placeholder?: string;
  /** Control size, mirroring `Input` (`sm` / `md` / `lg`). Default `md`. */
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  /** Show a clear button once a date is selected. Default `true`. */
  clearable?: boolean;
  /** Earliest selectable day (inclusive, day granularity). At coarser
   *  precisions a period stays pickable while it overlaps the range. */
  minDate?: Date;
  /** Latest selectable day (inclusive, day granularity). At coarser
   *  precisions a period stays pickable while it overlaps the range. */
  maxDate?: Date;
  /** Per-day veto on top of min/max (e.g. weekends). Day precision only;
   *  ignored at week/month/year precision. */
  isDateDisabled?: (date: Date) => boolean;
  /** ISO week numbers in a leading column. Default `false`; forced on at
   *  week precision (the column holds the week buttons). */
  showWeekNumbers?: boolean;
  /** Renders the committed value in the field. Default the precision's ISO
   *  form (`YYYY-MM-DD` / `YYYY-Www` / `YYYY-MM` / `YYYY`); always receives
   *  the normalized period start. Parsing always accepts ISO (and day-first
   *  fragments) regardless. */
  formatValue?: (date: Date) => string;
  /** Resting depth of the field — same `--sf-elevation-N` scale as Box. */
  elevation?: BoxElevation;
  /** Accessible name for the text field (use when not wrapped in a Field). */
  "aria-label"?: string;
  /** Id(s) of element(s) naming the field — forwarded to the text input so an
   *  external `<label>` (e.g. FieldLayout.Field) associates instead of the
   *  input keeping its `YYYY-MM-DD` placeholder as the accessible name. */
  "aria-labelledby"?: string;
}

/** Monday-first day-of-week header, localized two-letter forms. */
function weekdayLabels(): string[] {
  // 2024-01-01 is a Monday; walk the week from there.
  return Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 1 + i).toLocaleDateString(undefined, { weekday: "short" }).slice(0, 2),
  );
}

function viewOf(d: Date): MonthView {
  return { year: d.getFullYear(), month: d.getMonth() };
}

/**
 * Date input + calendar popup (issue #30). ISO 8601 by default: `YYYY-MM-DD`
 * in the field, Monday-first weeks, optional ISO week numbers. The text field
 * is the primary control — typing narrows the calendar (`2026-07`, `12 jul`,
 * `tomorrow`, `+7`…) and Enter commits the echoed candidate; the grid is
 * fully keyboard-navigable (arrows, PageUp/Down for months, Shift for years).
 */
export const DatePicker = forwardRef<HTMLDivElement, DatePickerProps>(function DatePicker(
  {
    value,
    defaultValue,
    onChange,
    precision = "day",
    placeholder,
    size = "md",
    disabled,
    clearable = true,
    minDate,
    maxDate,
    isDateDisabled,
    showWeekNumbers = false,
    formatValue,
    elevation,
    className,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledby,
    ...rest
  },
  ref,
) {
  const [today] = useState(() => startOfDay(new Date()));
  const [internal, setInternal] = useState<Date | null>(defaultValue ?? null);
  const isControlled = value !== undefined;
  const selected = isControlled ? value : internal;

  const placeholderText = placeholder ?? PLACEHOLDERS[precision];
  const fmt = formatValue ?? ((d: Date) => formatPeriod(d, precision));
  /** Field text for a value; normalizes so an un-normalized controlled value
   *  still displays as its period. */
  const displayValue = (d: Date | null) => (d ? fmt(startOfPeriod(d, precision)) : "");

  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => displayValue(selected));
  const [view, setView] = useState<MonthView>(() => viewOf(selected ?? today));
  const [focusDate, setFocusDate] = useState<Date>(() =>
    startOfPeriod(selected ?? today, precision),
  );
  const [parsed, setParsed] = useState<ParsedText | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLElement | null>(null);
  /** Set when a key/text action must move DOM focus to the grid cell. */
  const pendingGridFocus = useRef(false);
  const gridId = useId();

  const isPeriodDisabled = (d: Date): boolean => {
    if (periodDisabled(d, precision, minDate, maxDate)) return true;
    return precision === "day" && isDateDisabled ? isDateDisabled(d) : false;
  };

  const commit = (d: Date | null) => {
    const norm = d ? startOfPeriod(d, precision) : null;
    if (norm && isPeriodDisabled(norm)) return;
    if (!isControlled) setInternal(norm);
    onChange?.(norm);
    setText(norm ? fmt(norm) : "");
    setParsed(null);
    if (norm) {
      setView(viewOf(norm));
      setFocusDate(norm);
    }
    setOpen(false);
    inputRef.current?.focus();
  };

  /** Abandon partial text when the interaction ends without a commit. */
  const revertText = () => {
    setText(displayValue(selected));
    setParsed(null);
  };

  // Controlled value changed from outside while we're not editing: reflect it.
  const selectedTime = selected ? startOfDay(selected).getTime() : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: sync exactly on external value changes; text/formatValue are deliberately not triggers.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setText(displayValue(selected));
    }
  }, [selectedTime]);

  const handleTextChange = (next: string) => {
    setText(next);
    if (!open) setOpen(true);
    const result = parseDateText(next, view, today, precision);
    setParsed(result);
    if (result.view) setView(result.view);
    if (result.candidate) setFocusDate(result.candidate);
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (parsed?.candidate && !isPeriodDisabled(parsed.candidate)) {
        e.preventDefault();
        commit(parsed.candidate);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      pendingGridFocus.current = true;
      // Re-render happens even when focusDate is unchanged (state set below),
      // so the focus effect always runs.
      setFocusDate((d) => new Date(d));
      return;
    }
    if (e.key === "Escape" && open) {
      // Base UI also sees document-level Escape; handle locally so the text
      // reverts and the event doesn't leak to e.g. an enclosing Dialog.
      e.preventDefault();
      e.stopPropagation();
      revertText();
      setOpen(false);
    }
  };

  const moveFocus = (next: Date, direction: 1 | -1) => {
    // Skip disabled periods by continuing in the same direction (bounded scan).
    let candidate = startOfPeriod(next, precision);
    for (let i = 0; i < 366 && isPeriodDisabled(candidate); i++) {
      candidate = addPeriods(candidate, direction, precision);
    }
    if (isPeriodDisabled(candidate)) return;
    setFocusDate(candidate);
    setView(viewOf(candidate));
    pendingGridFocus.current = true;
  };

  const handleGridKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    // Per-precision grid geometry: days walk the 7-wide month table (rows are
    // weeks), weeks walk its rows, months/years walk a 3-wide listbox grid.
    const rowSpan = precision === "day" ? 7 : precision === "week" ? 1 : 3;
    switch (e.key) {
      case "ArrowLeft":
        moveFocus(addPeriods(focusDate, -1, precision), -1);
        break;
      case "ArrowRight":
        moveFocus(addPeriods(focusDate, 1, precision), 1);
        break;
      case "ArrowUp":
        moveFocus(addPeriods(focusDate, -rowSpan, precision), -1);
        break;
      case "ArrowDown":
        moveFocus(addPeriods(focusDate, rowSpan, precision), 1);
        break;
      case "PageUp":
      case "PageDown": {
        const dir = e.key === "PageUp" ? -1 : 1;
        // A page = the header paddle's step: a month (Shift: a year) on the
        // calendar, a year on the month grid, a dozen years on the year grid.
        const next =
          precision === "month"
            ? addPeriods(focusDate, 12 * dir, "month")
            : precision === "year"
              ? addPeriods(focusDate, 12 * dir, "year")
              : addMonthsClamped(focusDate, (e.shiftKey ? 12 : 1) * dir);
        moveFocus(next, dir === -1 ? -1 : 1);
        break;
      }
      case "Home":
      case "End": {
        const end = e.key === "End";
        let target: Date;
        if (precision === "day") {
          target = addDays(focusDate, end ? 6 - mondayIndex(focusDate) : -mondayIndex(focusDate));
        } else if (precision === "week") {
          // First / last week row of the visible month grid.
          const grid = monthGrid(view.year, view.month);
          target = (end ? grid[35] : grid[0])?.date ?? focusDate;
        } else if (precision === "month") {
          target = new Date(view.year, end ? 11 : 0, 1);
        } else {
          target = new Date(yearPageStart(view.year) + (end ? 11 : 0), 0, 1);
        }
        moveFocus(target, end ? -1 : 1);
        break;
      }
      case "Enter":
      case " ":
        commit(focusDate);
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  // Move DOM focus to the roving cell after keyboard-driven changes.
  useEffect(() => {
    if (!pendingGridFocus.current || !open) return;
    pendingGridFocus.current = false;
    const selector =
      precision === "day"
        ? `[data-iso="${formatISODate(focusDate)}"]`
        : precision === "week"
          ? `[data-week="${formatISOWeek(focusDate)}"]`
          : precision === "month"
            ? `[data-month="${formatISOMonth(focusDate.getFullYear(), focusDate.getMonth())}"]`
            : `[data-year="${focusDate.getFullYear()}"]`;
    gridRef.current?.querySelector<HTMLButtonElement>(selector)?.focus();
  });

  const handleRootBlur = (e: FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next && (rootRef.current?.contains(next) || popupRef.current?.contains(next))) return;
    if (open) {
      revertText();
      setOpen(false);
    }
  };

  const weekdays = useMemo(weekdayLabels, []);
  const cells = useMemo(() => monthGrid(view.year, view.month), [view]);
  const rows = useMemo(
    () => Array.from({ length: 6 }, (_, r) => cells.slice(r * 7, r * 7 + 7)),
    [cells],
  );
  const monthLabel = formatISOMonth(view.year, view.month);
  const echo = parsed?.candidate && text.trim() !== "" ? `→ ${fmt(parsed.candidate)}` : "";

  // Coarser-precision surfaces: the week column is forced on at week
  // precision, month/year swap the table for a 12-cell listbox grid.
  const weekColumn = precision === "week" || showWeekNumbers;
  const listboxGrid = precision === "month" || precision === "year";
  const pageStart = yearPageStart(view.year);
  const headerLabel =
    precision === "month"
      ? formatISOYear(view.year)
      : precision === "year"
        ? `${formatISOYear(pageStart)}-${formatISOYear(pageStart + 11)}`
        : monthLabel;
  const navUnit = precision === "month" ? "year" : precision === "year" ? "years" : "month";
  const navBy = (dir: 1 | -1) =>
    setView((v) => {
      if (precision === "month") return { year: v.year + dir, month: v.month };
      if (precision === "year") return { year: v.year + dir * 12, month: v.month };
      return viewOf(addMonthsClamped(new Date(v.year, v.month, 1), dir));
    });
  const periodCells: Date[] = listboxGrid
    ? precision === "month"
      ? Array.from({ length: 12 }, (_, m) => new Date(view.year, m, 1))
      : Array.from({ length: 12 }, (_, i) => new Date(pageStart + i, 0, 1))
    : [];
  const isCandidatePeriod = (d: Date) =>
    parsed?.candidate != null && isSamePeriod(d, parsed.candidate, precision);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: onBlur is focus bookkeeping (close the popup when focus leaves field+popup), not interaction — the interactive elements are the input and buttons inside.
    <div
      {...rest}
      ref={(node) => {
        rootRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) ref.current = node;
      }}
      className={cx(styles.root, className)}
      onBlur={handleRootBlur}
    >
      <div className={styles.field} data-size={size} data-elevation={elevation}>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          role="combobox"
          aria-labelledby={ariaLabelledby}
          aria-expanded={open}
          aria-controls={gridId}
          aria-haspopup="dialog"
          aria-label={ariaLabel}
          autoComplete="off"
          spellCheck={false}
          placeholder={placeholderText}
          disabled={disabled}
          value={text}
          onChange={(e) => handleTextChange(e.target.value)}
          onFocus={() => setOpen(true)}
          onClick={() => setOpen(true)}
          onKeyDown={handleInputKeyDown}
        />
        {clearable && selected && !disabled ? (
          <button
            type="button"
            className={styles.clear}
            aria-label="Clear date"
            onClick={() => commit(null)}
          >
            ×
          </button>
        ) : null}
      </div>

      <BasePopover.Root
        open={open && !disabled}
        onOpenChange={(next, details) => {
          if (next) {
            setOpen(true);
            return;
          }
          // Ignore Base UI's outside-press when the press is our own field —
          // the input is not the popover's trigger, so Base UI can't know.
          const target = details.event?.target;
          if (
            details.reason === "outside-press" &&
            target instanceof Node &&
            rootRef.current?.contains(target)
          ) {
            return;
          }
          if (details.reason === "escape-key") {
            revertText();
            inputRef.current?.focus();
          }
          setOpen(false);
        }}
        modal={false}
      >
        <BasePopover.Portal>
          <BasePopover.Positioner
            anchor={rootRef}
            sideOffset={4}
            align="start"
            className={styles.positioner}
          >
            <BasePopover.Popup
              ref={popupRef}
              className={styles.popup}
              initialFocus={false}
              finalFocus={false}
            >
              <div className={styles.header}>
                <button
                  type="button"
                  className={styles.nav}
                  aria-label={`Previous ${navUnit}`}
                  onClick={() => navBy(-1)}
                >
                  ‹
                </button>
                <div className={styles.monthLabel}>{headerLabel}</div>
                <button
                  type="button"
                  className={styles.nav}
                  aria-label={`Next ${navUnit}`}
                  onClick={() => navBy(1)}
                >
                  ›
                </button>
              </div>

              {listboxGrid ? (
                /* Month/year precision: a flat single-select grid of 12
                   periods — listbox/option semantics, roving tabindex. */
                <div
                  id={gridId}
                  ref={(el) => {
                    gridRef.current = el;
                  }}
                  role="listbox"
                  aria-label={`Calendar, ${headerLabel}`}
                  className={styles.periodGrid}
                  onKeyDown={handleGridKeyDown}
                >
                  {periodCells.map((date) => {
                    const isSel = selected ? isSamePeriod(date, selected, precision) : false;
                    const key =
                      precision === "month"
                        ? formatISOMonth(date.getFullYear(), date.getMonth())
                        : formatISOYear(date.getFullYear());
                    return (
                      <button
                        key={key}
                        type="button"
                        role="option"
                        className={styles.periodCell}
                        tabIndex={isSamePeriod(date, focusDate, precision) ? 0 : -1}
                        disabled={isPeriodDisabled(date)}
                        aria-selected={isSel}
                        aria-label={
                          precision === "month"
                            ? date.toLocaleDateString(undefined, { month: "long", year: "numeric" })
                            : key
                        }
                        data-month={precision === "month" ? key : undefined}
                        data-year={precision === "year" ? key : undefined}
                        data-selected={isSel || undefined}
                        data-today={isSamePeriod(date, today, precision) || undefined}
                        data-candidate={isCandidatePeriod(date) || undefined}
                        onClick={() => commit(date)}
                      >
                        {precision === "month"
                          ? date.toLocaleDateString(undefined, { month: "short" })
                          : key}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* A real <table> — a month IS tabular data, and the native
                   row/columnheader/gridcell semantics come free. Roving
                   tabindex: exactly one day (or week) button is tabbable. */
                <table
                  id={gridId}
                  ref={(el) => {
                    gridRef.current = el;
                  }}
                  aria-label={`Calendar, ${monthLabel}`}
                  className={styles.calendar}
                  onKeyDown={handleGridKeyDown}
                >
                  <thead>
                    <tr>
                      {weekColumn ? <th className={styles.weekdayLabel} /> : null}
                      {weekdays.map((w) => (
                        <th key={w} scope="col" className={styles.weekdayLabel}>
                          {w}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const first = row[0];
                      if (!first) return null;
                      if (precision === "week") {
                        // Rows start on Monday, so the first cell IS the week.
                        const monday = first.date;
                        const weekDisabled = isPeriodDisabled(monday);
                        const isSel = selected ? isSamePeriod(monday, selected, "week") : false;
                        return (
                          <tr
                            key={formatISODate(monday)}
                            className={styles.weekRow}
                            data-selected={isSel || undefined}
                            data-candidate={isCandidatePeriod(monday) || undefined}
                            data-disabled={weekDisabled || undefined}
                            onClick={weekDisabled ? undefined : () => commit(monday)}
                          >
                            <th scope="row" className={styles.weekNumber}>
                              <button
                                type="button"
                                className={styles.weekButton}
                                tabIndex={isSamePeriod(monday, focusDate, "week") ? 0 : -1}
                                disabled={weekDisabled}
                                aria-label={`Week ${isoWeek(monday)}, ${isoWeekYear(monday)}`}
                                aria-pressed={isSel}
                                data-week={formatISOWeek(monday)}
                              >
                                {isoWeek(monday)}
                              </button>
                            </th>
                            {row.map(({ date, inMonth }) => (
                              <td
                                key={formatISODate(date)}
                                className={styles.dayStatic}
                                data-outside={!inMonth || undefined}
                                data-today={isSameDay(date, today) || undefined}
                              >
                                {date.getDate()}
                              </td>
                            ))}
                          </tr>
                        );
                      }
                      return (
                        <tr key={formatISODate(first.date)}>
                          {weekColumn ? (
                            <th
                              scope="row"
                              aria-label={`Week ${isoWeek(first.date)}`}
                              className={styles.weekNumber}
                            >
                              {isoWeek(first.date)}
                            </th>
                          ) : null}
                          {row.map(({ date, inMonth }) => {
                            const isoDay = formatISODate(date);
                            const isSelected = selected ? isSameDay(date, selected) : false;
                            const isFocus = isSameDay(date, focusDate);
                            const dayDisabled = isPeriodDisabled(date);
                            const candidate =
                              parsed?.dayPrefix != null &&
                              inMonth &&
                              String(date.getDate()).startsWith(parsed.dayPrefix);
                            return (
                              <td key={isoDay}>
                                <button
                                  type="button"
                                  className={styles.day}
                                  tabIndex={isFocus ? 0 : -1}
                                  disabled={dayDisabled}
                                  aria-label={isoDay}
                                  aria-pressed={isSelected}
                                  data-iso={isoDay}
                                  data-selected={isSelected || undefined}
                                  data-outside={!inMonth || undefined}
                                  data-today={isSameDay(date, today) || undefined}
                                  data-candidate={candidate || undefined}
                                  onClick={() => commit(date)}
                                >
                                  {date.getDate()}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}

              {/* Parse echo — what Enter will commit. Fixed height so the popup
                  doesn't jump while typing. */}
              <div className={styles.echo} aria-live="polite">
                {echo}
              </div>
            </BasePopover.Popup>
          </BasePopover.Positioner>
        </BasePopover.Portal>
      </BasePopover.Root>
    </div>
  );
});
