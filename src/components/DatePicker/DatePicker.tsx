import { Popover as BasePopover } from "@base-ui/react/popover";
import type { FocusEvent, HTMLAttributes, KeyboardEvent } from "react";
import { Fragment, forwardRef, useEffect, useId, useMemo, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import type { DateLevel, DatePickerPrecision } from "../../lib/date";
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
} from "../../lib/date";
import { Glyph } from "../../lib/icons";
import { usePortalContainer } from "../../lib/portalContainer";
import { StackingProvider, useStackLayer, Z_LAYER } from "../../lib/stacking";
import type { BoxElevation } from "../Box";
import { ChevronDown, X } from "../Icon";
import styles from "./DatePicker.module.css";
import {
  levelColumns,
  levelLabel,
  levelOptions,
  normalizePath,
  optionAriaLabel,
  optionLabel,
  stepUnit,
  YEAR_PAGE,
} from "./datePath";
import { type MonthView, type ParsedText, parseDateText } from "./parseDateText";

export type { DateLevel, DatePickerPrecision } from "../../lib/date";

const PLACEHOLDERS: Record<DateLevel, string> = {
  day: "YYYY-MM-DD",
  week: "YYYY-Www",
  month: "YYYY-MM",
  quarter: "YYYY-Qn",
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
  /** Veto a period on top of min/max (e.g. weekends, a month with no data).
   *  Called with the period's start and the level it is being picked at. On
   *  the calendar it is asked at day precision only (a coarser period has no
   *  single day to ask about); with `path` it is asked at **every** step, so a
   *  whole year, quarter, month or week can be greyed out. A step is not
   *  disabled because all its children are: say so at the step you mean, since
   *  scanning a year's days to find out would cost 365 calls per cell. */
  isDateDisabled?: (date: Date, level: DateLevel) => boolean;
  /** Pick the date by stepping down a path instead of from the calendar: the
   *  popup shows one level at a time, each pick narrowing the next (`["year",
   *  "month", "day"]` asks for the year, then the month, then the day). Each
   *  step must narrow the one before it, so a week follows a year (an ISO week
   *  straddles month ends) and a day follows a month or a week; a step that
   *  cannot is dropped with a warning. The first step carries its own context,
   *  so `["month", "day"]` picks within the year the paddles are on.
   *
   *  The last step is the precision: the value commits there and nowhere
   *  earlier, so `["year", "month"]` always hands back a month start. `path`
   *  wins over `precision`, and the field is read-only (the calendar's typing
   *  does not apply). */
  path?: DateLevel[];
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
    path,
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
  // Cross-portal stacking (issue #82): the calendar climbs above a Dialog/
  // Popover it opens inside; inert at the page root (keeps the CSS default).
  const { zIndex: stackZIndex, ceiling: stackCeiling } = useStackLayer(Z_LAYER.dropdown, false);
  // Portal into the popped-out window's body when inside a PopOut (issue #84).
  const portalContainer = usePortalContainer();
  const [today] = useState(() => startOfDay(new Date()));
  const [internal, setInternal] = useState<Date | null>(defaultValue ?? null);
  const isControlled = value !== undefined;
  const selected = isControlled ? value : internal;

  // --- Drill-down path ---
  // The steps the popup walks, each narrowing the one before it. An unusable
  // step is dropped rather than throwing; the warning says which, once.
  const steps = useMemo(() => (path ? normalizePath(path) : []), [path]);
  const pathMode = steps.length > 0;
  const pathWarned = useRef(false);
  if (path && path.length !== steps.length && !pathWarned.current) {
    pathWarned.current = true;
    console.warn(
      `DatePicker: path [${path.join(", ")}] has a step that does not narrow the one before it; using [${steps.join(", ")}].`,
    );
  }
  /** The unit the value commits at: the path's last step, else `precision`. */
  const commitLevel: DateLevel = pathMode ? (steps[steps.length - 1] as DateLevel) : precision;
  /** Which step of the path the popup is on. */
  const [stepIndex, setStepIndex] = useState(0);

  const placeholderText = placeholder ?? PLACEHOLDERS[commitLevel];
  const fmt = formatValue ?? ((d: Date) => formatPeriod(d, commitLevel));
  /** Field text for a value; normalizes so an un-normalized controlled value
   *  still displays as its period. */
  const displayValue = (d: Date | null) => (d ? fmt(startOfPeriod(d, commitLevel)) : "");

  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => displayValue(selected));
  const [view, setView] = useState<MonthView>(() => viewOf(selected ?? today));
  const [focusDate, setFocusDate] = useState<Date>(() =>
    startOfPeriod(selected ?? today, precision),
  );
  // Each opening starts the path at its first step, from the current value
  // (or today), so a reopen never resumes halfway down a trail the reader has
  // forgotten. Keyed on `open` alone: the other values are read, not watched.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above
  useEffect(() => {
    if (!open || !pathMode) return;
    setStepIndex(0);
    setFocusDate(startOfPeriod(selected ?? today, commitLevel));
  }, [open]);
  const [parsed, setParsed] = useState<ParsedText | null>(null);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLElement | null>(null);
  /** Set when a key/text action must move DOM focus to the grid cell. */
  const pendingGridFocus = useRef(false);
  const gridId = useId();

  /** Whether a period is out: outside min/max (by overlap), or vetoed. The
   *  calendar asks the veto at day precision only, as documented; a path step
   *  asks at every level and says which. */
  const isLevelDisabled = (d: Date, level: DateLevel): boolean => {
    if (periodDisabled(d, level, minDate, maxDate)) return true;
    if (!isDateDisabled) return false;
    if (pathMode) return isDateDisabled(startOfPeriod(d, level), level);
    return level === "day" ? isDateDisabled(d, "day") : false;
  };
  const isPeriodDisabled = (d: Date): boolean => isLevelDisabled(d, commitLevel);

  const commit = (d: Date | null) => {
    const norm = d ? startOfPeriod(d, commitLevel) : null;
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
    if (pathMode) {
      // Nothing to type: the keys open the path and hand over to its grid.
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
        pendingGridFocus.current = true;
        setFocusDate((d) => new Date(d));
        return;
      }
      if (e.key === "Escape" && open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
      return;
    }
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
    const selector = pathMode
      ? `[data-step="${formatISODate(stepOptions[stepFocusIndex] ?? focusDate)}"]`
      : precision === "day"
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
    // A keyboard pick replaces the whole step grid, so the focused cell is
    // removed and the browser parks focus on <body> with no relatedTarget.
    // That is the path walking, not focus leaving: the pending grid focus
    // lands in the new step a tick later.
    if (pathMode && next == null && pendingGridFocus.current) return;
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

  // --- Path mode: the current step, its options, its trail ------------------
  const stepLevel: DateLevel = pathMode
    ? ((steps[Math.min(stepIndex, steps.length - 1)] ?? commitLevel) as DateLevel)
    : commitLevel;
  const stepParent: DateLevel | undefined = stepIndex > 0 ? steps[stepIndex - 1] : undefined;
  const stepOptions = useMemo(
    () => (pathMode ? levelOptions(focusDate, stepLevel, stepParent) : []),
    [pathMode, focusDate, stepLevel, stepParent],
  );
  const stepCols = levelColumns(stepLevel);
  /** The focused option, else the first one that can be picked. */
  const stepFocusIndex = (() => {
    const exact = stepOptions.findIndex((d) => isSamePeriod(d, focusDate, stepLevel));
    if (exact >= 0) return exact;
    return stepOptions.findIndex((d) => !isLevelDisabled(d, stepLevel));
  })();
  const paddleUnit = stepUnit(steps, stepIndex);
  const paddleLabel = paddleUnit === "yearPage" ? "years" : paddleUnit;
  const stepPaddle = (dir: 1 | -1) =>
    setFocusDate((d) =>
      paddleUnit === "yearPage"
        ? addPeriods(d, dir * YEAR_PAGE, "year")
        : addPeriods(d, dir, paddleUnit),
    );
  const pickStep = (d: Date) => {
    if (isLevelDisabled(d, stepLevel)) return;
    if (stepIndex >= steps.length - 1) {
      commit(d);
      return;
    }
    // Carry the current value's deeper context when it sits inside the pick, so
    // re-picking the year lands back on the month it was already on.
    setFocusDate(selected && isSamePeriod(selected, d, stepLevel) ? selected : d);
    setStepIndex(stepIndex + 1);
  };
  const focusStepIndex = (i: number) => {
    const next = stepOptions[i];
    if (!next || isLevelDisabled(next, stepLevel)) return;
    setFocusDate(next);
    pendingGridFocus.current = true;
  };
  const handleStepKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    const move = (delta: number) => {
      let i = stepFocusIndex;
      for (let n = 0; n < stepOptions.length; n++) {
        i += delta;
        if (i < 0 || i >= stepOptions.length) return;
        const cand = stepOptions[i];
        if (cand && !isLevelDisabled(cand, stepLevel)) {
          setFocusDate(cand);
          pendingGridFocus.current = true;
          return;
        }
      }
    };
    switch (e.key) {
      case "ArrowLeft":
        move(-1);
        break;
      case "ArrowRight":
        move(1);
        break;
      case "ArrowUp":
        move(-stepCols);
        break;
      case "ArrowDown":
        move(stepCols);
        break;
      case "Home":
        focusStepIndex(stepOptions.findIndex((d) => !isLevelDisabled(d, stepLevel)));
        break;
      case "End":
        focusStepIndex(
          stepOptions.length -
            1 -
            [...stepOptions].reverse().findIndex((d) => !isLevelDisabled(d, stepLevel)),
        );
        break;
      case "PageUp":
        stepPaddle(-1);
        break;
      case "PageDown":
        stepPaddle(1);
        break;
      case "Enter":
      case " ": {
        const current = stepOptions[stepFocusIndex];
        if (current) {
          // The cell under focus is about to be replaced by the next step's
          // grid; the focus effect lands focus there (see handleRootBlur).
          pendingGridFocus.current = true;
          pickStep(current);
        }
        break;
      }
      case "Backspace":
        if (stepIndex > 0) {
          setStepIndex(stepIndex - 1);
          pendingGridFocus.current = true;
        }
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  /** The header's trail: the context the step sits in, then every value picked
   *  so far as a button back to that step. At the first year step there is no
   *  trail yet, so it reads the page of years instead. */
  const stepTrail: { key: string; label: string; index?: number }[] = [];
  if (pathMode) {
    const first = steps[0];
    if (first && first !== "year") {
      stepTrail.push({
        key: "context",
        label:
          first === "day"
            ? focusDate.toLocaleDateString(undefined, { month: "short", year: "numeric" })
            : formatISOYear(focusDate.getFullYear()),
      });
    }
    for (let i = 0; i < stepIndex; i++) {
      const lvl = steps[i];
      if (lvl) stepTrail.push({ key: `step-${i}`, label: levelLabel(focusDate, lvl), index: i });
    }
    if (stepTrail.length === 0) {
      const from = stepOptions[0];
      const to = stepOptions[stepOptions.length - 1];
      stepTrail.push({
        key: "page",
        label:
          from && to
            ? `${formatISOYear(from.getFullYear())}-${formatISOYear(to.getFullYear())}`
            : "",
      });
    }
  }
  // A step whose options scroll (a year of ISO weeks) opens on the one the
  // value is in, not on the first week of January. Focus is not moved: the
  // field keeps it until the reader walks into the grid.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the step's identity is what re-aims it; the cell is read from the DOM
  useEffect(() => {
    if (!open || !pathMode) return;
    gridRef.current
      ?.querySelector<HTMLElement>('[data-step][tabindex="0"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [open, pathMode, stepIndex, stepLevel]);

  /** The day step's rows: a week's seven, or the month grid it sits in. */
  const stepDayRows = useMemo(() => {
    if (!pathMode || stepLevel !== "day") return [];
    if (stepParent === "week") return [stepOptions.map((date) => ({ date, inMonth: true }))];
    const grid = monthGrid(focusDate.getFullYear(), focusDate.getMonth());
    return Array.from({ length: 6 }, (_, r) => grid.slice(r * 7, r * 7 + 7));
  }, [pathMode, stepLevel, stepParent, stepOptions, focusDate]);

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
          readOnly={pathMode}
          onChange={pathMode ? undefined : (e) => handleTextChange(e.target.value)}
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
            <Glyph slot="close" fallback={X} size="0.85em" />
          </button>
        ) : null}
        {/* The field's affordance, as on Picker: a chevron that opens the
            calendar and turns over while it is open. The input owns the
            semantics (role, aria-expanded), so this stays off the tab order,
            and keeping focus off it on mousedown means closing does not bounce
            through the input's focus handler and reopen the calendar. */}
        <button
          type="button"
          className={styles.trigger}
          tabIndex={-1}
          disabled={disabled}
          aria-label={open ? "Hide calendar" : "Show calendar"}
          aria-expanded={open}
          aria-controls={gridId}
          data-popup-open={open || undefined}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            if (open) {
              setOpen(false);
              return;
            }
            setOpen(true);
            inputRef.current?.focus();
          }}
        >
          <Glyph slot="chevronDown" fallback={ChevronDown} size="0.85em" />
        </button>
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
        <BasePopover.Portal container={portalContainer ?? undefined}>
          <StackingProvider ceiling={stackCeiling}>
            <BasePopover.Positioner
              anchor={rootRef}
              sideOffset={4}
              align="start"
              className={styles.positioner}
              style={stackZIndex != null ? { zIndex: stackZIndex } : undefined}
            >
              <BasePopover.Popup
                ref={popupRef}
                className={styles.popup}
                data-path={pathMode || undefined}
                initialFocus={false}
                finalFocus={false}
              >
                {pathMode ? (
                  <>
                    {/* The trail: where the path is, and a way back up it. The
                        paddles step the context (the year over a month, the
                        month over a day, a page of years at the top). */}
                    <div className={styles.header}>
                      <button
                        type="button"
                        className={styles.nav}
                        aria-label={`Previous ${paddleLabel}`}
                        onClick={() => stepPaddle(-1)}
                      >
                        ‹
                      </button>
                      <div className={styles.trail}>
                        {stepTrail.map((crumb, i) => (
                          <Fragment key={crumb.key}>
                            {i > 0 ? (
                              <span aria-hidden="true" className={styles.trailSeparator}>
                                ›
                              </span>
                            ) : null}
                            {crumb.index != null ? (
                              <button
                                type="button"
                                className={styles.crumb}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setStepIndex(crumb.index as number)}
                              >
                                {crumb.label}
                              </button>
                            ) : (
                              <span className={styles.crumbStatic}>{crumb.label}</span>
                            )}
                          </Fragment>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={styles.nav}
                        aria-label={`Next ${paddleLabel}`}
                        onClick={() => stepPaddle(1)}
                      >
                        ›
                      </button>
                    </div>

                    {stepLevel === "day" ? (
                      /* The day step is the calendar's own grid: a week's seven
                         days in one row, or the month the step sits in. */
                      <table
                        id={gridId}
                        ref={(el) => {
                          gridRef.current = el;
                        }}
                        aria-label="Pick a day"
                        className={styles.calendar}
                        onKeyDown={handleStepKeyDown}
                      >
                        <thead>
                          <tr>
                            {weekdays.map((w) => (
                              <th key={w} scope="col" className={styles.weekdayLabel}>
                                {w}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {stepDayRows.map((row) => (
                            <tr key={formatISODate(row[0]?.date ?? focusDate)}>
                              {row.map(({ date, inMonth }) => {
                                const iso = formatISODate(date);
                                if (!inMonth) {
                                  return (
                                    <td key={iso} className={styles.dayStatic} data-outside="">
                                      {date.getDate()}
                                    </td>
                                  );
                                }
                                const isSel = selected ? isSameDay(date, selected) : false;
                                return (
                                  <td key={iso}>
                                    <button
                                      type="button"
                                      className={styles.day}
                                      tabIndex={
                                        stepOptions[stepFocusIndex] &&
                                        isSameDay(date, stepOptions[stepFocusIndex] as Date)
                                          ? 0
                                          : -1
                                      }
                                      disabled={isLevelDisabled(date, "day")}
                                      aria-label={iso}
                                      aria-pressed={isSel}
                                      data-step={iso}
                                      data-selected={isSel || undefined}
                                      data-today={isSameDay(date, today) || undefined}
                                      onMouseDown={(e) => e.preventDefault()}
                                      onClick={() => pickStep(date)}
                                    >
                                      {date.getDate()}
                                    </button>
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div
                        id={gridId}
                        ref={(el) => {
                          gridRef.current = el;
                        }}
                        role="listbox"
                        aria-label={`Pick a ${stepLevel}`}
                        className={cx(styles.periodGrid, stepLevel === "week" && styles.stepScroll)}
                        data-cols={stepCols}
                        onKeyDown={handleStepKeyDown}
                      >
                        {stepOptions.map((d, i) => {
                          const isSel = selected ? isSamePeriod(d, selected, stepLevel) : false;
                          return (
                            <button
                              key={formatISODate(d)}
                              type="button"
                              role="option"
                              className={styles.periodCell}
                              tabIndex={i === stepFocusIndex ? 0 : -1}
                              disabled={isLevelDisabled(d, stepLevel)}
                              aria-selected={isSel}
                              aria-label={optionAriaLabel(d, stepLevel)}
                              data-step={formatISODate(d)}
                              data-selected={isSel || undefined}
                              data-today={isSamePeriod(d, today, stepLevel) || undefined}
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => pickStep(d)}
                            >
                              {optionLabel(d, stepLevel)}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* What the step is asking for, announced as it changes. */}
                    <div className={styles.echo} aria-live="polite">
                      {`Pick a ${stepLevel}`}
                    </div>
                  </>
                ) : (
                  <>
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
                                  ? date.toLocaleDateString(undefined, {
                                      month: "long",
                                      year: "numeric",
                                    })
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
                              const isSel = selected
                                ? isSamePeriod(monday, selected, "week")
                                : false;
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
                  </>
                )}
              </BasePopover.Popup>
            </BasePopover.Positioner>
          </StackingProvider>
        </BasePopover.Portal>
      </BasePopover.Root>
    </div>
  );
});
