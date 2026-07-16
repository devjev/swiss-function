import { Input as BaseInput } from "@base-ui/react/input";
import * as OTPFieldNS from "@base-ui/react/otp-field";
import type {
  ComponentPropsWithoutRef,
  ClipboardEvent as ReactClipboardEvent,
  InputEvent as ReactInputEvent,
  KeyboardEvent as ReactKeyboardEvent,
  ReactNode,
  Ref,
} from "react";
import { Fragment, forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import type { BoxElevation } from "../Box";
import styles from "./DigitInput.module.css";
import type { DigitConfig, Sign } from "./digitMath";
import {
  capacityMax,
  formatValueText,
  maskStringToUlps,
  normalizeConfig,
  parseDecimalText,
  popDigit,
  pushDigit,
  signedCanonical,
  signedToValue,
  stepSigned,
  stepUlps,
  ulpsToCanonical,
  ulpsToCells,
  ulpsToMaskString,
  ulpsToValue,
  valueToSignedParts,
  valueToUlps,
} from "./digitMath";

// Base UI ships the OTP field as the preview export `OTPFieldPreview` in 1.5,
// then promotes it to `OTPField` in later 1.x. Our peer range (`^1.5.0`) spans
// that rename, so a *named* import breaks on whichever version doesn't match
// (issue #42). Resolve it from the namespace at runtime and pick whichever
// exists — a namespace import never fails on an absent name, so the module
// always loads (push mode keeps working even if the OTP field is ever gone) and
// only the mask path touches the resolved compound.
const OTPField = ((OTPFieldNS as Record<string, unknown>).OTPField ??
  (OTPFieldNS as Record<string, unknown>)
    .OTPFieldPreview) as typeof import("@base-ui/react/otp-field").OTPFieldPreview;

export type DigitInputSize = "sm" | "md" | "lg";
export type DigitInputMode = "push" | "mask";

export interface DigitInputProps
  extends Omit<ComponentPropsWithoutRef<"span">, "defaultValue" | "onChange"> {
  /** Integer places. Required — the capacity IS the input's contract. */
  digits: number;
  /** Decimal places. Default `0`. */
  decimals?: number;
  /** Typing model. `"push"` (default) is the calculator: one focus target,
   *  digits push in from the right, the value is always complete. `"mask"` is
   *  the 2FA style: each cell is a focus stop, typing fills left-to-right with
   *  auto-advance, and the value stays `null` until every cell is filled. */
  mode?: DigitInputMode;
  /** Display glyph between integer and decimal cells. Default `"."`. Display
   *  only — the form/clipboard value always uses `"."`. */
  decimalSeparator?: ReactNode;
  /** Suffix rendered inside the control after the cells, e.g. `"%"`. */
  unit?: ReactNode;
  /** Allow negative values: renders a leading `+`/`-` sign cell (click to
   *  toggle, or type `-`/`+`), lets ArrowDown cross zero, and the value/form
   *  string carry the sign. `push` mode only. Default `false`. */
  signed?: boolean;
  /** Controlled value. `null` is the pristine untyped mask. */
  value?: number | null;
  /** Initial value when uncontrolled. Default `null` (pristine). */
  defaultValue?: number | null;
  /** Fired with the parsed value after every edit. `push`: values are always
   *  complete (untyped positions read as 0); `null` when the last digit is
   *  popped. `mask`: `null` until every cell is filled. */
  onValueChange?: (value: number | null) => void;
  /** Control size, mirroring `Input`. Default `md`. */
  size?: DigitInputSize;
  /** Resting cell depth — same `--sf-elevation-N` scale as Box. Default 2. */
  elevation?: BoxElevation;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  /** Form field name; submits the canonical string (e.g. `"4.25"`). */
  name?: string;
}

const sizeClass: Record<DigitInputSize, string> = {
  sm: styles.sizeSm ?? "",
  md: "",
  lg: styles.sizeLg ?? "",
};

/**
 * Fixed-capacity numeric input rendered as individual digit cells —
 * `[0][4][2].[5][0] %`. Two typing models: the calculator "push" default
 * (custom engine over a hidden input) and the 2FA-style "mask" (Base UI
 * OTPField). Push deliberately does NOT use OTPField — per-cell focus and
 * string values are the opposite of the calculator model.
 */
export const DigitInput = forwardRef<HTMLSpanElement, DigitInputProps>(function DigitInput(
  { mode = "push", ...props },
  ref,
) {
  // Separate components so a mode flip remounts cleanly (their hook shapes
  // differ) — mode is not meant to change at runtime.
  return mode === "mask" ? (
    <MaskDigitInput {...props} ref={ref} />
  ) : (
    <PushDigitInput {...props} ref={ref} />
  );
});

type VariantProps = Omit<DigitInputProps, "mode">;

// --- Push variant: calculator model on a hidden capture input ---------------

const PushDigitInput = forwardRef<HTMLSpanElement, VariantProps>(function PushDigitInput(
  {
    digits,
    decimals = 0,
    decimalSeparator = ".",
    unit,
    signed = false,
    value,
    defaultValue = null,
    onValueChange,
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
  const config = useMemo(() => normalizeConfig(digits, decimals), [digits, decimals]);
  const total = config.digits + config.decimals;

  const [internalUlps, setInternalUlps] = useState<number | null>(
    () => valueToSignedParts(defaultValue, config).ulps,
  );
  const [internalSign, setInternalSign] = useState<Sign>(() =>
    signed ? valueToSignedParts(defaultValue, config).sign : 1,
  );
  const isControlled = value !== undefined;
  // Controlled parse keeps sign only when `signed`; otherwise a negative prop
  // clamps to 0 exactly as before (valueToUlps floors negatives).
  const controlled = useMemo(() => {
    if (!isControlled) return null;
    if (signed) return valueToSignedParts(value, config);
    const r = valueToUlps(value, config);
    return { ulps: r.ulps, sign: 1 as Sign, clamped: r.clamped };
  }, [isControlled, signed, value, config]);
  const ulps = isControlled ? (controlled?.ulps ?? null) : internalUlps;
  const sign: Sign = signed ? (isControlled ? (controlled?.sign ?? 1) : internalSign) : 1;

  useClampWarning(controlled?.clamped === true, value, config);

  // Restarts the .bump animation on the least-significant cell per edit.
  const [editStamp, setEditStamp] = useState(0);

  const inputRef = useRef<HTMLInputElement | null>(null);

  const apply = useCallback(
    (nextUlps: number | null, nextSign: Sign = sign) => {
      const effSign: Sign = signed ? nextSign : 1;
      if (nextUlps === ulps && effSign === sign) return;
      setEditStamp((s) => s + 1);
      if (!isControlled) {
        setInternalUlps(nextUlps);
        setInternalSign(effSign);
      }
      onValueChange?.(
        signed ? signedToValue(nextUlps, effSign, config) : ulpsToValue(nextUlps, config),
      );
    },
    [ulps, sign, signed, isControlled, onValueChange, config],
  );

  /** The hidden input / form / clipboard string, sign included when signed. */
  const canonical = signed ? signedCanonical(ulps, sign, config) : ulpsToCanonical(ulps, config);

  const separatorString = typeof decimalSeparator === "string" ? decimalSeparator : ".";

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (readOnly || disabled) return;
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      apply(pushDigit(ulps, Number(e.key), config));
    } else if (signed && (e.key === "-" || e.key === "+")) {
      e.preventDefault();
      apply(ulps, e.key === "-" ? -1 : 1);
    } else if (e.key === "Backspace") {
      e.preventDefault();
      const next = popDigit(ulps);
      // Popping the last digit returns to pristine, which is positive.
      apply(next, next === null ? 1 : sign);
    } else if (e.key === "Delete") {
      e.preventDefault();
      apply(null, 1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      const dir = e.key === "ArrowUp" ? 1 : -1;
      if (signed) {
        const stepped = stepSigned(ulps, sign, dir, config);
        apply(stepped.ulps, stepped.sign);
      } else {
        apply(stepUlps(ulps, dir, config));
      }
    }
    // Everything else falls through: Enter (form submit / Field validation
    // commit), Tab, Escape, shortcuts. Separator keys land in onBeforeInput
    // where they extract no digits — a silent no-op by design.
  };

  // Mobile fallback: some virtual keyboards emit key "Unidentified" on
  // keydown, so the push/pop must also work from beforeinput. When keydown
  // handled a key, its preventDefault stops beforeinput from firing at all —
  // no double-processing.
  const handleBeforeInput = (e: ReactInputEvent<HTMLInputElement>) => {
    const native = e.nativeEvent;
    if (native.isComposing) return;
    if (readOnly || disabled) {
      e.preventDefault();
      return;
    }
    if (native.inputType === "insertText") {
      e.preventDefault();
      let next = ulps;
      let nextSign = sign;
      for (const ch of native.data ?? "") {
        if (/[0-9]/.test(ch)) next = pushDigit(next, Number(ch), config);
        else if (signed && (ch === "-" || ch === "+")) nextSign = ch === "-" ? -1 : 1;
      }
      apply(next, nextSign);
    } else if (native.inputType === "deleteContentBackward") {
      e.preventDefault();
      const next = popDigit(ulps);
      apply(next, next === null ? 1 : sign);
    }
  };

  const handlePaste = (e: ReactClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (readOnly || disabled) return;
    const raw = e.clipboardData.getData("text/plain");
    const parsed = parseDecimalText(raw, separatorString, config);
    if (parsed !== null) apply(parsed, signed && /^\s*-/.test(raw) ? -1 : 1);
  };

  // Autofill / browser form-restore net: the only way the native value can
  // change (we preventDefault all typing), so re-parse whatever landed.
  const handleExternalChange = (raw: string) => {
    if (raw === canonical) return;
    if (raw === "") {
      apply(null, 1);
      return;
    }
    apply(parseDecimalText(raw, ".", config), signed && /^\s*-/.test(raw) ? -1 : 1);
  };

  // IME recovery: composition inserts are not cancelable, so re-assert the
  // canonical string straight onto the DOM (React skips it when state is
  // unchanged, which is exactly the case after a swallowed composition).
  const handleCompositionEnd = () => {
    const el = inputRef.current;
    if (el) el.value = canonical;
  };

  // Native form reset: restore the uncontrolled default after the browser has
  // done its own reset work.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const onReset = () => {
      queueMicrotask(() => {
        if (isControlled) return;
        const parts = valueToSignedParts(defaultValue, config);
        setInternalUlps(parts.ulps);
        setInternalSign(signed ? parts.sign : 1);
      });
    };
    form.addEventListener("reset", onReset);
    return () => form.removeEventListener("reset", onReset);
  }, [isControlled, defaultValue, config, signed]);

  const cells = ulpsToCells(ulps, config);
  const maxValue = ulpsToValue(capacityMax(config), config) ?? undefined;
  const numericValue = signed ? signedToValue(ulps, sign, config) : ulpsToValue(ulps, config);
  // aria-valuetext: reuse the magnitude formatter, prefix a minus when negative.
  const valueText =
    signed && sign < 0 && ulps != null && ulps > 0
      ? `-${formatValueText(ulps, config, unit)}`
      : formatValueText(ulps, config, unit);

  return (
    <span
      {...rest}
      ref={ref}
      className={cx(styles.root, sizeClass[size], className)}
      data-elevation={elevation}
      data-disabled={disabled || undefined}
      data-readonly={readOnly || undefined}
    >
      <span aria-hidden="true" className={styles.cells}>
        {signed && (
          // biome-ignore lint/a11y/noStaticElementInteractions: a mouse-only affordance inside the aria-hidden cells; the keyboard path is the spinbutton input's -/+ handling, which carries all a11y.
          <span
            className={cx(styles.cell, styles.signCell)}
            data-cell=""
            data-sign={sign < 0 ? "minus" : "plus"}
            // Mouse affordance for the sign (keyboard types -/+). mousedown so
            // focus stays on the input; a click never blurs the control.
            onMouseDown={(e) => {
              e.preventDefault();
              if (readOnly || disabled) return;
              apply(ulps, sign < 0 ? 1 : -1);
              inputRef.current?.focus();
            }}
          >
            {sign < 0 ? "-" : "+"}
          </span>
        )}
        {Array.from({ length: total }, (_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: cells have no identity beyond their position — index keys are the correct semantics here.
          <Fragment key={i}>
            {config.decimals > 0 && i === config.digits && (
              <span className={styles.sep}>{decimalSeparator}</span>
            )}
            <span
              key={i === total - 1 ? `lsd-${editStamp}` : `cell-${i}`}
              className={cx(styles.cell, i === total - 1 && editStamp > 0 && styles.bump)}
              data-cell=""
              data-active={i === total - 1 || undefined}
              data-empty={cells === null || undefined}
            >
              {cells === null ? "_" : cells[i]}
            </span>
          </Fragment>
        ))}
        {unit != null && <span className={styles.unit}>{unit}</span>}
      </span>
      <BaseInput
        ref={inputRef}
        className={styles.input}
        value={canonical}
        onValueChange={handleExternalChange}
        onKeyDown={handleKeyDown}
        onBeforeInput={handleBeforeInput}
        onPaste={handlePaste}
        onCompositionEnd={handleCompositionEnd}
        role="spinbutton"
        aria-valuemin={signed && maxValue != null ? -maxValue : 0}
        aria-valuemax={maxValue}
        aria-valuenow={numericValue ?? undefined}
        aria-valuetext={valueText}
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        name={name}
        disabled={disabled}
        readOnly={readOnly}
        required={required}
      />
    </span>
  );
});

// --- Mask variant: 2FA model on Base UI's OTPField ---------------------------

const MaskDigitInput = forwardRef<HTMLSpanElement, VariantProps>(function MaskDigitInput(
  {
    digits,
    decimals = 0,
    decimalSeparator = ".",
    unit,
    // Consumed (not forwarded to the DOM): mask is left-to-right cell fill with
    // no sign position, so `signed` is push-only. Dev-warn below.
    signed = false,
    value,
    defaultValue = null,
    onValueChange,
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
  const config = useMemo(() => normalizeConfig(digits, decimals), [digits, decimals]);
  const total = config.digits + config.decimals;

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && signed) {
      console.warn('DigitInput: `signed` is only supported in mode="push" (ignored in mask mode).');
    }
  }, [signed]);

  // The cell string is ALWAYS internal state: partial fills (e.g. "42") have
  // no representation in the public number|null value, so the prop cannot be
  // the single source of truth. A controlled `value` resets the string only
  // when it differs from what was last reported — the standard pattern for
  // lossy-controlled inputs.
  const [maskString, setMaskString] = useState<string>(() =>
    ulpsToMaskString(valueToUlps(defaultValue, config).ulps, config),
  );
  const isControlled = value !== undefined;
  const controlled = useMemo(
    () => (isControlled ? valueToUlps(value, config) : null),
    [isControlled, value, config],
  );
  const lastReported = useRef<number | null>(
    ulpsToValue(maskStringToUlps(maskString, config), config),
  );

  useClampWarning(controlled?.clamped === true, value, config);

  useEffect(() => {
    if (!isControlled || controlled === null) return;
    const external = ulpsToValue(controlled.ulps, config);
    if (external !== lastReported.current) {
      lastReported.current = external;
      setMaskString(ulpsToMaskString(controlled.ulps, config));
    }
  }, [isControlled, controlled, config]);

  const report = (s: string) => {
    const v = ulpsToValue(maskStringToUlps(s, config), config);
    if (v !== lastReported.current) {
      lastReported.current = v;
      onValueChange?.(v);
    }
  };

  const handleChange = (s: string) => {
    setMaskString(s);
    report(s);
  };

  const separatorString = typeof decimalSeparator === "string" ? decimalSeparator : ".";

  // Decimal-aware paste: text WITH a separator ("12.34") fills positionally
  // (→ 012.34), because a plain left-to-right char fill would silently mean
  // 123.4_. Plain digit strings keep OTPField's native typing-like fill.
  const handlePasteCapture = (e: ReactClipboardEvent<HTMLElement>) => {
    const text = e.clipboardData?.getData("text/plain") ?? "";
    if (!/[.,]/.test(text)) return;
    e.preventDefault();
    e.stopPropagation();
    if (readOnly || disabled) return;
    const parsed = parseDecimalText(text, separatorString, config);
    if (parsed !== null) handleChange(ulpsToMaskString(parsed, config));
  };

  return (
    <OTPField.Root
      {...rest}
      render={<span />}
      // The render override makes the real node a span; Base UI's types don't
      // parametrize the ref by the render element.
      ref={ref as unknown as Ref<HTMLDivElement>}
      className={cx(styles.root, styles.maskRoot, sizeClass[size], className)}
      data-elevation={elevation}
      length={total}
      value={maskString}
      onValueChange={handleChange}
      onPasteCapture={handlePasteCapture}
      validationType="numeric"
      autoComplete="off"
      name={name}
      disabled={disabled}
      readOnly={readOnly}
      required={required}
    >
      {Array.from({ length: total }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: cells have no identity beyond their position — index keys are the correct semantics here.
        <Fragment key={i}>
          {config.decimals > 0 && i === config.digits && (
            <span aria-hidden="true" className={styles.sep}>
              {decimalSeparator}
            </span>
          )}
          <OTPField.Input
            className={cx(styles.cell, styles.maskCell)}
            data-cell=""
            placeholder="_"
          />
        </Fragment>
      ))}
      {unit != null && (
        <span aria-hidden="true" className={styles.unit}>
          {unit}
        </span>
      )}
    </OTPField.Root>
  );
});

/** Dev-only warning shared by both variants: a controlled prop silently
 *  changing meaning is a consumer bug. Lives in an effect — StrictMode
 *  double-invokes render. */
function useClampWarning(clamped: boolean, value: number | null | undefined, config: DigitConfig) {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" && clamped) {
      console.warn(
        `DigitInput: controlled value ${value} clamped/rounded to fit ${config.digits}.${config.decimals} capacity.`,
      );
    }
  }, [clamped, value, config]);
}
