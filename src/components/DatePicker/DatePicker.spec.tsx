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

// --- Issue #33: shrinkability + external label association --------------------

test("the field shrinks to a narrow root without overflowing (issue #33)", async ({ mount }) => {
  // 176px root is below the ~258px content floor the .field used to enforce.
  const c = await mount(
    <div style={{ width: 176 }}>
      <DatePicker aria-label="Date" defaultValue={new Date(2026, 6, 4)} />
    </div>,
  );
  const root = c.locator("div").first();
  const field = c.locator("input").locator("xpath=ancestor::div[1]");
  const [rootBox, fieldBox] = await Promise.all([root.boundingBox(), field.boundingBox()]);
  if (!rootBox || !fieldBox) throw new Error("no box");
  // The framed field stays within its 176px root (allow 1px sub-pixel slack).
  expect(fieldBox.width).toBeLessThanOrEqual(rootBox.width + 1);
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
