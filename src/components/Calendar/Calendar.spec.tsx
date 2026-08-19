import { expect, test } from "@playwright/experimental-ct-react";
import { CalendarHarness } from "./Calendar.harness";

test("renders the toolbar, month title, and view switcher", async ({ mount }) => {
  const c = await mount(<CalendarHarness />);
  await expect(c.getByRole("group", { name: "Calendar", exact: true })).toBeVisible();
  await expect(c.getByRole("heading")).toHaveText("March 2026");
  await expect(c.getByRole("button", { name: "Today" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Month", exact: true })).toBeVisible();
  await expect(c.getByRole("button", { name: "Week", exact: true })).toBeVisible();
  await expect(c.getByRole("button", { name: "Year", exact: true })).toBeVisible();
});

test("prev / next step the month and fire onNavigate", async ({ mount }) => {
  const c = await mount(<CalendarHarness />);
  const heading = c.getByRole("heading");
  await c.getByRole("button", { name: "Next month" }).click();
  await expect(heading).toHaveText("April 2026");
  await c.getByRole("button", { name: "Previous month" }).click();
  await c.getByRole("button", { name: "Previous month" }).click();
  await expect(heading).toHaveText("February 2026");
  await expect(c.getByTestId("mirror")).toHaveAttribute("data-last-nav", "2026-2-11");
});

test("switching to Week retitles and fires onViewChange", async ({ mount }) => {
  const c = await mount(<CalendarHarness />);
  await c.getByRole("button", { name: "Week" }).click();
  await expect(c.getByTestId("mirror")).toHaveAttribute("data-last-view", "week");
  await expect(c.getByRole("heading")).toHaveText("9-15 Mar 2026");
  await expect(c.getByRole("group", { name: "Calendar", exact: true })).toHaveAttribute(
    "data-view",
    "week",
  );
});

test("month view shows a spanning multi-day bar and single-day events", async ({ mount }) => {
  const c = await mount(<CalendarHarness />);
  await expect(c.getByRole("button", { name: "On call" })).toBeVisible();
  await expect(c.getByRole("button", { name: "Design conference" })).toBeVisible();
});

test("clicking an event fires onEventClick with its id", async ({ mount }) => {
  const c = await mount(<CalendarHarness />);
  await c.getByRole("button", { name: "On call" }).click();
  const mirror = c.getByTestId("mirror");
  await expect(mirror).toHaveAttribute("data-last-event", "oncall");
  await expect(mirror).toHaveAttribute("data-clicks", "1");
});

test("clicking a day cell fires onDateClick", async ({ mount }) => {
  const c = await mount(<CalendarHarness />);
  // The empty day cell for the 5th (no events on it).
  await c.getByRole("button", { name: "5", exact: true }).first().click();
  await expect(c.getByTestId("mirror")).toHaveAttribute("data-last-date", /^2026-03-05/);
});

test("week view lays overlapping timed events into side-by-side columns", async ({ mount }) => {
  const c = await mount(<CalendarHarness />);
  await c.getByRole("button", { name: "Week" }).click();
  const planning = c.getByRole("button", { name: /Planning/ });
  const sync = c.getByRole("button", { name: /Platform sync/ });
  await expect(planning).toBeVisible();
  await expect(sync).toBeVisible();
  const a = await planning.boundingBox();
  const b = await sync.boundingBox();
  // Overlapping events sit in distinct columns (no horizontal overlap).
  expect(a && b && (a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1)).toBeTruthy();
});

test("year view renders twelve months and drills into a month title", async ({ mount }) => {
  const c = await mount(<CalendarHarness />);
  await c.getByRole("button", { name: "Year" }).click();
  await expect(c.getByRole("button", { name: "January" })).toBeVisible();
  await expect(c.getByRole("button", { name: "December" })).toBeVisible();
  await c.getByRole("button", { name: "March" }).click();
  const mirror = c.getByTestId("mirror");
  await expect(mirror).toHaveAttribute("data-last-view", "month");
  await expect(c.getByRole("heading")).toHaveText("March 2026");
});

test("a fixed `now` marks its day as today and drives the Today button", async ({ mount }) => {
  const fixed = new Date(2026, 2, 11, 10, 30);
  const c = await mount(<CalendarHarness now={fixed} defaultValue={fixed} />);
  // The 11 March cell is marked today.
  await expect(c.getByRole("button", { name: "11", exact: true }).first()).toHaveAttribute(
    "data-today",
    "true",
  );
  // Today navigates back to the fixed reference day, not the real clock.
  await c.getByRole("button", { name: "Next month" }).click();
  await c.getByRole("button", { name: "Today" }).click();
  await expect(c.getByTestId("mirror")).toHaveAttribute("data-last-nav", "2026-3-11");
});

test("Today returns navigation to the current date", async ({ mount }) => {
  const c = await mount(<CalendarHarness />);
  await c.getByRole("button", { name: "Next month" }).click();
  await c.getByRole("button", { name: "Today" }).click();
  const now = new Date();
  const expected = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  await expect(c.getByTestId("mirror")).toHaveAttribute("data-last-nav", expected);
});
