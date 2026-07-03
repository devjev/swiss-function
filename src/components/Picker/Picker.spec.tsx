import { expect, test } from "@playwright/experimental-ct-react";
import { Picker } from "./Picker";

test("elevation raises the field; omitted stays flat", async ({ mount }) => {
  const raised = await mount(<Picker items={["Apple", "Banana"]} elevation={2} />);
  const field = raised.locator('[data-elevation="2"]');
  await expect(field).toBeVisible();
  const shadow = await field.evaluate((el) => getComputedStyle(el).boxShadow);
  expect(shadow).not.toBe("none");
  await raised.unmount();

  // No elevation prop → no elevation attribute, so the field keeps its flat default.
  const flat = await mount(<Picker items={["Apple", "Banana"]} />);
  await expect(flat.locator("[data-elevation]")).toHaveCount(0);
});
