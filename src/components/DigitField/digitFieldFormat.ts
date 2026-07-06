/** Pure value/text helpers for DigitField. Kept separate so the parsing,
 *  sanitising and clamping logic can be unit-tested without a DOM. */

export interface SanitizeOptions {
  /** Decimal places allowed. `0` (default) makes it integer-only. */
  decimals: number;
  /** Permit a leading minus sign. */
  allowNegative: boolean;
}

/** Reduce a raw typed string to a legal numeric draft: digits, at most one
 *  decimal point (only when `decimals > 0`, capped to `decimals` places), and
 *  an optional single leading `-` (only when `allowNegative`). Everything else
 *  is dropped. The result is a *draft* — it may be an incomplete number like
 *  `"-"`, `"."` or `"1."`, which the caller renders as-is and parses to `null`
 *  until it becomes a real number. */
export function sanitizeDraft(raw: string, { decimals, allowNegative }: SanitizeOptions): string {
  const negative = allowNegative && /^\s*-/.test(raw);
  let body = raw.replace(/[^0-9.]/g, "");

  if (decimals <= 0) {
    body = body.replace(/\./g, "");
  } else {
    const firstDot = body.indexOf(".");
    if (firstDot !== -1) {
      const intPart = body.slice(0, firstDot);
      const fracPart = body.slice(firstDot + 1).replace(/\./g, "");
      body = `${intPart}.${fracPart.slice(0, decimals)}`;
    }
  }

  return (negative ? "-" : "") + body;
}

/** Parse a sanitised draft to a number, or `null` when it isn't yet a complete
 *  number (empty, or a lone `-` / `.` / `-.`). */
export function parseDraft(draft: string): number | null {
  if (draft === "" || draft === "-" || draft === "." || draft === "-.") return null;
  const n = Number(draft);
  return Number.isNaN(n) ? null : n;
}

/** Render a numeric value as the field's draft text. `null` → empty string. */
export function formatValue(value: number | null | undefined): string {
  return value == null ? "" : String(value);
}

/** Clamp to the optional bounds. `null` passes through unchanged. */
export function clamp(value: number | null, min?: number, max?: number): number | null {
  if (value == null) return null;
  if (min != null && value < min) return min;
  if (max != null && value > max) return max;
  return value;
}
