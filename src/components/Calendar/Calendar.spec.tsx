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

test("week view: the day columns line up with their headings under a classic scrollbar", async ({
  mount,
  page,
}) => {
  const c = await mount(<CalendarHarness defaultView="week" />);
  // Headless Chromium draws overlay scrollbars, which take no width. A stable
  // gutter reserves one, as a classic scrollbar does on Windows and Linux.
  await page.addStyleTag({
    content: '[class*="weekBody"]{ scrollbar-gutter: stable !important; }',
  });
  const edges = (selector: string) =>
    c.locator(selector).evaluateAll((els) =>
      els.map((el) => {
        const r = el.getBoundingClientRect();
        return [Math.round(r.left), Math.round(r.right)];
      }),
    );
  await expect
    .poll(async () => JSON.stringify(await edges('[class*="weekDayHead"]')))
    .toBe(JSON.stringify(await edges('[class*="dayColumn"]')));
  // The gutter is really there: the hour grid is narrower than its scroller.
  const reserved = await c
    .locator('[class*="weekBody"]')
    .evaluate((el) => (el as HTMLElement).offsetWidth - el.clientWidth);
  expect(reserved).toBeGreaterThan(0);
});

test("week view: a short event shows its time whole, and the all-day label keeps one line", async ({
  mount,
}) => {
  const c = await mount(<CalendarHarness defaultView="week" shortEvent />);
  // Standup runs 09:00-09:15: one line tall, its time inside the block.
  const standup = c.locator('button[title="Standup"]').first();
  const fit = await standup.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const time = (el.querySelector('[class*="blockTime"]') as HTMLElement).getBoundingClientRect();
    return {
      height: box.height,
      inside: time.top >= box.top - 0.5 && time.bottom <= box.bottom + 0.5,
    };
  });
  expect(fit.height).toBeGreaterThanOrEqual(20);
  expect(fit.inside).toBe(true);
  await expect(standup).toContainText("09:00");
  await expect(standup).toContainText("Standup");
  const label = c.locator('[class*="allDayLabel"]');
  const lines = await label.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return range.getClientRects().length;
  });
  expect(lines).toBe(1);
});

// --- Narrow containers -------------------------------------------------------
// The calendar reads its own width (the harness frame), not the viewport.

/** Do two boxes share any area (beyond half a pixel of rounding)? */
const overlap = (
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
) =>
  Math.min(a.right, b.right) - Math.max(a.left, b.left) > 0.5 &&
  Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 0.5;

test("week view: a narrow calendar shows three days from the focused date and steps by three", async ({
  mount,
}) => {
  const c = await mount(<CalendarHarness width={390} defaultView="week" />);
  const root = c.getByRole("group", { name: "Calendar", exact: true });
  await expect(root).toHaveAttribute("data-week-days", "3");
  await expect(c.locator('[class*="dayColumn"]')).toHaveCount(3);
  // Wed 11 (the focused date) to Fri 13.
  await expect(c.getByRole("heading")).toHaveText("11-13 Mar 2026");
  await expect(c.locator('[class*="weekDayNum"]')).toHaveText(["11", "12", "13"]);

  // The strip is cut to the window: both bars started before it, and the
  // week-long one also runs past it.
  const oncall = c.getByRole("button", { name: /On call/ });
  await expect(oncall).toHaveAttribute("data-continues-before", "true");
  await expect(oncall).toHaveAttribute("data-continues-after", "true");
  const conf = c.getByRole("button", { name: /Design conference/ });
  await expect(conf).toHaveAttribute("data-continues-before", "true");
  await expect(conf).not.toHaveAttribute("data-continues-after", "true");

  // Overlapping events keep their side-by-side columns in the sliced range.
  const a = await c.getByRole("button", { name: /Planning/ }).boundingBox();
  const b = await c.getByRole("button", { name: /Platform sync/ }).boundingBox();
  expect(a && b && (a.x + a.width <= b.x + 1 || b.x + b.width <= a.x + 1)).toBeTruthy();

  await c.getByRole("button", { name: "Next 3 days" }).click();
  await expect(c.getByRole("heading")).toHaveText("14-16 Mar 2026");
  await expect(c.getByTestId("mirror")).toHaveAttribute("data-last-nav", "2026-3-14");
  await c.getByRole("button", { name: "Previous 3 days" }).click();
  await c.getByRole("button", { name: "Previous 3 days" }).click();
  await expect(c.getByRole("heading")).toHaveText("8-10 Mar 2026");
});

test("week view: a calendar too narrow for three days shows one, with the now-line on today", async ({
  mount,
}) => {
  const fixed = new Date(2026, 2, 11, 10, 30);
  const c = await mount(<CalendarHarness width={260} defaultView="week" now={fixed} />);
  await expect(c.getByRole("group", { name: "Calendar", exact: true })).toHaveAttribute(
    "data-week-days",
    "1",
  );
  await expect(c.locator('[class*="dayColumn"]')).toHaveCount(1);
  await expect(c.getByRole("heading")).toHaveText("11 Mar 2026");
  await expect(c.locator('[class*="nowLine"]')).toHaveCount(1);
  await c.getByRole("button", { name: "Next day" }).click();
  await expect(c.getByRole("heading")).toHaveText("12 Mar 2026");
  await expect(c.locator('[class*="nowLine"]')).toHaveCount(0);
});

test("week view: the day count follows the calendar as its container resizes", async ({
  mount,
}) => {
  const c = await mount(<CalendarHarness defaultView="week" />);
  const root = c.getByRole("group", { name: "Calendar", exact: true });
  await expect(root).toHaveAttribute("data-week-days", "7");
  const frame = root.locator("xpath=..");
  await frame.evaluate((el) => {
    (el as HTMLElement).style.width = "420px";
  });
  await expect(root).toHaveAttribute("data-week-days", "3");
  await frame.evaluate((el) => {
    (el as HTMLElement).style.width = "960px";
  });
  await expect(root).toHaveAttribute("data-week-days", "7");
  await expect(c.getByRole("heading")).toHaveText("9-15 Mar 2026");
});

test("weekDays fixes the count: seven narrow columns stack the number under the weekday", async ({
  mount,
}) => {
  for (const width of [390, 320, 230]) {
    const c = await mount(<CalendarHarness width={width} defaultView="week" weekDays={7} />);
    await expect(c.locator('[class*="dayColumn"]')).toHaveCount(7);
    await expect(c.getByRole("heading")).toHaveText("9-15 Mar 2026");
    const heads = await c.locator('[class*="weekDayHead"]').evaluateAll((cells) =>
      cells.map((cell) => {
        const box = (el: Element) => {
          const r = el.getBoundingClientRect();
          return { left: r.left, right: r.right, top: r.top, bottom: r.bottom, width: r.width };
        };
        // The short name or its initial: the one that kept a width.
        const names = [...cell.querySelectorAll('[class*="dow"]')].map(box);
        return {
          cell: box(cell),
          names: names.filter((n) => n.width > 0.5),
          num: box(cell.querySelector('[class*="weekDayNum"]') as Element),
        };
      }),
    );
    expect(heads).toHaveLength(7);
    for (const head of heads) {
      expect(head.names, `one weekday name at ${width}px`).toHaveLength(1);
      const name = head.names[0] as (typeof head.names)[number];
      expect(overlap(name, head.num), `name over number at ${width}px`).toBe(false);
      // Stacked: the number sits under the name, both inside the cell.
      expect(head.num.top).toBeGreaterThanOrEqual(name.bottom - 1);
      for (const part of [name, head.num]) {
        expect(part.left).toBeGreaterThanOrEqual(head.cell.left - 0.75);
        expect(part.right).toBeLessThanOrEqual(head.cell.right + 0.75);
      }
    }
    await c.unmount();
  }
});

test("week view: a block shows its start time whole or not at all", async ({ mount }) => {
  for (const [width, weekDays] of [
    [390, "auto"],
    [390, 7],
    [760, 7],
  ] as const) {
    const c = await mount(
      <CalendarHarness width={width} defaultView="week" weekDays={weekDays} shortEvent />,
    );
    const times = await c.locator('[class*="blockTime"]').evaluateAll((els) =>
      els.map((el) => {
        const box = el.getBoundingClientRect();
        const block = (el.closest("button") as HTMLElement).getBoundingClientRect();
        const range = document.createRange();
        range.selectNodeContents(el.firstChild as Node);
        const text = range.getBoundingClientRect();
        return {
          shown: box.width > 0.5 && box.height > 0.5,
          whole: text.right <= box.right + 0.75 && text.right <= block.right,
        };
      }),
    );
    expect(times.length).toBeGreaterThan(0);
    for (const time of times) {
      if (time.shown) expect(time.whole, `time cut at ${width}px`).toBe(true);
    }
    await c.unmount();
  }
});

test("the toolbar wraps instead of clipping: every key stays inside a narrow calendar", async ({
  mount,
}) => {
  for (const width of [390, 320, 240]) {
    for (const view of ["month", "week"] as const) {
      const c = await mount(<CalendarHarness width={width} defaultView={view} />);
      const root = c.getByRole("group", { name: "Calendar", exact: true });
      const frame = await root.boundingBox();
      if (!frame) throw new Error("no calendar");
      const parts = [
        c.getByRole("button", { name: /^Previous / }),
        c.getByRole("button", { name: "Today" }),
        c.getByRole("button", { name: /^Next / }),
        c.getByRole("heading"),
        c.getByRole("button", { name: "Month", exact: true }),
        c.getByRole("button", { name: "Week", exact: true }),
        c.getByRole("button", { name: "Year", exact: true }),
      ];
      const boxes = [];
      for (const part of parts) {
        const box = await part.boundingBox();
        if (!box) throw new Error("toolbar part not rendered");
        expect(box.x, `${view} at ${width}px`).toBeGreaterThanOrEqual(frame.x);
        expect(box.x + box.width, `${view} at ${width}px`).toBeLessThanOrEqual(
          frame.x + frame.width,
        );
        boxes.push({
          left: box.x,
          right: box.x + box.width,
          top: box.y,
          bottom: box.y + box.height,
        });
      }
      for (let i = 0; i < boxes.length; i++) {
        for (let j = i + 1; j < boxes.length; j++) {
          const [a, b] = [boxes[i], boxes[j]];
          if (a && b) expect(overlap(a, b), `parts ${i} and ${j} at ${width}px`).toBe(false);
        }
      }
      // The title is whole, not ellipsized.
      const cut = await c.getByRole("heading").evaluate((el) => el.scrollWidth - el.clientWidth);
      expect(cut).toBeLessThanOrEqual(1);
      // Still operable: the switcher is reachable by a click.
      await c.getByRole("button", { name: "Year", exact: true }).click();
      await expect(root).toHaveAttribute("data-view", "year");
      await c.unmount();
    }
  }
});

test("month view, narrow cells: '+N' on one line, and a bar shows a readable label or none", async ({
  mount,
}) => {
  const c = await mount(<CalendarHarness width={390} busyDay />);
  const more = c.getByRole("button", { name: /^\+\d+ more$/ });
  await expect(more).toBeVisible();
  const key = await more.evaluate((el) => {
    const word = el.querySelector('[class*="moreWord"]') as HTMLElement;
    const slot = (el.parentElement as HTMLElement).getBoundingClientRect();
    const box = el.getBoundingClientRect();
    return {
      height: box.height,
      line: Number.parseFloat(getComputedStyle(el).lineHeight),
      word: word.getBoundingClientRect().width,
      inside: box.left >= slot.left - 0.75 && box.right <= slot.right + 0.75,
    };
  });
  // One line, the word dropped, inside its day column.
  expect(key.height).toBeLessThanOrEqual(key.line + 1);
  expect(key.word).toBeLessThan(0.5);
  expect(key.inside).toBe(true);

  const labels = await c.locator('[class*="barLabel"]').evaluateAll((els) =>
    els.map((el) => ({
      width: el.getBoundingClientRect().width,
      em: Number.parseFloat(getComputedStyle(el).fontSize),
    })),
  );
  // A one-day bar has no room: no label. The spanning bars keep theirs.
  expect(labels.some((l) => l.width < 0.5)).toBe(true);
  expect(labels.some((l) => l.width > 0.5)).toBe(true);
  for (const label of labels) {
    if (label.width > 0.5) expect(label.width).toBeGreaterThanOrEqual(label.em * 3 - 0.5);
  }
  // A bar without a label still takes the click.
  await c.locator('button[title="Planning"]').click();
  await expect(c.getByTestId("mirror")).toHaveAttribute("data-last-event", "planning");
  // The key drills into that day's week, which is three days from it here.
  await more.click();
  await expect(c.getByTestId("mirror")).toHaveAttribute("data-last-view", "week");
  await expect(c.getByRole("heading")).toHaveText("11-13 Mar 2026");
});

test("month view, wide cells: the key keeps its word and the bars their labels", async ({
  mount,
}) => {
  const c = await mount(<CalendarHarness busyDay />);
  const word = c.getByRole("button", { name: /^\+\d+ more$/ }).locator('[class*="moreWord"]');
  expect(await word.evaluate((el) => el.getBoundingClientRect().width)).toBeGreaterThan(10);
  const widths = await c
    .locator('[class*="barLabel"]')
    .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().width));
  expect(widths.every((w) => w > 10)).toBe(true);
});
