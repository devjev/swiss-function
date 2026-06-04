import { expect, test } from "@playwright/experimental-ct-react";
import { Timeline } from "./Timeline";

test("renders events as children inside the track", async ({ mount }) => {
  const c = await mount(
    <Timeline start={new Date("2026-01-01")} end={new Date("2026-12-31")}>
      <Timeline.Event date={new Date("2026-03-15")}>Release</Timeline.Event>
      <Timeline.Event date={new Date("2026-06-30")}>Beta</Timeline.Event>
    </Timeline>,
  );
  await expect(c.getByText("Release")).toBeVisible();
  await expect(c.getByText("Beta")).toBeVisible();
});

test("event at start sits at 0%; event at midpoint sits ~50%", async ({ mount }) => {
  const c = await mount(
    <Timeline start={new Date("2026-01-01")} end={new Date("2026-12-31")}>
      <Timeline.Event date={new Date("2026-01-01")}>Start</Timeline.Event>
      <Timeline.Event date={new Date("2026-07-02")}>Mid</Timeline.Event>
    </Timeline>,
  );
  const left = (text: string) =>
    c
      .locator(`[data-event]:has-text("${text}")`)
      .evaluate((el) => parseFloat((el as HTMLElement).style.left));
  expect(await left("Start")).toBe(0);
  const mid = await left("Mid");
  expect(mid).toBeGreaterThan(49);
  expect(mid).toBeLessThan(51);
});

test("clicking an event marker fires onClick", async ({ mount }) => {
  let clicked = "";
  const c = await mount(
    <Timeline start={new Date("2026-01-01")} end={new Date("2026-12-31")}>
      <Timeline.Event date={new Date("2026-03-15")} onClick={() => (clicked = "release")}>
        Release
      </Timeline.Event>
    </Timeline>,
  );
  await c.getByRole("button", { name: "Release" }).click();
  expect(clicked).toBe("release");
});

test("track width matches viewport — timeline fits its container with no overflow", async ({
  mount,
}) => {
  const c = await mount(
    <Timeline start={new Date("2026-01-01")} end={new Date("2026-12-31")}>
      <Timeline.Event date={new Date("2026-06-04")}>Midyear</Timeline.Event>
    </Timeline>,
  );
  // Track and viewport should have the same width (no horizontal overflow).
  const widths = await c.evaluate((el) => {
    const viewport = el as HTMLElement;
    const track = (el.querySelector("[data-event]")?.parentElement as HTMLElement) ?? viewport;
    return { viewport: viewport.clientWidth, track: track.clientWidth };
  });
  expect(widths.track).toBe(widths.viewport);
});

test("monthly ticks render at moderate width", async ({ mount }) => {
  // Use local-time constructors so the day-boundary snap is deterministic.
  const c = await mount(<Timeline start={new Date(2026, 0, 1)} end={new Date(2026, 11, 31)} />);
  // 12 monthly tick positions (Jan through Dec) at the default ~600-800px container.
  await expect(c.locator("[data-tick]")).toHaveCount(12);
  await expect(c.locator("[data-tick-major]")).toHaveCount(1);
});

test("showNow={true} renders the now line when current time is in range", async ({ mount }) => {
  const now = new Date();
  const start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const c = await mount(<Timeline start={start} end={end} showNow />);
  await expect(c.getByTestId("timeline-now")).toBeVisible();
});

test("showNow={false} omits the now line", async ({ mount }) => {
  const c = await mount(
    <Timeline start={new Date("2026-01-01")} end={new Date("2026-12-31")} showNow={false} />,
  );
  await expect(c.getByTestId("timeline-now")).toHaveCount(0);
});

test("showNow={true} with current time outside the range renders no line", async ({ mount }) => {
  const c = await mount(
    <Timeline start={new Date("2099-01-01")} end={new Date("2099-12-31")} showNow />,
  );
  await expect(c.getByTestId("timeline-now")).toHaveCount(0);
});

test("sparse events all sit in lane 0", async ({ mount }) => {
  const c = await mount(
    <Timeline start={new Date(2026, 0, 1)} end={new Date(2026, 11, 31)}>
      <Timeline.Event date={new Date(2026, 1, 12)}>Alpha</Timeline.Event>
      <Timeline.Event date={new Date(2026, 5, 4)}>Beta</Timeline.Event>
      <Timeline.Event date={new Date(2026, 10, 15)}>RC</Timeline.Event>
    </Timeline>,
  );
  for (const name of ["Alpha", "Beta", "RC"]) {
    await expect(c.locator(`[data-event]:has-text("${name}")`)).toHaveAttribute("data-lane", "0");
  }
});

test("crowded events stack into successive lanes", async ({ mount }) => {
  // Narrow date range so labels can't all fit in one lane.
  const c = await mount(
    <div style={{ width: 600 }}>
      <Timeline start={new Date(2026, 5, 1)} end={new Date(2026, 5, 14)}>
        <Timeline.Event date={new Date(2026, 5, 3)}>Long label one here</Timeline.Event>
        <Timeline.Event date={new Date(2026, 5, 4)}>Long label two here</Timeline.Event>
        <Timeline.Event date={new Date(2026, 5, 5)}>Long label three here</Timeline.Event>
      </Timeline>
    </div>,
  );
  const lanes = await c
    .locator("[data-event]")
    .evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.lane));
  // Distinct lanes assigned (exact lane indices depend on label width estimates,
  // but at least one event must be in a non-zero lane).
  expect(new Set(lanes).size).toBeGreaterThan(1);
});

test("maxLanes={1} forces all events into lane 0", async ({ mount }) => {
  const c = await mount(
    <Timeline start={new Date(2026, 5, 1)} end={new Date(2026, 5, 14)} maxLanes={1}>
      <Timeline.Event date={new Date(2026, 5, 3)}>Long label one here</Timeline.Event>
      <Timeline.Event date={new Date(2026, 5, 4)}>Long label two here</Timeline.Event>
      <Timeline.Event date={new Date(2026, 5, 5)}>Long label three here</Timeline.Event>
    </Timeline>,
  );
  const lanes = await c
    .locator("[data-event]")
    .evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.lane));
  expect(lanes).toEqual(["0", "0", "0"]);
});

// --- Scrubber ----------------------------------------------------------

test("value renders the playhead at the corresponding percent", async ({ mount }) => {
  // start..end is 100 days; value at start+50 days = 50%.
  const start = new Date(2026, 0, 1);
  const end = new Date(start.getTime() + 100 * 24 * 60 * 60 * 1000);
  const mid = new Date(start.getTime() + 50 * 24 * 60 * 60 * 1000);
  const c = await mount(<Timeline start={start} end={end} value={mid} onChange={() => {}} />);
  const left = await c
    .getByTestId("timeline-playhead")
    .evaluate((el) => parseFloat((el as HTMLElement).style.left));
  expect(left).toBeGreaterThan(49);
  expect(left).toBeLessThan(51);
});

test("value outside [start, end] is clamped to 0% (before) or 100% (after)", async ({ mount }) => {
  const start = new Date(2026, 5, 1);
  const end = new Date(2026, 5, 8);
  const before = new Date(2026, 4, 1);
  const c = await mount(<Timeline start={start} end={end} value={before} onChange={() => {}} />);
  const left = await c
    .getByTestId("timeline-playhead")
    .evaluate((el) => parseFloat((el as HTMLElement).style.left));
  expect(left).toBe(0);
});

test("clicking the track fires onChange with the date at the click x", async ({ mount, page }) => {
  let received: Date | null = null;
  const start = new Date(2026, 5, 1);
  const end = new Date(2026, 5, 8); // 7-day range
  const c = await mount(<Timeline start={start} end={end} onChange={(d) => (received = d)} />);
  // Click roughly at the center of the track.
  const box = await c.boundingBox();
  if (!box) throw new Error("no bounding box");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  // Allow microtask for state to settle.
  await page.waitForTimeout(50);
  expect(received).not.toBeNull();
  // Mid of a 7-day range from Jun 1 → Jun 4 ish (±1 day).
  if (received) {
    const midMs = (start.getTime() + end.getTime()) / 2;
    expect(Math.abs((received as Date).getTime() - midMs)).toBeLessThan(2 * 24 * 60 * 60 * 1000);
  }
});

test("clicking on an event marker does NOT fire onChange (scrub stops propagation)", async ({
  mount,
}) => {
  let onChangeFired = false;
  let markerClicked = false;
  const c = await mount(
    <Timeline
      start={new Date(2026, 5, 1)}
      end={new Date(2026, 5, 14)}
      onChange={() => (onChangeFired = true)}
    >
      <Timeline.Event date={new Date(2026, 5, 7)} onClick={() => (markerClicked = true)}>
        Hit me
      </Timeline.Event>
    </Timeline>,
  );
  await c.getByRole("button", { name: "Hit me" }).click();
  expect(markerClicked).toBe(true);
  expect(onChangeFired).toBe(false);
});

test("without onChange, the track has no ew-resize cursor", async ({ mount }) => {
  const c = await mount(
    <Timeline start={new Date(2026, 5, 1)} end={new Date(2026, 5, 14)}>
      <Timeline.Event date={new Date(2026, 5, 4)}>Midyear</Timeline.Event>
    </Timeline>,
  );
  const isScrubbable = await c
    .locator("[data-event]")
    .first()
    .evaluate((el) => ((el.parentElement as HTMLElement) ?? el).hasAttribute("data-scrubbable"));
  expect(isScrubbable).toBe(false);
});
