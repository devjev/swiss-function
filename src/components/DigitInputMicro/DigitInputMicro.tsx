import { Input as BaseInput } from "@base-ui/react/input";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import type { BoxElevation } from "../Box";
import styles from "./DigitInputMicro.module.css";
import { clamp, formatValue, parseDraft, sanitizeDraft } from "./digitInputMicroFormat";

export type DigitInputMicroSize = "sm" | "md" | "lg";

export interface DigitInputMicroProps
  extends Omit<ComponentPropsWithoutRef<"span">, "defaultValue" | "onChange"> {
  /** Number of faded placeholder digit slots shown at rest (the "mask" hint).
   *  The field is variable-length — typing past the slots just grows the number.
   *  Default `4`. */
  slots?: number;
  /** Decimal places allowed. `0` (default) is integer-only; `> 0` permits a
   *  single decimal point, capped to this many places. */
  decimals?: number;
  /** Suffix rendered inside the control after the digits, e.g. `"%"`. */
  unit?: ReactNode;
  /** Glyph used for the empty placeholder slots. Default `"░"` — a dithered
   *  shade block, matching the library's dither vocabulary. */
  placeholderChar?: string;
  /** Controlled value. `null` is the empty field. */
  value?: number | null;
  /** Initial value when uncontrolled. Default `null` (empty). */
  defaultValue?: number | null;
  /** Fired with the parsed value after every edit. `null` while the field is
   *  empty or holds an incomplete number (a lone `-` or `.`). */
  onValueChange?: (value: number | null) => void;
  /** Lower bound. Enables negative input when negative; clamps on blur. */
  min?: number;
  /** Upper bound. Clamps on blur. */
  max?: number;
  /** Control size, mirroring `Input`. Default `md`. */
  size?: DigitInputMicroSize;
  /** Resting depth — same `--sf-elevation-N` scale as Box. Default 2. */
  elevation?: BoxElevation;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  /** Form field name; submits the canonical numeric string. */
  name?: string;
  /** Accessible name when not wrapped in a Field. */
  "aria-label"?: string;
  "aria-labelledby"?: string;
}

const sizeClass: Record<DigitInputMicroSize, string> = {
  sm: styles.sizeSm ?? "",
  md: "",
  lg: styles.sizeLg ?? "",
};

/**
 * Variable-length numeric input that shows a few faded placeholder digit slots
 * at rest and fills them left-to-right as you type — the "mask" feel — but never
 * caps length. The lighter sibling of `DigitInput` (a fixed-capacity grid of
 * digit cells): this is a single, ordinary text input, so caret, selection,
 * backspace and paste are all native. Value is `number | null`.
 */
export const DigitInputMicro = forwardRef<HTMLSpanElement, DigitInputMicroProps>(
  function DigitInputMicro(
    {
      slots = 4,
      decimals = 0,
      unit,
      placeholderChar = "░",
      value,
      defaultValue = null,
      onValueChange,
      min,
      max,
      size = "md",
      elevation,
      disabled,
      readOnly,
      required,
      name,
      className,
      ...rest
    },
    ref,
  ) {
    const allowNegative = min == null || min < 0;
    const sanitizeOpts = useMemo(() => ({ decimals, allowNegative }), [decimals, allowNegative]);

    // Lossy-controlled: the draft string is the source of truth (an incomplete
    // "1." has no number to mirror). A controlled `value` only overwrites the
    // draft when it reports a *different* number than the draft currently holds,
    // so typing "1." doesn't get clobbered by the prop echoing back `1`.
    const [draft, setDraft] = useState<string>(() => formatValue(defaultValue));
    const isControlled = value !== undefined;
    const lastReported = useRef<number | null>(parseDraft(draft));

    // Sync a controlled value into the draft, but only when it reports a number
    // different from what the draft already holds — otherwise an incomplete "1."
    // would be clobbered by the prop echoing back `1`.
    useEffect(() => {
      if (!isControlled) return;
      const external = value ?? null;
      if (external !== lastReported.current) {
        lastReported.current = external;
        setDraft(formatValue(external));
      }
    }, [isControlled, value]);

    const report = (nextDraft: string) => {
      const parsed = parseDraft(nextDraft);
      if (parsed !== lastReported.current) {
        lastReported.current = parsed;
        onValueChange?.(parsed);
      }
    };

    const handleChange = (raw: string) => {
      if (readOnly || disabled) return;
      const next = sanitizeDraft(raw, sanitizeOpts);
      setDraft(next);
      report(next);
    };

    const handleBlur = () => {
      if (readOnly || disabled) return;
      const parsed = parseDraft(draft);
      const clamped = clamp(parsed, min, max);
      if (clamped !== parsed) {
        const next = formatValue(clamped);
        setDraft(next);
        report(next);
      }
    };

    const remaining = Math.max(slots - draft.length, 0);
    const ghost = placeholderChar.repeat(remaining);
    // Width grows with content but never drops below the slot hint, so the ghost
    // slots always fit. `ch` is exact in a monospace face.
    const cols = Math.max(slots, draft.length, 1);

    return (
      <span
        {...rest}
        ref={ref}
        className={cx(styles.root, sizeClass[size], className)}
        data-elevation={elevation}
        data-disabled={disabled || undefined}
        data-readonly={readOnly || undefined}
      >
        {/* Ghost layer: an invisible copy of the draft offsets the muted slots so
          they begin exactly at the caret. Same font/padding as the input. */}
        <span aria-hidden="true" className={styles.ghost}>
          <span className={styles.ghostTyped}>{draft}</span>
          <span className={styles.ghostSlots}>{ghost}</span>
        </span>
        <BaseInput
          className={styles.input}
          style={{ inlineSize: `${cols}ch` }}
          value={draft}
          onValueChange={handleChange}
          onBlur={handleBlur}
          inputMode={decimals > 0 ? "decimal" : "numeric"}
          autoComplete="off"
          spellCheck={false}
          name={name}
          disabled={disabled}
          readOnly={readOnly}
          required={required}
        />
        {unit != null && <span className={styles.unit}>{unit}</span>}
      </span>
    );
  },
);
