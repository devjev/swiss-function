import { expect, test } from "@playwright/experimental-ct-react";
import { Compare } from "./Density.stories";

// Pins the density contract (tokens.css → Density): the default is compact
// (14px on a 20px unit), `data-density="comfortable"` restores 16px on 24px,
// and the components that need the unit in px (a DataTable's virtualised
// rows) follow the region they are mounted in.

const metrics = (root: Element) => {
  const px = (el: Element | null, prop: string) =>
    el ? Number.parseFloat(getComputedStyle(el).getPropertyValue(prop)) : Number.NaN;
  const button = root.querySelector("button");
  const input = root.querySelector("input");
  const rows = [...root.querySelectorAll('[role="row"]')].filter((r) =>
    r.querySelector('[role="gridcell"]'),
  );
  const first = rows[0]?.getBoundingClientRect();
  const second = rows[1]?.getBoundingClientRect();
  return {
    font: px(root, "font-size"),
    line: px(root, "line-height"),
    button: button?.getBoundingClientRect().height,
    input: input?.getBoundingClientRect().height,
    row: first?.height,
    // The offset between two rows is the virtualizer's, the height is the CSS's.
    pitch: first && second ? second.top - first.top : Number.NaN,
  };
};

test("compact is the default; comfortable restores the 24px unit, table rows included", async ({
  mount,
}) => {
  const c = await mount(<Compare />);
  const compact = c.locator('[data-density="compact"]');
  const comfortable = c.locator('[data-density="comfortable"]');
  await expect(compact.getByRole("gridcell").first()).toBeVisible();
  await expect(comfortable.getByRole("gridcell").first()).toBeVisible();

  await expect
    .poll(() => compact.evaluate(metrics))
    .toEqual({
      font: 14,
      line: 20,
      button: 30,
      input: 30,
      row: 25,
      pitch: 25,
    });
  await expect
    .poll(() => comfortable.evaluate(metrics))
    .toEqual({
      font: 16,
      line: 24,
      button: 36,
      input: 36,
      row: 36,
      pitch: 36,
    });
});

test("a region without the attribute takes the compact default", async ({ mount }) => {
  const c = await mount(
    <div>
      <button type="button" style={{ blockSize: "calc(var(--sf-unit) * 1.5)" }}>
        probe
      </button>
    </div>,
  );
  const h = await c.getByRole("button").evaluate((el) => el.getBoundingClientRect().height);
  expect(h).toBe(30);
});

test("a light theme element nested in a comfortable region keeps that density", async ({
  mount,
}) => {
  const c = await mount(
    <div data-density="comfortable">
      <div data-theme="light">
        <div data-testid="probe" style={{ blockSize: "var(--sf-unit)" }} />
      </div>
    </div>,
  );
  const h = await c.getByTestId("probe").evaluate((el) => el.getBoundingClientRect().height);
  expect(h).toBe(24);
});
