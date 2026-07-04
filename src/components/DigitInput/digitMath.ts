/** Pure fixed-point math for DigitInput. The canonical state is `ulps` — an
 *  integer count of least-significant units (10^-decimals), or `null` for the
 *  pristine untyped state — so push/pop/step/clamp are single arithmetic ops
 *  and every function here stays unit-testable without a DOM. */

export interface DigitConfig {
  /** Integer places (>= 1). */
  digits: number;
  /** Decimal places (>= 0). */
  decimals: number;
}

/** Coerce degenerate configs instead of failing: non-integer/short `digits`
 *  floor to sane values, and the combined precision is capped at 15 so every
 *  representable ulps count stays an exact double. Dev-warns on change. */
export function normalizeConfig(digits: number, decimals: number): DigitConfig {
  let d = Number.isFinite(digits) ? Math.max(1, Math.floor(digits)) : 1;
  let f = Number.isFinite(decimals) ? Math.max(0, Math.floor(decimals)) : 0;
  if (d + f > 15) {
    f = Math.max(0, 15 - d);
    d = Math.min(d, 15);
  }
  if (process.env.NODE_ENV !== "production" && (d !== digits || f !== decimals)) {
    console.warn(`DigitInput: digits=${digits} decimals=${decimals} coerced to ${d}/${f}.`);
  }
  return { digits: d, decimals: f };
}

function totalOf(config: DigitConfig): number {
  return config.digits + config.decimals;
}

/** Largest representable ulps count: every cell at 9. */
export function capacityMax(config: DigitConfig): number {
  return 10 ** totalOf(config) - 1;
}

/** Push a digit in from the right (calculator model). Rejected — state
 *  returned unchanged — when the most-significant cell is already occupied,
 *  i.e. the shift would drop a typed digit. */
export function pushDigit(ulps: number | null, digit: number, config: DigitConfig): number | null {
  const shiftable = 10 ** (totalOf(config) - 1) - 1;
  if (ulps !== null && ulps > shiftable) return ulps;
  return (ulps ?? 0) * 10 + digit;
}

/** Pop the least-significant digit; popping the last one returns to pristine.
 *  Typed leading zeros are deliberately not tracked: an all-zeros display and
 *  a partially-typed zero are indistinguishable on screen, so both pop
 *  straight to `null`. */
export function popDigit(ulps: number | null): number | null {
  if (ulps === null) return null;
  if (ulps < 10) return null;
  return Math.floor(ulps / 10);
}

/** ArrowUp/Down: step one least-significant unit, clamped to the capacity.
 *  Stepping from pristine un-pristines (down → 0, up → 1). */
export function stepUlps(ulps: number | null, direction: 1 | -1, config: DigitConfig): number {
  const next = (ulps ?? 0) + direction;
  return Math.max(0, Math.min(capacityMax(config), next));
}

/** Controlled `value` → ulps. Non-finite values read as pristine; out-of-range
 *  values clamp (negatives to 0) and excess precision rounds. `clamped` is
 *  true when the result differs from the given value — the caller dev-warns,
 *  because a controlled prop silently changing meaning is a consumer bug. */
export function valueToUlps(
  value: number | null,
  config: DigitConfig,
): { ulps: number | null; clamped: boolean } {
  if (value === null) return { ulps: null, clamped: false };
  if (!Number.isFinite(value)) return { ulps: null, clamped: true };
  const raw = Math.round(value * 10 ** config.decimals);
  const ulps = Math.max(0, Math.min(capacityMax(config), raw));
  return { ulps, clamped: ulps !== raw };
}

export function ulpsToValue(ulps: number | null, config: DigitConfig): number | null {
  return ulps === null ? null : ulps / 10 ** config.decimals;
}

/** Per-cell characters, most significant first — or `null` for the pristine
 *  mask (the component renders its own placeholder glyph). */
export function ulpsToCells(ulps: number | null, config: DigitConfig): string[] | null {
  if (ulps === null) return null;
  return String(ulps).padStart(totalOf(config), "0").split("");
}

/** Canonical machine string: what the hidden input, forms, and clipboard
 *  carry. Always "." as the separator regardless of the display glyph. */
export function ulpsToCanonical(ulps: number | null, config: DigitConfig): string {
  if (ulps === null) return "";
  const value = ulps / 10 ** config.decimals;
  return value.toFixed(config.decimals);
}

/** Parse free-form text (paste, autofill) into ulps. Deterministic rule: keep
 *  digits and separator candidates; split at the RIGHTMOST occurrence of the
 *  configured separator, else the rightmost "."; every other "." and "," is
 *  grouping and is dropped. Extra fraction digits round; the result clamps to
 *  capacity silently (a user action, unlike a controlled prop). Returns null
 *  when the text carries no digits at all. */
export function parseDecimalText(
  text: string,
  separator: string,
  config: DigitConfig,
): number | null {
  const sep = separator.length === 1 ? separator : ".";
  const escaped = sep.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Keep digits plus every separator candidate; drop units, spaces, signs.
  const source = text.replace(new RegExp(`[^0-9.,${escaped}]`, "g"), "");
  let splitAt = source.lastIndexOf(sep);
  if (splitAt < 0) splitAt = source.lastIndexOf(".");
  const intPart = (splitAt < 0 ? source : source.slice(0, splitAt)).replace(/[^0-9]/g, "");
  const fracPart = (splitAt < 0 ? "" : source.slice(splitAt + 1)).replace(/[^0-9]/g, "");
  if (intPart === "" && fracPart === "") return null;
  const fracScaled =
    config.decimals === 0 ? 0 : Math.round(Number(`0.${fracPart || "0"}`) * 10 ** config.decimals);
  const raw = Number(intPart || "0") * 10 ** config.decimals + fracScaled;
  return Math.max(0, Math.min(capacityMax(config), raw));
}

/** Mask-mode (2FA-style) cell string: left-to-right typed characters, zero-
 *  padded to capacity only when the value is complete. Pristine → "". */
export function ulpsToMaskString(ulps: number | null, config: DigitConfig): string {
  return ulps === null ? "" : String(ulps).padStart(totalOf(config), "0");
}

/** Inverse of `ulpsToMaskString` for the null-until-complete contract: a
 *  partially filled mask has no value. */
export function maskStringToUlps(s: string, config: DigitConfig): number | null {
  if (s.length !== totalOf(config) || !/^[0-9]+$/.test(s)) return null;
  return Number(s);
}

/** Human-readable value for aria-valuetext: unpadded number (canonical "."
 *  separator — screen readers expect it) plus a string unit when present. */
export function formatValueText(ulps: number | null, config: DigitConfig, unit: unknown): string {
  if (ulps === null) return "blank";
  const text = ulpsToCanonical(ulps, config);
  return typeof unit === "string" && unit.length > 0 ? `${text} ${unit}` : text;
}
