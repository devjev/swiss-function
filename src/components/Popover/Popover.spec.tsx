import { expect, test } from "@playwright/experimental-ct-react";
import { PopoverZIndexHarness } from "./Popover.harness";

// Regression for issue #5: Base UI positions the popup with an inline transform,
// which creates a stacking context. The tier therefore has to live on the
// positioner — otherwise the popup's own z-index is inert at the page root and a
// positive-z-index sibling (e.g. a DataTable sticky header) paints over it.
test("popup renders above a positive-z-index sibling", async ({ mount, page }) => {
  await mount(<PopoverZIndexHarness />);
  const popup = page.getByTestId("popup-content");
  await expect(popup).toBeVisible();
  // At the popup's centre, the topmost element must be the popup, not the blocker.
  const popupOnTop = await popup.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const top = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)[0];
    return top != null && (el === top || el.contains(top));
  });
  expect(popupOnTop).toBe(true);
});
