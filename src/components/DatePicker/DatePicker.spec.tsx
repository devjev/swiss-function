import { expect, test } from "@playwright/experimental-ct-react";
import { DatePicker } from "./DatePicker";

// Pins the issue #30 contract: ISO by default (YYYY-MM-DD field text, Monday
// weeks), free-text entry drives the calendar, grid keyboard nav commits.

test("renders the selected value as ISO and a Monday-first calendar", async ({ mount, page }) => {
  const c = await mount(
    <div style={{ width: 280 }}>
      <DatePicker aria-label="Date" defaultValue={new Date(2026, 6, 4)} />
    </div>,
  );
  const input = c.getByRole("combobox");
  await expect(input).toHaveValue("2026-07-04");

  await input.click();
  const calendar = page.getByRole("table");
  await expect(calendar).toHaveAttribute("aria-label", "Calendar, 2026-07");
  // Monday-first header.
  const headers = page.locator("th[scope='col']");
  await expect(headers.first()).toHaveText(/^Mo/i);
  await expect(headers.last()).toHaveText(/^Su/i);
  // The selected day is marked.
  await expect(page.locator("[data-iso='2026-07-04']")).toHaveAttribute("aria-pressed", "true");
});

test("typing filters to the date: ISO prefix jumps the view, Enter commits", async ({
  mount,
  page,
}) => {
  let committed: string | null = null;
  const c = await mount(
    <div style={{ width: 280 }}>
      <DatePicker
        aria-label="Date"
        defaultValue={new Date(2026, 6, 4)}
        onChange={(d) => {
          committed = d ? d.toDateString() : null;
        }}
      />
    </div>,
  );
  const input = c.getByRole("combobox");
  await input.click();
  await input.fill("2025-12");
  await expect(page.getByRole("table")).toHaveAttribute("aria-label", "Calendar, 2025-12");

  // Partial day: candidates highlighted, echo shows the first match.
  await input.fill("2025-12-1");
  await expect(page.locator("[data-candidate]").first()).toBeVisible();
  await expect(page.locator("[data-iso='2025-12-10'][data-candidate]")).toBeVisible();

  await input.fill("2025-12-12");
  await input.press("Enter");
  await expect(input).toHaveValue("2025-12-12");
  await expect.poll(() => committed).toBe(new Date(2025, 11, 12).toDateString());
  // Popup closed after commit.
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("day-first fragments and relative words parse (never month-first)", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ width: 280 }}>
      <DatePicker aria-label="Date" defaultValue={new Date(2026, 6, 4)} />
    </div>,
  );
  const input = c.getByRole("combobox");
  await input.click();
  // 12/7 = 12 July, day first.
  await input.fill("12/7");
  await input.press("Enter");
  await expect(input).toHaveValue("2026-07-12");

  await input.fill("tomorrow");
  await input.press("Enter");
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const iso = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(
    tomorrow.getDate(),
  ).padStart(2, "0")}`;
  await expect(input).toHaveValue(iso);
  await expect(page.getByRole("table")).toHaveCount(0);
});

test("grid keyboard: ArrowDown enters, arrows move, Enter selects", async ({ mount, page }) => {
  const c = await mount(
    <div style={{ width: 280 }}>
      <DatePicker aria-label="Date" defaultValue={new Date(2026, 6, 4)} />
    </div>,
  );
  const input = c.getByRole("combobox");
  await input.click();
  await input.press("ArrowDown");
  await expect(page.locator("[data-iso='2026-07-04']")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-iso='2026-07-05']")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("[data-iso='2026-07-12']")).toBeFocused();
  await page.keyboard.press("PageDown");
  await expect(page.locator("[data-iso='2026-08-12']")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(input).toHaveValue("2026-08-12");
  await expect(input).toBeFocused();
});

test("min/max and isDateDisabled block selection and strike days", async ({ mount, page }) => {
  const c = await mount(
    <div style={{ width: 280 }}>
      <DatePicker
        aria-label="Date"
        defaultValue={new Date(2026, 6, 15)}
        minDate={new Date(2026, 6, 10)}
        maxDate={new Date(2026, 6, 20)}
      />
    </div>,
  );
  const input = c.getByRole("combobox");
  await input.click();
  await expect(page.locator("[data-iso='2026-07-05']")).toBeDisabled();
  await expect(page.locator("[data-iso='2026-07-25']")).toBeDisabled();
  await expect(page.locator("[data-iso='2026-07-15']")).toBeEnabled();
  // Typing an out-of-range date does not commit on Enter.
  await input.fill("2026-07-25");
  await input.press("Enter");
  await expect(input).toHaveValue("2026-07-25"); // text stays, nothing committed
  await page.keyboard.press("Escape");
  await expect(input).toHaveValue("2026-07-15"); // reverts to the selection
});

test("clear button empties the value; blur-out closes and reverts text", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ width: 280, padding: 8 }}>
      <DatePicker aria-label="Date" defaultValue={new Date(2026, 6, 4)} />
      <button type="button">elsewhere</button>
    </div>,
  );
  const input = c.getByRole("combobox");
  await input.click();
  await input.fill("2026-1");
  // Focus something else entirely: popup closes, partial text abandoned.
  await c.getByRole("button", { name: "elsewhere" }).focus();
  await expect(page.getByRole("table")).toHaveCount(0);
  await expect(input).toHaveValue("2026-07-04");

  await c.getByRole("button", { name: "Clear date" }).click();
  await expect(input).toHaveValue("");
});

// --- Issues #33 / #34: shrinkability + external label association -------------

test("the field shrinks to a narrow root without overflowing (issues #33/#34)", async ({
  mount,
}) => {
  // The exact reported case: a 168px cap, below the ~258px content floor the
  // .field used to enforce (root honoured the width, the framed row stuck out
  // ~90px onto the neighbouring column). The .field grid item now carries
  // min-inline-size:0, one level deeper than the root's own #25 fix.
  const c = await mount(
    <div style={{ width: 168 }}>
      <DatePicker aria-label="Date" defaultValue={new Date(2026, 6, 4)} />
    </div>,
  );
  const root = c.locator("div").first();
  const input = c.locator("input");
  const field = input.locator("xpath=ancestor::div[1]");
  const [rootBox, fieldBox] = await Promise.all([root.boundingBox(), field.boundingBox()]);
  if (!rootBox || !fieldBox) throw new Error("no box");
  // The framed field stays within its 168px root (allow 1px sub-pixel slack).
  expect(fieldBox.width).toBeLessThanOrEqual(rootBox.width + 1);
  // …and the ISO value still renders untruncated (no horizontal clip inside
  // the input) — 168px is comfortably above the value + clear button's floor.
  await expect(input).toHaveValue("2026-07-04");
  const clipped = await input.evaluate(
    (el: HTMLInputElement) => el.scrollWidth > el.clientWidth + 1,
  );
  expect(clipped).toBe(false);
});

test("aria-labelledby overrides the placeholder as the accessible name (issue #33)", async ({
  mount,
}) => {
  const c = await mount(
    <div>
      <span id="dp-label">Valid from</span>
      <DatePicker aria-labelledby="dp-label" />
    </div>,
  );
  // Without the forward, the empty field's accname would be its placeholder.
  await expect(c.getByRole("combobox", { name: "Valid from" })).toBeVisible();
});

// --- Precision: ISO weeks, months, years -------------------------------------

test("week precision: rows pick whole ISO weeks, typing w-forms commits", async ({
  mount,
  page,
}) => {
  const committed: string[] = [];
  const c = await mount(
    <div style={{ width: 280 }}>
      <DatePicker
        aria-label="Week"
        precision="week"
        defaultValue={new Date(2026, 6, 4)}
        onChange={(d) => {
          committed.push(d ? d.toDateString() : "null");
        }}
      />
    </div>,
  );
  const input = c.getByRole("combobox");
  // Sat Jul 4 2026 displays as its ISO week.
  await expect(input).toHaveValue("2026-W27");
  await input.click();
  // The week column is forced on (no showWeekNumbers passed) and the selected
  // week's button is pressed.
  await expect(page.locator("[data-week='2026-W27']")).toHaveAttribute("aria-pressed", "true");
  // Day cells are static text, not buttons.
  await expect(page.locator("[data-iso]")).toHaveCount(0);

  // Clicking anywhere in another row commits that week (Jul 13 is in W29's
  // month grid row 3; click the "15" cell's row via its text).
  await page.locator("td", { hasText: /^15$/ }).click();
  await expect(input).toHaveValue("2026-W29");
  expect(committed).toEqual([new Date(2026, 6, 13).toDateString()]);

  // Typing a w-form commits the Monday.
  await input.click();
  await input.fill("w30");
  await input.press("Enter");
  await expect(input).toHaveValue("2026-W30");
  expect(committed).toEqual([
    new Date(2026, 6, 13).toDateString(),
    new Date(2026, 6, 20).toDateString(),
  ]);
});

test("week precision: keyboard moves by weeks and commits once", async ({ mount, page }) => {
  const committed: string[] = [];
  const c = await mount(
    <div style={{ width: 280 }}>
      <DatePicker
        aria-label="Week"
        precision="week"
        defaultValue={new Date(2026, 6, 4)}
        onChange={(d) => {
          committed.push(d ? d.toDateString() : "null");
        }}
      />
    </div>,
  );
  const input = c.getByRole("combobox");
  await input.click();
  await input.press("ArrowDown");
  await expect(page.locator("[data-week='2026-W27']")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("[data-week='2026-W28']")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(input).toHaveValue("2026-W28");
  // Exactly one commit from the keyboard path (no doubled row click).
  expect(committed).toEqual([new Date(2026, 6, 6).toDateString()]);
});

test("week precision: minDate keeps the straddling week pickable (overlap)", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ width: 280 }}>
      <DatePicker
        aria-label="Week"
        precision="week"
        defaultValue={new Date(2026, 6, 15)}
        minDate={new Date(2026, 6, 15)}
      />
    </div>,
  );
  await c.getByRole("combobox").click();
  // Week 29 contains the Wednesday minDate: enabled. Week 28 is fully before.
  await expect(page.locator("[data-week='2026-W29']")).toBeEnabled();
  await expect(page.locator("[data-week='2026-W28']")).toBeDisabled();
});

test("month precision: a year of month cells, typed names commit", async ({ mount, page }) => {
  const committed: string[] = [];
  const c = await mount(
    <div style={{ width: 280 }}>
      <DatePicker
        aria-label="Month"
        precision="month"
        defaultValue={new Date(2026, 6, 15)}
        minDate={new Date(2026, 6, 15)}
        onChange={(d) => {
          committed.push(d ? d.toDateString() : "null");
        }}
      />
    </div>,
  );
  const input = c.getByRole("combobox");
  await expect(input).toHaveValue("2026-07");
  await input.click();
  const grid = page.getByRole("listbox");
  await expect(grid).toHaveAttribute("aria-label", "Calendar, 2026");
  // Overlap: June is fully before the Jul 15 minDate, July overlaps.
  await expect(page.locator("[data-month='2026-06']")).toBeDisabled();
  await expect(page.locator("[data-month='2026-07']")).toBeEnabled();
  await expect(page.locator("[data-month='2026-07']")).toHaveAttribute("aria-selected", "true");

  // Header paddles page by year.
  await page.getByRole("button", { name: "Next year" }).click();
  await expect(grid).toHaveAttribute("aria-label", "Calendar, 2027");
  await page.locator("[data-month='2027-03']").click();
  await expect(input).toHaveValue("2027-03");
  expect(committed).toEqual([new Date(2027, 2, 1).toDateString()]);

  // Typing a month name commits the 1st.
  await input.click();
  await input.fill("dec");
  await input.press("Enter");
  await expect(input).toHaveValue("2027-12");
  expect(committed[1]).toBe(new Date(2027, 11, 1).toDateString());
});

test("year precision: a 12-year page, typing a year commits Jan 1", async ({ mount, page }) => {
  const committed: string[] = [];
  const c = await mount(
    <div style={{ width: 280 }}>
      <DatePicker
        aria-label="Year"
        precision="year"
        defaultValue={new Date(2026, 6, 15)}
        onChange={(d) => {
          committed.push(d ? d.toDateString() : "null");
        }}
      />
    </div>,
  );
  const input = c.getByRole("combobox");
  await expect(input).toHaveValue("2026");
  await input.click();
  const grid = page.getByRole("listbox");
  await expect(grid).toHaveAttribute("aria-label", "Calendar, 2016-2027");
  await expect(page.locator("[data-year='2026']")).toHaveAttribute("aria-selected", "true");

  // Paddles page by a dozen years.
  await page.getByRole("button", { name: "Next years" }).click();
  await expect(grid).toHaveAttribute("aria-label", "Calendar, 2028-2039");
  await page.locator("[data-year='2030']").click();
  await expect(input).toHaveValue("2030");
  expect(committed).toEqual([new Date(2030, 0, 1).toDateString()]);

  // Typing a year commits Jan 1 of that year.
  await input.click();
  await input.fill("2028");
  await input.press("Enter");
  await expect(input).toHaveValue("2028");
  expect(committed[1]).toBe(new Date(2028, 0, 1).toDateString());
});

test("precision keyboard: month grid arrows move 1/3, year grid pages", async ({ mount, page }) => {
  const c = await mount(
    <div style={{ width: 280 }}>
      <DatePicker aria-label="Month" precision="month" defaultValue={new Date(2026, 6, 15)} />
    </div>,
  );
  const input = c.getByRole("combobox");
  await input.click();
  await input.press("ArrowDown");
  await expect(page.locator("[data-month='2026-07']")).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-month='2026-08']")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("[data-month='2026-11']")).toBeFocused();
  await page.keyboard.press("PageUp");
  await expect(page.locator("[data-month='2025-11']")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(input).toHaveValue("2025-11");
});
