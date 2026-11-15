/** Locale date formatting through one cached `Intl.DateTimeFormat` per
 *  option set.
 *
 *  `date.toLocaleDateString(locale, options)` builds a new formatter on each
 *  call, about 90µs. Over chart data that adds up: a Multiples grid of 40
 *  daily Scatterplots formatted 10k tick labels that way and blocked its mount
 *  for 910ms. A cached formatter gives the same string, since the method
 *  delegates to `Intl.DateTimeFormat.prototype.format`. (Timeline's and the
 *  time axis's tick formatters keep caches of their own, issue #72.) */

const formatters = new Map<string, Intl.DateTimeFormat>();

/** `new Intl.DateTimeFormat(undefined, options).format(date)`, which is what
 *  `date.toLocaleDateString(undefined, options)` returns for date fields
 *  (weekday, era, year, month, day) or no options, and what `toLocaleString`
 *  returns when the options name a date field. An invalid date gives
 *  "Invalid Date", as those methods do (`format` itself throws). */
export function formatLocaleDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
  if (Number.isNaN(date.getTime())) return "Invalid Date";
  const key = options === undefined ? "" : JSON.stringify(options);
  let formatter = formatters.get(key);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat(undefined, options);
    formatters.set(key, formatter);
  }
  return formatter.format(date);
}
