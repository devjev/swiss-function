import { Popover as BasePopover } from "@base-ui/react/popover";
import type { FocusEvent, HTMLAttributes, KeyboardEvent } from "react";
import { forwardRef, useEffect, useId, useMemo, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import type { BoxElevation } from "../Box";
import styles from "./DatePicker.module.css";
import {
  addDays,
  addMonthsClamped,
  formatISODate,
  formatISOMonth,
  isoWeek,
  isSameDay,
  mondayIndex,
  monthGrid,
  startOfDay,
} from "./dateMath";
import { type MonthView, type ParsedText, parseDateText } from "./parseDateText";

export interface DatePickerProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  /** Selected date (controlled). Pass with `onChange`. */
  value?: Date | null;
  /** Initial selection (uncontrolled). */
  defaultValue?: Date | null;
  /** Called with the picked date, or `null` when cleared. */
  onChange?: (date: Date | null) => void;
  /** Placeholder for the text field. Default the ISO shape, `YYYY-MM-DD`. */
  placeholder?: string;
  /** Control size, mirroring `Input` (`sm` / `md` / `lg`). Default `md`. */
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  /** Show a clear button once a date is selected. Default `true`. */
  clearable?: boolean;
  /** Earliest selectable day (inclusive, day granularity). */
  minDate?: Date;
  /** Latest selectable day (inclusive, day granularity). */
  maxDate?: Date;
  /** Per-day veto on top of min/max (e.g. weekends). */
  isDateDisabled?: (date: Date) => boolean;
  /** ISO week numbers in a leading column. Default `false`. */
  showWeekNumbers?: boolean;
  /** Renders the committed value in the field. Default ISO `YYYY-MM-DD`.
   *  Parsing always accepts ISO (and day-first fragments) regardless. */
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
    placeholder = "YYYY-MM-DD",
    size = "md",
    disabled,
    clearable = true,
    minDate,
    maxDate,
    isDateDisabled,
    showWeekNumbers = false,
    formatValue = formatISODate,
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

  const [open, setOpen] = useState(false);
  const [text, setText] = useState(selected ? formatValue(selected) : "");
  const [view, setView] = useState<MonthView>(() => viewOf(selected ?? today));
  const [focusDate, setFocusDate] = useState<Date>(() => startOfDay(selected ?? today));
  const [parsed, setParsed] = useState<ParsedText | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLTableElement>(null);
  /** Set when a key/text action must move DOM focus to the grid cell. */
  const pendingGridFocus = useRef(false);
  const gridId = useId();

  const isDayDisabled = (d: Date): boolean => {
    if (minDate && startOfDay(d).getTime() < startOfDay(minDate).getTime()) return true;
    if (maxDate && startOfDay(d).getTime() > startOfDay(maxDate).getTime()) return true;
    return isDateDisabled ? isDateDisabled(d) : false;
  };

  const commit = (d: Date | null) => {
    if (d && isDayDisabled(d)) return;
    if (!isControlled) setInternal(d);
    onChange?.(d);
    setText(d ? formatValue(d) : "");
    setParsed(null);
    if (d) {
      setView(viewOf(d));
      setFocusDate(startOfDay(d));
    }
    setOpen(false);
    inputRef.current?.focus();
  };

  /** Abandon partial text when the interaction ends without a commit. */
  const revertText = () => {
    setText(selected ? formatValue(selected) : "");
    setParsed(null);
  };

  // Controlled value changed from outside while we're not editing: reflect it.
  const selectedTime = selected ? startOfDay(selected).getTime() : null;
  // biome-ignore lint/correctness/useExhaustiveDependencies: sync exactly on external value changes; text/formatValue are deliberately not triggers.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setText(selected ? formatValue(selected) : "");
    }
  }, [selectedTime]);

  const handleTextChange = (next: string) => {
    setText(next);
    if (!open) setOpen(true);
    const result = parseDateText(next, view, today);
    setParsed(result);
    if (result.view) setView(result.view);
    if (result.candidate) setFocusDate(startOfDay(result.candidate));
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (parsed?.candidate && !isDayDisabled(parsed.candidate)) {
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
    // Skip disabled days by continuing in the same direction (bounded scan).
    let candidate = next;
    for (let i = 0; i < 366 && isDayDisabled(candidate); i++) {
      candidate = addDays(candidate, direction);
    }
    if (isDayDisabled(candidate)) return;
    setFocusDate(candidate);
    setView(viewOf(candidate));
    pendingGridFocus.current = true;
  };

  const handleGridKeyDown = (e: KeyboardEvent<HTMLTableElement>) => {
    switch (e.key) {
      case "ArrowLeft":
        moveFocus(addDays(focusDate, -1), -1);
        break;
      case "ArrowRight":
        moveFocus(addDays(focusDate, 1), 1);
        break;
      case "ArrowUp":
        moveFocus(addDays(focusDate, -7), -1);
        break;
      case "ArrowDown":
        moveFocus(addDays(focusDate, 7), 1);
        break;
      case "PageUp":
        moveFocus(addMonthsClamped(focusDate, e.shiftKey ? -12 : -1), -1);
        break;
      case "PageDown":
        moveFocus(addMonthsClamped(focusDate, e.shiftKey ? 12 : 1), 1);
        break;
      case "Home":
        moveFocus(addDays(focusDate, -mondayIndex(focusDate)), 1);
        break;
      case "End":
        moveFocus(addDays(focusDate, 6 - mondayIndex(focusDate)), -1);
        break;
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
    const cell = gridRef.current?.querySelector<HTMLButtonElement>(
      `[data-iso="${formatISODate(focusDate)}"]`,
    );
    cell?.focus();
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
  const echo = parsed?.candidate && text.trim() !== "" ? `→ ${formatValue(parsed.candidate)}` : "";

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
          placeholder={placeholder}
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
                  aria-label="Previous month"
                  onClick={() =>
                    setView((v) => viewOf(addMonthsClamped(new Date(v.year, v.month, 1), -1)))
                  }
                >
                  ‹
                </button>
                <div className={styles.monthLabel}>{monthLabel}</div>
                <button
                  type="button"
                  className={styles.nav}
                  aria-label="Next month"
                  onClick={() =>
                    setView((v) => viewOf(addMonthsClamped(new Date(v.year, v.month, 1), 1)))
                  }
                >
                  ›
                </button>
              </div>

              {/* A real <table> — a month IS tabular data, and the native
                  row/columnheader/gridcell semantics come free. Roving
                  tabindex: exactly one day button is tabbable. */}
              <table
                id={gridId}
                ref={gridRef}
                aria-label={`Calendar, ${monthLabel}`}
                className={styles.calendar}
                onKeyDown={handleGridKeyDown}
              >
                <thead>
                  <tr>
                    {showWeekNumbers ? <th className={styles.weekdayLabel} /> : null}
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
                    return (
                      <tr key={formatISODate(first.date)}>
                        {showWeekNumbers ? (
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
                          const dayDisabled = isDayDisabled(date);
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
