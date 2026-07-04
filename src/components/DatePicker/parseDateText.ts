/** Free-text date parsing for DatePicker (issue #30). Pure — no React, no
 *  DOM. The parser is *progressive*: partial input narrows the calendar
 *  (view + highlighted candidates) before it resolves to a committable date.
 *
 *  Grammar, in priority order:
 *    - relative: `today` / `tomorrow` / `yesterday` / `+N` / `-N` (days)
 *    - ISO prefixes: `2026` → view Jan 2026; `2026-7`/`2026-07` → July;
 *      `2026-07-1` → day-prefix "1" (candidates 1, 10–19); `2026-07-12` → date
 *    - day-first fragments: `12`, `12 jul`, `jul 12`, `12 jul 2026`,
 *      `12.7`, `12/7/2026`, `12-7-2026` — day ALWAYS before month in numeric
 *      forms; month-first (US) is deliberately not parsed. Month names match
 *      by unambiguous prefix (`au` → August; `ju` → June|July stays put).
 *
 *  Incomplete fragments resolve against the caller's current view (so a bare
 *  `12` means the 12th of the visible month).
 */

export interface MonthView {
  year: number;
  /** 0-based, like Date#getMonth. */
  month: number;
}

export interface ParsedText {
  /** The single date Enter would commit, or null while ambiguous/invalid. */
  candidate: Date | null;
  /** The month the calendar should show, or null to stay put. */
  view: MonthView | null;
  /** Digits typed for the day so far — highlights matching days in the view
   *  ("1" → 1, 10…19). null when the day is complete or absent. */
  dayPrefix: string | null;
}

const NONE: ParsedText = { candidate: null, view: null, dayPrefix: null };

const MONTHS = [
  "january",
  "february",
  "march",
  "april",
  "may",
  "june",
  "july",
  "august",
  "september",
  "october",
  "november",
  "december",
];

/** 0-based month for an unambiguous name prefix, else null. */
function matchMonth(token: string): number | null {
  if (!/^[a-z]+$/.test(token)) return null;
  const hits = MONTHS.map((m, i) => [m, i] as const).filter(([m]) => m.startsWith(token));
  return hits.length === 1 && hits[0] ? hits[0][1] : null;
}

function clampDay(year: number, month: number, day: number): Date | null {
  const last = new Date(year, month + 1, 0).getDate();
  if (day < 1 || day > last) return null;
  return new Date(year, month, day);
}

function fromDayPrefix(view: MonthView, prefix: string): ParsedText {
  // The prefix itself, read as a day, is the first candidate ("1" → the 1st)
  // when it exists in the month.
  const day = Number(prefix);
  const candidate = clampDay(view.year, view.month, day);
  const complete = prefix.length >= 2 || day > 3; // no longer extendable to ≤31
  return { candidate, view, dayPrefix: complete ? null : prefix };
}

function parseISO(text: string, view: MonthView): ParsedText | null {
  const m = /^(\d{4})(?:-(\d{1,2})?(?:-(\d{1,2})?)?)?$/.exec(text);
  if (!m?.[1]) return null;
  const year = Number(m[1]);
  if (m[2] === undefined && !text.includes("-")) {
    return { candidate: null, view: { year, month: 0 }, dayPrefix: null };
  }
  const monthNum = m[2] ? Number(m[2]) : Number.NaN;
  if (!(monthNum >= 1 && monthNum <= 12)) {
    // "2026-" or an out-of-range month: show the year, wait for more.
    return {
      candidate: null,
      view: { year, month: view.year === year ? view.month : 0 },
      dayPrefix: null,
    };
  }
  const monthView = { year, month: monthNum - 1 };
  if (m[3] === undefined) return { candidate: null, view: monthView, dayPrefix: null };
  if (m[3] === "") return { candidate: null, view: monthView, dayPrefix: null };
  return fromDayPrefix(monthView, m[3]);
}

function parseRelative(text: string, today: Date): ParsedText | null {
  const day = (d: Date): ParsedText => ({
    candidate: d,
    view: { year: d.getFullYear(), month: d.getMonth() },
    dayPrefix: null,
  });
  if (text === "today") return day(today);
  if (text === "tomorrow") return day(offset(today, 1));
  if (text === "yesterday") return day(offset(today, -1));
  const rel = /^([+-])(\d{1,4})$/.exec(text);
  if (rel?.[1] && rel[2]) return day(offset(today, (rel[1] === "-" ? -1 : 1) * Number(rel[2])));
  return null;
}

function offset(d: Date, days: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + days);
  return out;
}

/** Day-first fragments: tokens of digits and month names, split on space,
 *  dot, slash or comma. At most one day, one month, one 4-digit year. */
function parseFragments(text: string, view: MonthView): ParsedText | null {
  const tokens = text.split(/[\s.,/]+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 3) return null;
  let day: number | null = null;
  let dayToken = "";
  let month: number | null = null;
  let year: number | null = null;
  let numericCount = 0;
  for (const token of tokens) {
    if (/^\d{4}$/.test(token)) {
      if (year !== null) return null;
      year = Number(token);
    } else if (/^\d{1,2}$/.test(token)) {
      // Day-first: the first small number is the day, a second one the month.
      numericCount++;
      if (numericCount === 1) {
        day = Number(token);
        dayToken = token;
      } else if (numericCount === 2) {
        const monthNum = Number(token);
        if (monthNum < 1 || monthNum > 12) return null;
        month = monthNum - 1;
      } else {
        return null;
      }
    } else {
      const named = matchMonth(token.toLowerCase());
      if (named === null || month !== null) return null;
      month = named;
    }
  }
  if (day === null && month === null) return null;
  const y = year ?? view.year;
  if (day === null) {
    // Month (name) alone, maybe with a year: jump the view.
    return month === null ? null : { candidate: null, view: { year: y, month }, dayPrefix: null };
  }
  const m = month ?? view.month;
  const target = { year: y, month: m };
  if (day < 1 || day > 31) return null;
  // A bare 1-digit day with nothing else typed yet stays a prefix ("1" may
  // become "12"); once a month/year token exists the day reads as final.
  if (tokens.length === 1 && dayToken.length === 1) return fromDayPrefix(target, dayToken);
  return { candidate: clampDay(y, m, day), view: target, dayPrefix: null };
}

export function parseDateText(raw: string, view: MonthView, today: Date): ParsedText {
  const text = raw.trim().toLowerCase();
  if (!text) return NONE;
  return parseRelative(text, today) ?? parseISO(text, view) ?? parseFragments(text, view) ?? NONE;
}
