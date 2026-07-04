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
