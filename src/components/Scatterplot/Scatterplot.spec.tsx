import { expect, test } from "@playwright/experimental-ct-react";
import { type ChartAnnotation, Scatterplot } from "./Scatterplot";
import { EditableScatterplot } from "./Scatterplot.harness";

// Pins the delegated-hover contract of the memo'd point layer (issue #14):
// per-point a11y attributes and <title> children stay, and hover/focus resolve
// through one handler pair on the series <g> via closest("[data-idx]").

const DATA = [
  { x: 1, y: 12 },
  { x: 2, y: 18 },
  { x: 3, y: 14 },
  { x: 4, y: 22 },
];

const SERIES = [{ name: "S", data: DATA }];

test("renders one focusable point per datum with a11y attrs and a <title>", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Scatterplot series={SERIES} height={240} showLegend={false} />
    </div>,
  );
  await expect(c.locator("circle[data-idx]")).toHaveCount(4);
  const point = c.locator("circle[data-idx='1']");
  await expect(point).toHaveAttribute("role", "button");
  await expect(point).toHaveAttribute("aria-label", "S: 18");
  await expect(point.locator("title")).toHaveText("S: 18");
});

test("hovering a point shows the tooltip and marks the chart hovered", async ({ mount, page }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Scatterplot series={SERIES} height={240} showLegend={false} />
    </div>,
  );
  await c.locator("circle[data-idx='2']").hover();
  await expect(page.getByRole("tooltip")).toContainText("S");
  await expect(c.locator("[data-hovered='true']")).toHaveCount(1);
  await page.mouse.move(1, 1);
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  await expect(c.locator("[data-hovered='true']")).toHaveCount(0);
});

test("keyboard focus on a point shows the tooltip; blur hides it", async ({ mount, page }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Scatterplot series={SERIES} height={240} showLegend={false} />
    </div>,
  );
  const point = c.locator("circle[data-idx='0']");
  await point.focus();
  await expect(page.getByRole("tooltip")).toContainText("1, 12");
  await point.blur();
  await expect(page.getByRole("tooltip")).toHaveCount(0);
});

// --- Interactive viewport (issue #27) --------------------------------------

// A 0..100 numeric line so announcement values are easy to reason about.
const ZOOM_SERIES = [
  {
    name: "Z",
    data: Array.from({ length: 101 }, (_, i) => ({ x: i, y: 50 + 40 * Math.sin(i / 7) })),
    showLine: true,
    showPoints: false,
  },
];

const ZOOMABLE_CHART = (
  <div style={{ width: 480 }}>
    <Scatterplot series={ZOOM_SERIES} height={240} showLegend={false} scaffolding="full" zoomable />
  </div>
);

test("wheel zoom is gated behind a click, then anchors at the cursor", async ({ mount, page }) => {
  const c = await mount(ZOOMABLE_CHART);
  const svg = c.locator("svg");
  const box = await svg.boundingBox();
  if (!box) throw new Error("no svg box");

  // Not armed yet: a plain wheel must not zoom (no Reset affordance).
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.5);
  await page.mouse.wheel(0, -240);
  await expect(c.getByRole("button", { name: "Reset" })).toHaveCount(0);

  // Arm with a click, zoom in at 75% across the plot.
  await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.5);
  await page.mouse.wheel(0, -240);
  await expect(c.getByRole("button", { name: "Reset" })).toBeVisible();

  // The live region reports the window; anchored at 75%, more range is cut on
  // the left than on the right.
  const announced = await c.locator("[aria-live]").textContent();
  const nums = (announced ?? "").match(/[\d.]+/g)?.map(Number) ?? [];
  const [from, to] = nums;
  if (from == null || to == null) throw new Error(`unparsable announcement: ${announced}`);
  expect(from).toBeGreaterThan(0);
  expect(to).toBeLessThan(100);
  expect(from).toBeGreaterThan(100 - to);
});

test("drag pans the zoomed window; double-click resets", async ({ mount, page }) => {
  const c = await mount(ZOOMABLE_CHART);
  const svg = c.locator("svg");
  const box = await svg.boundingBox();
  if (!box) throw new Error("no svg box");
  const cx = box.x + box.width * 0.5;
  const cy = box.y + box.height * 0.5;

  await page.mouse.click(cx, cy);
  await page.mouse.wheel(0, -480);
  await expect(c.getByRole("button", { name: "Reset" })).toBeVisible();
  const before = await c.locator("[aria-live]").textContent();

  // Drag right = pan left (earlier values).
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 120, cy, { steps: 5 });
  await page.mouse.up();
  const after = await c.locator("[aria-live]").textContent();
  expect(after).not.toBe(before);
  const firstBefore = Number((before ?? "").match(/[\d.]+/)?.[0]);
  const firstAfter = Number((after ?? "").match(/[\d.]+/)?.[0]);
  expect(firstAfter).toBeLessThan(firstBefore);

  await page.mouse.dblclick(cx, cy);
  await expect(c.getByRole("button", { name: "Reset" })).toHaveCount(0);
  await expect(c.locator("[aria-live]")).toHaveText("Showing full range");
});

test("keyboard: +/- zoom, arrows pan, 0 resets on the focused chart", async ({ mount, page }) => {
  const c = await mount(ZOOMABLE_CHART);
  const root = c.locator("[data-zoomable]");
  await root.focus();
  await page.keyboard.press("+");
  await expect(c.getByRole("button", { name: "Reset" })).toBeVisible();
  const zoomed = await c.locator("[aria-live]").textContent();
  await page.keyboard.press("ArrowRight");
  const panned = await c.locator("[aria-live]").textContent();
  expect(panned).not.toBe(zoomed);
  await page.keyboard.press("0");
  await expect(c.getByRole("button", { name: "Reset" })).toHaveCount(0);
});

test("annotations render as a non-interactive data-space overlay", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Scatterplot
        series={SERIES}
        height={240}
        showLegend={false}
        scaffolding="full"
        annotations={[
          { type: "hline", y: 15, label: "Limit" },
          { type: "vline", x: 2, label: "Event" },
          { type: "rect", x1: 1, x2: 2, label: "Band" },
          { type: "measure", x1: 1, y1: 12, x2: 4, y2: 22 },
        ]}
      />
    </div>,
  );
  const overlay = c.locator("g[data-annotations]").last();
  await expect(overlay.locator("line")).toHaveCount(3); // hline + vline + measure
  await expect(overlay.locator("rect")).toHaveCount(1);
  await expect(overlay.locator("text").filter({ hasText: "Limit" })).toBeVisible();
  // Measure readout shows Δx and Δy (+83.3%).
  await expect(overlay.locator("text").filter({ hasText: "Δ 10" })).toBeVisible();
});

test("onPointActivate fires on click and Enter", async ({ mount }) => {
  const activated: string[] = [];
  const c = await mount(
    <div style={{ width: 480 }}>
      <Scatterplot
        series={SERIES}
        height={240}
        showLegend={false}
        onPointActivate={(d) => activated.push(`${d.series}:${String(d.x)}`)}
      />
    </div>,
  );
  await c.locator("circle[data-idx='1']").click();
  await expect.poll(() => activated).toEqual(["S:2"]);
  await c.locator("circle[data-idx='3']").focus();
  await c.locator("circle[data-idx='3']").press("Enter");
  await expect.poll(() => activated).toEqual(["S:2", "S:4"]);
});

// --- Chart window: controls toolbar + annotation editing (issue #27 M3) -----

test("controls: zoom mode drags a region to zoom; corner Reset button is absorbed", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <div style={{ width: 480 }}>
      <Scatterplot
        series={ZOOM_SERIES}
        height={240}
        showLegend={false}
        scaffolding="full"
        zoomable
        controls
      />
    </div>,
  );
  const toolbar = c.getByRole("toolbar", { name: "Chart controls" });
  await expect(toolbar).toBeVisible();
  const resetInToolbar = toolbar.getByRole("button", { name: "Reset view" });
  await expect(resetInToolbar).toBeDisabled();

  // Zoom is a mode: arm, drag the region, release → zoomed to it, disarmed.
  const zoomIn = toolbar.getByRole("button", { name: "Zoom in" });
  await zoomIn.click();
  await expect(zoomIn).toHaveAttribute("aria-pressed", "true");
  const box = await c.locator("svg[role='img']").boundingBox();
  if (!box) throw new Error("no svg box");
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.4, { steps: 5 });
  // The band is visible mid-drag.
  await expect(c.locator("svg[role='img'] rect").last()).toBeVisible();
  await page.mouse.up();
  await expect(c.locator("[aria-live]")).toContainText("Showing 25 to 75");
  await expect(zoomIn).toHaveAttribute("aria-pressed", "false");
  await expect(resetInToolbar).toBeEnabled();
  // The legacy floating corner button must not double up with the toolbar.
  await expect(c.getByRole("button", { name: /^Reset$/ })).toHaveCount(0);

  await toolbar.getByRole("button", { name: "Zoom out" }).click();
  await expect(c.locator("[aria-live]")).toHaveText("Showing full range");
});

test("line tool: drag draws in data space, one change event, tool snaps back", async ({
  mount,
  page,
}) => {
  const changes: ChartAnnotation[][] = [];
  const c = await mount(<EditableScatterplot onChange={(next) => changes.push(next)} />);
  const box = await c.locator("svg[role='img']").boundingBox();
  if (!box) throw new Error("no svg box");

  const lineTool = c.getByRole("button", { name: "Trend line" });
  await lineTool.click();
  await expect(lineTool).toHaveAttribute("aria-pressed", "true");

  // Drag from 25% to 75% across the plot.
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.3, { steps: 5 });
  await page.mouse.up();

  await expect.poll(() => changes.length).toBe(1);
  const drawn = changes[0]?.[0];
  if (!drawn || drawn.type !== "line") throw new Error(`expected a line, got ${drawn?.type}`);
  // Data-space coords: x domain is [0, 100] across the plot width.
  expect(Number(drawn.x1)).toBeGreaterThan(15);
  expect(Number(drawn.x1)).toBeLessThan(35);
  expect(Number(drawn.x2)).toBeGreaterThan(65);
  expect(Number(drawn.x2)).toBeLessThan(85);
  expect(drawn.id).toBeTruthy();
  // Snap back to select after the draw.
  await expect(c.getByRole("button", { name: "Select" })).toHaveAttribute("aria-pressed", "true");
  await expect(lineTool).toHaveAttribute("aria-pressed", "false");
});

test("hline places on click; a sub-threshold jiggle with the line tool creates nothing", async ({
  mount,
  page,
}) => {
  const changes: ChartAnnotation[][] = [];
  const c = await mount(<EditableScatterplot onChange={(next) => changes.push(next)} />);
  const box = await c.locator("svg[role='img']").boundingBox();
  if (!box) throw new Error("no svg box");

  await c.getByRole("button", { name: "Trend line" }).click();
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.7);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.5 + 2, box.y + box.height * 0.7 + 1);
  await page.mouse.up();
  expect(changes).toHaveLength(0);

  await c.getByRole("button", { name: "Horizontal line" }).click();
  // Aim below the toolbar strip that overlays the plot's top edge.
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.75);
  await expect.poll(() => changes.length).toBe(1);
  const drawn = changes[0]?.[0];
  if (!drawn || drawn.type !== "hline") throw new Error("expected an hline");
  // y domain follows the sine data (~10..90); 75% from the top ≈ lower quarter.
  expect(drawn.y).toBeLessThan(45);
});

test("pan is suspended while a tool is armed (drag draws instead)", async ({ mount, page }) => {
  const changes: ChartAnnotation[][] = [];
  const c = await mount(<EditableScatterplot onChange={(next) => changes.push(next)} />);
  const box = await c.locator("svg[role='img']").boundingBox();
  if (!box) throw new Error("no svg box");
  const live = c.locator("[aria-live]");

  // Zoom in first (keyboard step zoom) so a pan would change the announcement.
  await c.locator("[data-zoomable]").focus();
  await page.keyboard.press("+");
  const before = await live.textContent();

  await c.getByRole("button", { name: "Region" }).click();
  // Start below the toolbar strip that overlays the plot's top edge.
  await page.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.7, box.y + box.height * 0.85, { steps: 5 });
  await page.mouse.up();

  await expect.poll(() => changes.length).toBe(1);
  expect(changes[0]?.[0]?.type).toBe("rect");
  await expect(live).toHaveText(before ?? "");
});

test("select, handles, body drag (one event), delete, escape", async ({ mount, page }) => {
  const changes: ChartAnnotation[][] = [];
  const c = await mount(
    <EditableScatterplot
      initial={[{ type: "line", x1: 20, y1: 30, x2: 60, y2: 70, id: "trend" }]}
      onChange={(next) => changes.push(next)}
    />,
  );
  const box = await c.locator("svg[role='img']").boundingBox();
  if (!box) throw new Error("no svg box");

  // Click the line's hit stroke mid-way to select.
  const hit = c.locator("[data-annotation] [data-part='body']").first();
  await hit.click({ force: true });
  await expect(c.locator("[data-annotation][data-selected]")).toHaveCount(1);
  const handles = c.locator("rect[data-part]");
  await expect(handles).toHaveCount(2); // p1 + p2

  // Body drag: exactly one change with both anchors translated.
  const hitBox = await hit.boundingBox();
  if (!hitBox) throw new Error("no hit box");
  await page.mouse.move(hitBox.x + hitBox.width / 2, hitBox.y + hitBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(hitBox.x + hitBox.width / 2 + 60, hitBox.y + hitBox.height / 2, {
    steps: 5,
  });
  await page.mouse.up();
  await expect.poll(() => changes.length).toBe(1);
  const moved = changes[0]?.[0];
  if (!moved || moved.type !== "line") throw new Error("expected the line");
  const dx = Number(moved.x1) - 20;
  expect(dx).toBeGreaterThan(5);
  expect(Number(moved.x2) - 60).toBeCloseTo(dx, 1);

  // Escape deselects; Delete removes.
  await c.locator("[data-zoomable]").focus();
  await page.keyboard.press("Escape");
  await expect(c.locator("[data-annotation][data-selected]")).toHaveCount(0);
  await c.locator("[data-annotation] [data-part='body']").first().click({ force: true });
  await expect(c.locator("[data-annotation][data-selected]")).toHaveCount(1);
  await page.keyboard.press("Delete");
  await expect.poll(() => changes.length).toBe(2);
  expect(changes[1]).toHaveLength(0);
});

test("text tool: inline input commits on Enter; typing digits does not zoom-reset", async ({
  mount,
  page,
}) => {
  const changes: ChartAnnotation[][] = [];
  const c = await mount(<EditableScatterplot onChange={(next) => changes.push(next)} />);
  const box = await c.locator("svg[role='img']").boundingBox();
  if (!box) throw new Error("no svg box");
  const live = c.locator("[aria-live]");

  await c.locator("[data-zoomable]").focus();
  await page.keyboard.press("+");
  const zoomed = await live.textContent();

  await c.getByRole("button", { name: "Text note" }).click();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  const input = c.getByRole("textbox", { name: "Annotation text" });
  await expect(input).toBeFocused();
  await input.fill("peak 0");
  await input.press("Enter");

  await expect.poll(() => changes.length).toBe(1);
  const note = changes[0]?.[0];
  if (!note || note.type !== "text") throw new Error("expected a text note");
  expect(note.text).toBe("peak 0");
  // The "0" typed into the note must not have reset the viewport.
  await expect(live).toHaveText(zoomed ?? "");
});

test("fullscreen: toggle expands; Escape with a selection deselects without exiting", async ({
  mount,
  page,
}) => {
  const c = await mount(
    <EditableScatterplot fullscreen initial={[{ type: "hline", y: 50, id: "level" }]} />,
  );
  await c.getByRole("button", { name: "Enter fullscreen" }).click();
  await expect(c.locator("[data-expanded]")).toHaveCount(1);

  // Select the hline, then Escape: deselect only.
  await c.locator("[data-annotation] [data-part='body']").first().click({ force: true });
  await expect(c.locator("[data-annotation][data-selected]")).toHaveCount(1);
  await c.locator("[data-zoomable]").focus();
  await page.keyboard.press("Escape");
  await expect(c.locator("[data-annotation][data-selected]")).toHaveCount(0);
  await expect(c.locator("[data-expanded]")).toHaveCount(1);

  // A second Escape (nothing left to cancel) exits fullscreen.
  await page.keyboard.press("Escape");
  await expect(c.locator("[data-expanded]")).toHaveCount(0);
});

test("armed zoom mode owns the gesture: wheel, dblclick and toolbar presses are inert", async ({
  mount,
  page,
}) => {
  const c = await mount(<EditableScatterplot />);
  const live = c.locator("[aria-live]");
  const zoomIn = c.getByRole("button", { name: "Zoom in" });
  const box = await c.locator("svg[role='img']").boundingBox();
  if (!box) throw new Error("no svg box");

  await zoomIn.click();
  await expect(zoomIn).toHaveAttribute("aria-pressed", "true");
  // Residual trackpad scroll after arming must not zoom before the drag.
  await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.6);
  await page.mouse.wheel(0, -480);
  await expect(live).toHaveText("");
  // Impatient double-click on the plot must not reset/apply anything.
  await page.mouse.dblclick(box.x + box.width * 0.5, box.y + box.height * 0.6);
  await expect(live).toHaveText("");
  // Re-clicking the toolbar button (its press bubbles through the plot)
  // disarms cleanly without starting a phantom selection.
  await zoomIn.click();
  await expect(zoomIn).toHaveAttribute("aria-pressed", "false");
  await expect(live).toHaveText("");

  // And the actual gesture still works, with readably-rounded announcements.
  await zoomIn.click();
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height * 0.6);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.75, box.y + box.height * 0.4, { steps: 5 });
  await page.mouse.up();
  await expect(live).toContainText("Showing 25 to 75");
});
