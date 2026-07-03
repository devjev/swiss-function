import { expect, test } from "@playwright/experimental-ct-react";
import { ThemeEpochProbe } from "./useThemeEpoch.harness";

test("epoch increments when an ancestor's data-theme flips", async ({ mount, page }) => {
  const cmp = await mount(
    <div data-theme="light" data-host>
      <ThemeEpochProbe />
    </div>,
  );
  const epoch = cmp.getByTestId("epoch");
  await expect(epoch).toHaveText("0");

  // Flip the theme on the ancestor — the hook's MutationObserver should fire and,
  // seeing the resolved bg/fg move, bump the counter.
  await page.locator("[data-host]").evaluate((el) => el.setAttribute("data-theme", "dark"));
  await expect(epoch).toHaveText("1");

  // Flip back — another distinct change, another bump.
  await page.locator("[data-host]").evaluate((el) => el.setAttribute("data-theme", "light"));
  await expect(epoch).toHaveText("2");
});

test("a class mutation that doesn't change the tokens does not bump", async ({ mount, page }) => {
  const cmp = await mount(
    <div data-theme="light" data-host>
      <ThemeEpochProbe />
    </div>,
  );
  const epoch = cmp.getByTestId("epoch");
  await expect(epoch).toHaveText("0");

  // A className change up the chain that leaves --sf-color-bg/fg untouched must
  // not force a needless repaint (the cheap token-signature guard).
  await page.locator("[data-host]").evaluate((el) => el.classList.add("unrelated"));
  await page.waitForTimeout(50);
  await expect(epoch).toHaveText("0");
});

test("disabled: no observation, epoch stays 0", async ({ mount, page }) => {
  const cmp = await mount(
    <div data-theme="light" data-host>
      <ThemeEpochProbe enabled={false} />
    </div>,
  );
  const epoch = cmp.getByTestId("epoch");
  await expect(epoch).toHaveText("0");
  await page.locator("[data-host]").evaluate((el) => el.setAttribute("data-theme", "dark"));
  await page.waitForTimeout(50);
  await expect(epoch).toHaveText("0");
});
