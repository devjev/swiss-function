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
