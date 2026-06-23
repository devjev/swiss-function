import { useState } from "react";
import { cx } from "../../lib/cx";
import { Button } from "../Button";
import { Checkbox } from "../Checkbox";
import { Input } from "../Input";
import { Popover } from "../Popover";
import styles from "./ColumnFilter.module.css";

export type ColumnFilterKind = "checklist" | "range";
export type FilterOption = { value: string; label: string };

interface ColumnFilterProps {
  /** Column header text, for the trigger's accessible label. */
  label: string;
  kind: ColumnFilterKind;
  /** Selectable values for the checklist (ignored for `range`). */
  options: FilterOption[];
  /** Current filter value: `string[]` (checklist) or `[min?, max?]` (range), or
   *  `undefined` when the column is unfiltered. */
  value: unknown;
  /** Whether a filter is currently active (drives the funnel's filled state). */
  active: boolean;
  /** Set the filter value; pass `undefined` to clear the column's filter. */
  onChange: (value: unknown) => void;
}

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
  const allValues = options.map((o) => o.value);
  // Unfiltered (value undefined) reads as "everything checked", mirroring Excel.
  const allowed = Array.isArray(value) ? new Set(value as string[]) : new Set(allValues);
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  const allChecked = allValues.every((v) => allowed.has(v));
  const noneChecked = allValues.every((v) => !allowed.has(v));

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
      <div className={styles.options} role="group">
        {shown.map((o) => (
          <div key={o.value} className={styles.row}>
            <Checkbox
              checked={allowed.has(o.value)}
              onCheckedChange={(checked) => toggle(o.value, checked)}
              aria-label={o.label}
            />
            <span className={styles.optionLabel}>{o.label}</span>
          </div>
        ))}
        {shown.length === 0 ? <div className={styles.noMatch}>No matches</div> : null}
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
  return (
    <Popover.Root>
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
                kind === "range" || options.length > 6
                  ? "calc(var(--sf-unit) * 3 / 8)"
                  : "calc(var(--sf-unit) * 3 / 16)",
              paddingInline: "calc(var(--sf-unit) * 3 / 16)",
            }}
          >
            {kind === "range" ? (
              <RangeFilter value={value} onChange={onChange} />
            ) : (
              <Checklist options={options} value={value} onChange={onChange} />
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
