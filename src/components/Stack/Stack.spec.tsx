import { expect, test } from "@playwright/experimental-ct-react";
import { Stack } from "./Stack";

test("Stack.Fill absorbs the remaining vertical space", async ({ mount }) => {
  const c = await mount(
    <div style={{ height: 300 }}>
      <Stack fill>
        <div style={{ height: 40 }}>header</div>
        <Stack.Fill data-testid="fill">
          <div>body</div>
        </Stack.Fill>
      </Stack>
    </div>,
  );
  const fill = c.getByTestId("fill");
  const h = await fill.evaluate((el) => Math.round(el.getBoundingClientRect().height));
  // Container 300 minus the 40px header: the fill grew rather than hugging its
  // ~20px of content.
  expect(h).toBeGreaterThan(230);
});

test("a lone child fills the Stack.Fill region", async ({ mount }) => {
  const c = await mount(
    <div style={{ height: 300 }}>
      <Stack fill>
        <div style={{ height: 40 }}>header</div>
        <Stack.Fill>
          <div data-testid="child">only child</div>
        </Stack.Fill>
      </Stack>
    </div>,
  );
  const h = await c
    .getByTestId("child")
    .evaluate((el) => Math.round(el.getBoundingClientRect().height));
  expect(h).toBeGreaterThan(230);
});

test("horizontal Stack.Fill absorbs the remaining width", async ({ mount }) => {
  const c = await mount(
    <div style={{ width: 300, height: 80 }}>
      <Stack direction="horizontal" fill>
        <div style={{ width: 80 }}>side</div>
        <Stack.Fill data-testid="main">
          <div>main</div>
        </Stack.Fill>
      </Stack>
    </div>,
  );
  const w = await c
    .getByTestId("main")
    .evaluate((el) => Math.round(el.getBoundingClientRect().width));
  expect(w).toBeGreaterThan(180);
});
