import { describe, expect, it } from "vitest";
import { formatISODate } from "./dateMath";
import { parseDateText } from "./parseDateText";

const VIEW = { year: 2026, month: 6 }; // July 2026 on screen
const TODAY = new Date(2026, 6, 4);

const iso = (d: Date | null) => (d ? formatISODate(d) : null);

describe("ISO prefixes", () => {
  it("a bare year jumps to January of that year", () => {
    const r = parseDateText("2028", VIEW, TODAY);
    expect(r.view).toEqual({ year: 2028, month: 0 });
    expect(r.candidate).toBeNull();
  });

  it("year-month jumps to the month, one or two digits", () => {
    expect(parseDateText("2026-7", VIEW, TODAY).view).toEqual({ year: 2026, month: 6 });
    expect(parseDateText("2026-11", VIEW, TODAY).view).toEqual({ year: 2026, month: 10 });
  });

  it("a partial day keeps a prefix for highlighting and offers the first match", () => {
    const r = parseDateText("2026-07-1", VIEW, TODAY);
    expect(r.dayPrefix).toBe("1");
    expect(iso(r.candidate)).toBe("2026-07-01");
  });

  it("a complete date is the candidate", () => {
    const r = parseDateText("2026-07-12", VIEW, TODAY);
    expect(iso(r.candidate)).toBe("2026-07-12");
    expect(r.dayPrefix).toBeNull();
  });

  it("rejects impossible days", () => {
    expect(parseDateText("2026-02-30", VIEW, TODAY).candidate).toBeNull();
  });
});

describe("day-first fragments (never month-first)", () => {
  it("a bare day resolves in the visible month", () => {
    expect(iso(parseDateText("12", VIEW, TODAY).candidate)).toBe("2026-07-12");
  });

  it("a bare single digit stays a prefix (may become two digits)", () => {
    const r = parseDateText("1", VIEW, TODAY);
    expect(r.dayPrefix).toBe("1");
    expect(iso(r.candidate)).toBe("2026-07-01");
  });

  it("numeric pairs are day/month, day first", () => {
    expect(iso(parseDateText("12/7", VIEW, TODAY).candidate)).toBe("2026-07-12");
    expect(iso(parseDateText("7/12", VIEW, TODAY).candidate)).toBe("2026-12-07");
    expect(iso(parseDateText("12.3.2027", VIEW, TODAY).candidate)).toBe("2027-03-12");
  });

  it("month names match by unambiguous prefix, in either order", () => {
    expect(iso(parseDateText("12 jul", VIEW, TODAY).candidate)).toBe("2026-07-12");
    expect(iso(parseDateText("jul 12", VIEW, TODAY).candidate)).toBe("2026-07-12");
    expect(iso(parseDateText("4 au 2027", VIEW, TODAY).candidate)).toBe("2027-08-04");
    // "ju" is June or July — ambiguous, nothing resolves.
    expect(parseDateText("12 ju", VIEW, TODAY).candidate).toBeNull();
  });

  it("a month name alone jumps the view without a candidate", () => {
    const r = parseDateText("december", VIEW, TODAY);
    expect(r.view).toEqual({ year: 2026, month: 11 });
    expect(r.candidate).toBeNull();
  });
});

describe("relative words", () => {
  it("today/tomorrow/yesterday and signed day offsets", () => {
    expect(iso(parseDateText("today", VIEW, TODAY).candidate)).toBe("2026-07-04");
    expect(iso(parseDateText("Tomorrow", VIEW, TODAY).candidate)).toBe("2026-07-05");
    expect(iso(parseDateText("yesterday", VIEW, TODAY).candidate)).toBe("2026-07-03");
    expect(iso(parseDateText("+7", VIEW, TODAY).candidate)).toBe("2026-07-11");
    expect(iso(parseDateText("-30", VIEW, TODAY).candidate)).toBe("2026-06-04");
  });
});

describe("noise", () => {
  it("empty and unparseable input change nothing", () => {
    for (const text of ["", "  ", "banana", "12 ju 7 8", "99/99"]) {
      const r = parseDateText(text, VIEW, TODAY);
      expect(r.candidate).toBeNull();
      expect(r.view).toBeNull();
    }
  });
});

describe("week precision", () => {
  it("accepts w-forms, defaulting the year to the view", () => {
    for (const text of ["w29", "2026-w29", "2026-W29", "2026w29", "2026 w29"]) {
      expect(iso(parseDateText(text, VIEW, TODAY, "week").candidate)).toBe("2026-07-13");
    }
  });

  it("normalizes day-level entries to their Monday", () => {
    // Sun Jul 12 2026 belongs to week 28, Monday Jul 6.
    expect(iso(parseDateText("2026-07-12", VIEW, TODAY, "week").candidate)).toBe("2026-07-06");
    expect(iso(parseDateText("12 jul", VIEW, TODAY, "week").candidate)).toBe("2026-07-06");
    // Sat Jul 4 (today) → Monday Jun 29.
    expect(iso(parseDateText("today", VIEW, TODAY, "week").candidate)).toBe("2026-06-29");
  });

  it("rejects out-of-range weeks, honoring 52/53-week years", () => {
    expect(parseDateText("w0", VIEW, TODAY, "week").candidate).toBeNull();
    expect(parseDateText("w54", VIEW, TODAY, "week").candidate).toBeNull();
    expect(iso(parseDateText("2026-w53", VIEW, TODAY, "week").candidate)).toBe("2026-12-28");
    expect(parseDateText("2025-w53", VIEW, TODAY, "week").candidate).toBeNull();
  });

  it("a bare w waits for digits; the day prefix never leaks", () => {
    expect(parseDateText("w", VIEW, TODAY, "week").candidate).toBeNull();
    expect(parseDateText("1", VIEW, TODAY, "week").dayPrefix).toBeNull();
  });
});

describe("month precision", () => {
  it("promotes complete year-month and month fragments to candidates", () => {
    expect(iso(parseDateText("2026-07", VIEW, TODAY, "month").candidate)).toBe("2026-07-01");
    expect(iso(parseDateText("jul", VIEW, TODAY, "month").candidate)).toBe("2026-07-01");
    expect(iso(parseDateText("jul 2027", VIEW, TODAY, "month").candidate)).toBe("2027-07-01");
    expect(iso(parseDateText("7", VIEW, TODAY, "month").candidate)).toBe("2026-07-01");
    expect(iso(parseDateText("12 2027", VIEW, TODAY, "month").candidate)).toBe("2027-12-01");
  });

  it("a bare year stays a view jump", () => {
    const r = parseDateText("2026", VIEW, TODAY, "month");
    expect(r.candidate).toBeNull();
    expect(r.view).toEqual({ year: 2026, month: 0 });
  });

  it("a number past 12 falls back to a day-first read of the visible month", () => {
    expect(iso(parseDateText("13", VIEW, TODAY, "month").candidate)).toBe("2026-07-01");
    expect(parseDateText("32", VIEW, TODAY, "month").candidate).toBeNull();
  });

  it("normalizes day-level entries to the 1st", () => {
    expect(iso(parseDateText("2026-07-12", VIEW, TODAY, "month").candidate)).toBe("2026-07-01");
    expect(iso(parseDateText("today", VIEW, TODAY, "month").candidate)).toBe("2026-07-01");
  });
});

describe("year precision", () => {
  it("promotes a bare year to the candidate", () => {
    const r = parseDateText("2028", VIEW, TODAY, "year");
    expect(iso(r.candidate)).toBe("2028-01-01");
    expect(r.view).toEqual({ year: 2028, month: 0 });
  });

  it("normalizes other entries to Jan 1 and skips day fragments", () => {
    expect(iso(parseDateText("today", VIEW, TODAY, "year").candidate)).toBe("2026-01-01");
    expect(parseDateText("12", VIEW, TODAY, "year").candidate).toBeNull();
  });
});

describe("day precision regression (no 4th argument)", () => {
  it("matches the original behavior", () => {
    expect(iso(parseDateText("2026-07-12", VIEW, TODAY).candidate)).toBe("2026-07-12");
    const r = parseDateText("2026", VIEW, TODAY);
    expect(r.candidate).toBeNull();
    expect(r.view).toEqual({ year: 2026, month: 0 });
  });
});
