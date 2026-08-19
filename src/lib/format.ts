/** Number formatting in Swiss typography: an apostrophe thousands separator and
 *  a period decimal (`1'284'500.50`). Deterministic (built by hand, not via
 *  `Intl`/ICU, whose Swiss separator and spacing drift between engine versions),
 *  so it renders identically everywhere, which is what keeps snapshot / visual
 *  tests stable. This is the house default across the library. */

export interface FormatNumberOptions {
  /** Fixed decimal places, zero-padded (e.g. `2` -> `1'000.00`). */
  decimals?: number;
  /** Max decimal places when `decimals` is unset: rounds, then strips trailing
   *  zeros (e.g. `1` turns `12.50` into `12.5` and `12` into `12`). */
  maximumFractionDigits?: number;
}

const SWISS_GROUP = /\B(?=(\d{3})+(?!\d))/g;

/** `toFixed` throws above 100 fraction digits; keep the request in range. */
const clampDigits = (n: number) => Math.min(100, Math.max(0, n));

/** Group the integer part of an already-formatted magnitude string with
 *  apostrophes: `"1234567"` -> `"1'234'567"`. */
function groupThousands(intDigits: string): string {
  return intDigits.replace(SWISS_GROUP, "'");
}

/** Format `value` in Swiss typography (`1'284'500`, `-1'234.5`). Non-finite
 *  input is returned as its plain string (`"NaN"`, `"Infinity"`) so callers can
 *  guard it rather than render a broken number. */
export function formatNumber(value: number, options: FormatNumberOptions = {}): string {
  if (!Number.isFinite(value)) return String(value);
  const { decimals, maximumFractionDigits } = options;
  const negative = value < 0;
  const abs = Math.abs(value);

  let body: string;
  if (decimals != null) {
    body = abs.toFixed(clampDigits(decimals));
  } else if (maximumFractionDigits != null) {
    body = abs.toFixed(clampDigits(maximumFractionDigits));
    if (body.includes(".")) body = body.replace(/\.?0+$/, "");
  } else {
    body = String(abs);
    // Avoid exponential notation for small magnitudes so the digits show in full
    // (e.g. 1e-7 -> 0.0000001). Magnitudes >= 1e21 stay exponential (toFixed
    // returns exponential there too), but that is far outside any real metric.
    if (body.includes("e") || body.includes("E")) {
      body = abs.toFixed(20).replace(/\.?0+$/, "");
    }
  }

  const [intPart = "0", fracPart] = body.split(".");
  const grouped = groupThousands(intPart);
  const num = fracPart ? `${grouped}.${fracPart}` : grouped;
  // Drop the sign when the magnitude rounded to zero (e.g. -0, -0.00).
  const isZero = /^0(\.0+)?$/.test(num);
  return negative && !isZero ? `-${num}` : num;
}
