import { useVirtualizer } from "@tanstack/react-virtual";
import { useMemo, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { Checkbox } from "../../components/Checkbox";
import { Input } from "../../components/Input";
import { Popover } from "../../components/Popover";
import { cx } from "../cx";
import styles from "./ColumnFilter.module.css";

export type ColumnFilterKind = "checklist" | "range";
export type FilterOption = { value: string; label: string };

interface ColumnFilterProps {
  /** Column header text, for the trigger's accessible label. */
  label: string;
  kind: ColumnFilterKind;
  /** Selectable values for the checklist (ignored for `range`). A function is
   *  a lazy getter, called on first open — high-cardinality columns defer the
   *  distinct-value scan until the funnel is actually used (#17). */
  options: FilterOption[] | (() => FilterOption[]);
  /** Current filter value: `string[]` (checklist) or `[min?, max?]` (range), or
   *  `undefined` when the column is unfiltered. */
  value: unknown;
  /** Whether a filter is currently active (drives the funnel's filled state). */
  active: boolean;
  /** Set the filter value; pass `undefined` to clear the column's filter. */
  onChange: (value: unknown) => void;
}

/** Fixed checklist row height (px) — the virtualizer's window unit. */
const OPTION_ROW_PX = 24;

const NO_OPTIONS: FilterOption[] = [];

function FunnelIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 16 16" width="1em" height="1em" aria-hidden="true" className={styles.funnel}>
      <path
        d="M2.5 3.5h11L9.5 8.5V12l-3 1.5V8.5z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Checklist({
  options,
  value,
  onChange,
}: {
  options: FilterOption[];
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const allValues = useMemo(() => options.map((o) => o.value), [options]);
  // Unfiltered (value undefined) reads as "everything checked", mirroring Excel.
  const allowed = useMemo(
    () => (Array.isArray(value) ? new Set(value as string[]) : new Set(allValues)),
    [value, allValues],
  );
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = useMemo(
    () => (q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options),
    [options, q],
  );
  const allChecked = allValues.every((v) => allowed.has(v));
  const noneChecked = allValues.every((v) => !allowed.has(v));

  // Window the option rows — a 10k-distinct column otherwise mounts 10k
  // checkbox components per open/keystroke (seconds-long lock, #17). Same
  // useVirtualizer idiom as Selector/DataTable; rows are plain divs, so
  // windowing has no composite-registration constraints.
  const listRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: shown.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => OPTION_ROW_PX,
    overscan: 8,
  });

  // Selecting everything clears the filter (no-op); any subset becomes the filter.
  const commit = (next: Set<string>) => {
    onChange(
      allValues.every((v) => next.has(v)) ? undefined : allValues.filter((v) => next.has(v)),
    );
  };
  const toggle = (v: string, checked: boolean) => {
    const next = new Set(allowed);
    if (checked) next.add(v);
    else next.delete(v);
    commit(next);
  };

  return (
    <div className={styles.checklist}>
      {options.length > 6 ? (
        <Input
          inputSize="sm"
          type="text"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          aria-label="Search values"
        />
      ) : null}
      <div className={cx(styles.row, styles.selectAll)}>
        <Checkbox
          checked={allChecked}
          indeterminate={!allChecked && !noneChecked}
          onCheckedChange={(checked) => commit(checked ? new Set(allValues) : new Set())}
          aria-label="Select all"
        />
        <span>Select all</span>
      </div>
      <div ref={listRef} className={styles.options} role="group">
        {shown.length === 0 ? (
          <div className={styles.noMatch}>No matches</div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((vr) => {
              const o = shown[vr.index] as FilterOption;
              return (
                <div
                  key={o.value}
                  className={styles.row}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    height: vr.size,
                    transform: `translateY(${vr.start}px)`,
                  }}
                >
                  <Checkbox
                    checked={allowed.has(o.value)}
                    onCheckedChange={(checked) => toggle(o.value, checked)}
                    aria-label={o.label}
                  />
                  <span className={styles.optionLabel}>{o.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function RangeFilter({ value, onChange }: { value: unknown; onChange: (value: unknown) => void }) {
  const [min, max] = Array.isArray(value)
    ? (value as [number | undefined, number | undefined])
    : [undefined, undefined];
  const commit = (lo: number | undefined, hi: number | undefined) => {
    onChange(lo == null && hi == null ? undefined : [lo, hi]);
  };
  const parse = (s: string) => (s === "" ? undefined : Number(s));
  return (
    <div className={styles.range}>
      <Input
        inputSize="sm"
        type="number"
        placeholder="Min"
        value={min ?? ""}
        onChange={(e) => commit(parse(e.currentTarget.value), max)}
        aria-label="Minimum"
      />
      <span className={styles.rangeDash} aria-hidden="true">
        –
      </span>
      <Input
        inputSize="sm"
        type="number"
        placeholder="Max"
        value={max ?? ""}
        onChange={(e) => commit(min, parse(e.currentTarget.value))}
        aria-label="Maximum"
      />
    </div>
  );
}

/** Funnel trigger + anchored popover with a value checklist or a numeric range,
 *  applied live. Rendered inside a header cell by the DataTable. */
export function ColumnFilter({ label, kind, options, value, active, onChange }: ColumnFilterProps) {
  // Open is tracked so lazy `options` getters resolve only while the popover
  // is up — closed funnels never pay for a distinct-value scan (#17). Cached
  // upstream, so re-resolving per open/table render is a map hit.
  const [open, setOpen] = useState(false);
  const resolved = useMemo(
    () =>
      open && kind === "checklist"
        ? typeof options === "function"
          ? options()
          : options
        : NO_OPTIONS,
    [open, kind, options],
  );
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      {/* Stop the funnel from toggling header sort or starting a column reorder. */}
      <Popover.Trigger
        className={cx(styles.button, active && styles.buttonActive)}
        aria-label={`Filter ${label}`}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        <FunnelIcon filled={active} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6}>
          {/* Override the Popover's default 0.75u Box padding. Sides stay tight
              (the `tight` Button's 3/16u); only the block padding grows to 3/8u
              when the popover holds a full-size input (range, or a searchable
              checklist) so the field doesn't crowd the top/bottom edges. */}
          <Popover.Popup
            className={styles.popup}
            style={{
              paddingBlock:
                kind === "range" || resolved.length > 6
                  ? "calc(var(--sf-unit) * 3 / 8)"
                  : "calc(var(--sf-unit) * 3 / 16)",
              paddingInline: "calc(var(--sf-unit) * 3 / 16)",
            }}
          >
            {kind === "range" ? (
              <RangeFilter value={value} onChange={onChange} />
            ) : (
              <Checklist options={resolved} value={value} onChange={onChange} />
            )}
            <div className={styles.footer}>
              <Button size="sm" variant="ghost" tight onClick={() => onChange(undefined)}>
                Clear
              </Button>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
