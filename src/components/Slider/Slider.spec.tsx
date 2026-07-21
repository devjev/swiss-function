import { expect, test } from "@playwright/experimental-ct-react";
import { SliderHarness } from "./Slider.harness";

test("renders a slider with the initial value", async ({ mount }) => {
  const c = await mount(<SliderHarness initialValue={40} />);
  const slider = c.getByRole("slider");
  await expect(slider).toHaveAttribute("aria-valuenow", "40");
  await expect(c.getByTestId("value")).toHaveText("40");
});

test("arrow keys step the value and fire onValueChange", async ({ mount }) => {
  const c = await mount(<SliderHarness initialValue={40} />);
  const slider = c.getByRole("slider");
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "41");
  await expect(c.getByTestId("value")).toHaveText("41");
  await slider.press("ArrowLeft");
  await expect(c.getByTestId("value")).toHaveText("40");
});

test("Home and End jump to min and max", async ({ mount }) => {
  const c = await mount(<SliderHarness initialValue={40} min={0} max={100} />);
  const slider = c.getByRole("slider");
  await slider.focus();
  await slider.press("End");
  await expect(slider).toHaveAttribute("aria-valuenow", "100");
  await slider.press("Home");
  await expect(slider).toHaveAttribute("aria-valuenow", "0");
});

test("steps snap to the configured step", async ({ mount }) => {
  const c = await mount(<SliderHarness initialValue={0} min={0} max={10} step={2} />);
  const slider = c.getByRole("slider");
  await slider.focus();
  await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "2");
});

test("disabled slider is not interactive", async ({ mount }) => {
  const c = await mount(<SliderHarness initialValue={40} disabled />);
  await expect(c.getByRole("slider")).toBeDisabled();
});

test("range renders two thumbs and reports an array value", async ({ mount }) => {
  const c = await mount(<SliderHarness initialValue={[25, 70]} />);
  const sliders = c.getByRole("slider");
  await expect(sliders).toHaveCount(2);
  await expect(sliders.nth(0)).toHaveAttribute("aria-valuenow", "25");
  await expect(sliders.nth(1)).toHaveAttribute("aria-valuenow", "70");
  await expect(c.getByTestId("value")).toHaveText("[25,70]");
});
