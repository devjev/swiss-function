import { expect, test } from "@playwright/experimental-ct-react";
import { SplitPane } from "./SplitPane";

test("open shows the panel + a divider; closed collapses the panel", async ({ mount, page }) => {
  const c = await mount(
    <div style={{ inlineSize: 700, blockSize: 300 }}>
      <SplitPane defaultOpen side="right" defaultSize={300}>
        <SplitPane.Main>
          <div>main</div>
        </SplitPane.Main>
        <SplitPane.Panel data-testid="panel">
          <div>panel body</div>
        </SplitPane.Panel>
      </SplitPane>
    </div>,
  );
  await expect(c.getByRole("separator")).toBeVisible();
  const open = await c.getByTestId("panel").evaluate((el) => el.getBoundingClientRect().width);
  expect(open).toBeGreaterThan(250);

  // Close it: the divider goes away and the panel collapses to ~0.
  await c.update(
    <div style={{ inlineSize: 700, blockSize: 300 }}>
      <SplitPane open={false} side="right" defaultSize={300}>
        <SplitPane.Main>
          <div>main</div>
        </SplitPane.Main>
        <SplitPane.Panel data-testid="panel">
          <div>panel body</div>
        </SplitPane.Panel>
      </SplitPane>
    </div>,
  );
  await expect(c.getByRole("separator")).toHaveCount(0);
  await page.waitForTimeout(320); // let the collapse transition finish
  const closed = await c.getByTestId("panel").evaluate((el) => el.getBoundingClientRect().width);
  expect(closed).toBeLessThan(2);
});

test("dragging the divider toward the main pane grows the panel", async ({ mount, page }) => {
  const c = await mount(
    <div style={{ inlineSize: 700, blockSize: 300 }}>
      <SplitPane defaultOpen side="right" defaultSize={300} minSize={150} maxSize={600}>
        <SplitPane.Main>
          <div>main</div>
        </SplitPane.Main>
        <SplitPane.Panel data-testid="panel">
          <div>panel body</div>
        </SplitPane.Panel>
      </SplitPane>
    </div>,
  );
  const panel = c.getByTestId("panel");
  const before = await panel.boundingBox();
  const sep = await c.getByRole("separator").boundingBox();
  if (!before || !sep) throw new Error("missing boxes");

  // Right-edge panel: dragging the divider LEFT widens it.
  await page.mouse.move(sep.x + sep.width / 2, sep.y + sep.height / 2);
  await page.mouse.down();
  await page.mouse.move(sep.x + sep.width / 2 - 90, sep.y + sep.height / 2, { steps: 6 });
  await page.mouse.up();

  const after = await panel.boundingBox();
  if (!after) throw new Error("missing box");
  expect(after.width).toBeGreaterThan(before.width + 60);
});

test("a percentage panel keeps its share when the container resizes", async ({ mount }) => {
  const c = await mount(
    <div data-testid="wrap" style={{ inlineSize: 800, blockSize: 300 }}>
      <SplitPane defaultOpen side="right" defaultSize="30%" minSize={100}>
        <SplitPane.Main>
          <div>main</div>
        </SplitPane.Main>
        <SplitPane.Panel data-testid="panel">
          <div>panel</div>
        </SplitPane.Panel>
      </SplitPane>
    </div>,
  );
  const panel = c.getByTestId("panel");
  await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? 0)).toBe(240);
  await c.evaluate((el) => {
    (el as HTMLElement).style.inlineSize = "500px";
  });
  await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? 0)).toBe(150);
});

test("a px panel is clamped to a container that shrinks below it, and comes back", async ({
  mount,
}) => {
  const c = await mount(
    <div data-testid="wrap" style={{ inlineSize: 700, blockSize: 300 }}>
      <SplitPane defaultOpen side="right" defaultSize={320} minSize={100} minMainSize={96}>
        <SplitPane.Main>
          <div>main</div>
        </SplitPane.Main>
        <SplitPane.Panel data-testid="panel">
          <div>panel</div>
        </SplitPane.Panel>
      </SplitPane>
    </div>,
  );
  const panel = c.getByTestId("panel");
  await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? 0)).toBe(320);
  await c.evaluate((el) => {
    (el as HTMLElement).style.inlineSize = "300px";
  });
  // 300 minus the 96px main minimum.
  await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? 0)).toBe(204);
  await c.evaluate((el) => {
    (el as HTMLElement).style.inlineSize = "700px";
  });
  await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? 0)).toBe(320);
});

test("a controlled size follows the pointer during a drag and reports px and fraction", async ({
  mount,
  page,
}) => {
  const reports: Array<[number, number]> = [];
  const c = await mount(
    <div style={{ inlineSize: 800, blockSize: 300 }}>
      <SplitPane
        defaultOpen
        side="right"
        size={200}
        minSize={100}
        onSizeChange={(px, fraction) => {
          reports.push([Math.round(px), Math.round(fraction * 100) / 100]);
        }}
      >
        <SplitPane.Main>
          <div>main</div>
        </SplitPane.Main>
        <SplitPane.Panel data-testid="panel">
          <div>panel</div>
        </SplitPane.Panel>
      </SplitPane>
    </div>,
  );
  const panel = c.getByTestId("panel");
  await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? 0)).toBe(200);
  const sep = await c.getByRole("separator").boundingBox();
  if (!sep) throw new Error("no separator");
  await page.mouse.move(sep.x + sep.width / 2, sep.y + sep.height / 2);
  await page.mouse.down();
  await page.mouse.move(sep.x + sep.width / 2 - 100, sep.y + sep.height / 2, { steps: 5 });
  // Mid-drag the panel follows the pointer even though the size is controlled.
  await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? 0)).toBe(300);
  await page.mouse.up();
  // Released: back to the controlled 200 until the owner applies the report.
  await expect.poll(async () => Math.round((await panel.boundingBox())?.width ?? 0)).toBe(200);
  expect(reports).toEqual([[300, 0.38]]);
});
