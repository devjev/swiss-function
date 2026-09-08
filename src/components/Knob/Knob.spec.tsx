import { expect, test } from "@playwright/experimental-ct-react";
import { KnobHarness } from "./Knob.harness";

/** The dial's centre and the pointer at `angle` degrees (0 up, clockwise). */
async function dialPoint(
  dial: { boundingBox(): Promise<{ x: number; y: number; width: number; height: number } | null> },
  angle: number,
  radius: number,
) {
  const box = await dial.boundingBox();
  if (!box) throw new Error("dial has no box");
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const rad = (angle * Math.PI) / 180;
  return { cx, cy, x: cx + radius * Math.sin(rad), y: cy - radius * Math.cos(rad) };
}

test("renders a slider with the initial value and a readout", async ({ mount }) => {
  const c = await mount(<KnobHarness initialValue={40} valueLabel="always" />);
  const slider = c.getByRole("slider");
  await expect(slider).toHaveAttribute("aria-valuenow", "40");
  await expect(slider).toHaveAttribute("min", "0");
  await expect(slider).toHaveAttribute("max", "100");
  await expect(c.locator("output")).toHaveText("40");
});

test("arrow keys, PageUp and Home/End drive the value from the keyboard", async ({ mount }) => {
  const c = await mount(<KnobHarness initialValue={40} />);
  const slider = c.getByRole("slider");
  await slider.focus();
  await slider.press("ArrowUp");
  await expect(c.getByTestId("value")).toHaveText("41");
  await slider.press("ArrowLeft");
  await expect(c.getByTestId("value")).toHaveText("40");
  await slider.press("PageUp");
  await expect(c.getByTestId("value")).toHaveText("50");
  await slider.press("End");
  await expect(c.getByTestId("value")).toHaveText("100");
  await slider.press("Home");
  await expect(c.getByTestId("value")).toHaveText("0");
});

test("the pointer turns the knob: the value follows the pointer's angle", async ({
  mount,
  page,
}) => {
  const c = await mount(<KnobHarness initialValue={40} />);
  const dial = c.locator('[class*="dial"]');
  // 3 o'clock is 90° into a 270° sweep that starts at -135°: (90 + 135) / 270 = 5/6.
  const right = await dialPoint(dial, 90, 30);
  await page.mouse.move(right.x, right.y);
  await page.mouse.down();
  await expect(c.getByTestId("value")).toHaveText("83");
  // Straight up is the middle of the sweep.
  const up = await dialPoint(dial, 0, 30);
  await page.mouse.move(up.x, up.y);
  await expect(c.getByTestId("value")).toHaveText("50");
  await page.mouse.up();
  await expect(c.getByTestId("commits")).toHaveText("1");
});

test("a drag past a stop holds at that stop instead of jumping across", async ({ mount, page }) => {
  const c = await mount(<KnobHarness initialValue={40} />);
  const dial = c.locator('[class*="dial"]');
  const nearLeftStop = await dialPoint(dial, -160, 30);
  await page.mouse.move(nearLeftStop.x, nearLeftStop.y);
  await page.mouse.down();
  await expect(c.getByTestId("value")).toHaveText("0");
  const nearRightStop = await dialPoint(dial, 160, 30);
  await page.mouse.move(nearRightStop.x, nearRightStop.y);
  await expect(c.getByTestId("value")).toHaveText("100");
  await page.mouse.up();
});

test("vertical drag raises the value as the pointer moves up", async ({ mount, page }) => {
  const c = await mount(<KnobHarness initialValue={40} drag="vertical" />);
  const dial = c.locator('[class*="dial"]');
  const { cx, cy } = await dialPoint(dial, 0, 0);
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  // 160px of travel covers the range: 40px up is a quarter of it.
  await page.mouse.move(cx, cy - 40);
  await expect(c.getByTestId("value")).toHaveText("65");
  await page.mouse.move(cx, cy + 40);
  await expect(c.getByTestId("value")).toHaveText("15");
  await page.mouse.up();
  await expect(c.getByTestId("commits")).toHaveText("1");
});

test("the value snaps to the step", async ({ mount, page }) => {
  const c = await mount(<KnobHarness initialValue={0} min={0} max={10} step={5} />);
  const dial = c.locator('[class*="dial"]');
  const p = await dialPoint(dial, 20, 30);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.up();
  await expect(c.getByTestId("value")).toHaveText("5");
});

test("the wheel turns the knob only when opted in", async ({ mount, page }) => {
  const c = await mount(<KnobHarness initialValue={40} wheel />);
  const dial = c.locator('[class*="dial"]');
  const { cx, cy } = await dialPoint(dial, 0, 0);
  await page.mouse.move(cx, cy);
  await page.mouse.wheel(0, -100);
  await expect(c.getByTestId("value")).toHaveText("41");
  await page.mouse.wheel(0, 100);
  await page.mouse.wheel(0, 100);
  await expect(c.getByTestId("value")).toHaveText("39");
});

test("a disabled knob ignores the pointer and disables its input", async ({ mount, page }) => {
  const c = await mount(<KnobHarness initialValue={40} disabled />);
  await expect(c.getByRole("slider")).toBeDisabled();
  const dial = c.locator('[class*="dial"]');
  const right = await dialPoint(dial, 90, 30);
  await page.mouse.move(right.x, right.y);
  await page.mouse.down();
  await page.mouse.up();
  await expect(c.getByTestId("value")).toHaveText("40");
});

test("marks render ticks and labels around the dial", async ({ mount }) => {
  const c = await mount(
    <KnobHarness
      initialValue={5}
      min={0}
      max={10}
      marks={[
        { value: 0, label: "0" },
        { value: 5, label: "5" },
        { value: 10, label: "10" },
      ]}
    />,
  );
  await expect(c.locator("svg line")).toHaveCount(3);
  await expect(c.locator('[class*="tickLabel"]')).toHaveText(["0", "5", "10"]);
});

test("a Field label names the knob", async ({ mount }) => {
  const c = await mount(<KnobHarness initialValue={40} label="Volume" />);
  await expect(c.getByRole("slider", { name: "Volume" })).toHaveAttribute("aria-valuenow", "40");
});

test("the accessible thumb sits centred on the cap", async ({ mount }) => {
  const c = await mount(<KnobHarness initialValue={40} />);
  const cap = await c.locator('[class*="cap"]').first().boundingBox();
  const thumb = await c.getByRole("slider").boundingBox();
  if (!cap || !thumb) throw new Error("missing boxes");
  expect(Math.abs(cap.x + cap.width / 2 - (thumb.x + thumb.width / 2))).toBeLessThanOrEqual(1);
  expect(Math.abs(cap.y + cap.height / 2 - (thumb.y + thumb.height / 2))).toBeLessThanOrEqual(1);
});
