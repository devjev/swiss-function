import { expect, test } from "@playwright/experimental-ct-react";
import { PopOutHarness } from "./PopOut.harness";
import { PopOutFloaterHarness } from "./PopOutFloater.harness";

test("renders children in place while closed", async ({ mount }) => {
  const c = await mount(<PopOutHarness />);
  await expect(c.getByText("popped content")).toBeVisible();
});

test("pops content into a separate window and restores when it closes", async ({ mount, page }) => {
  const c = await mount(<PopOutHarness />);
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    c.getByRole("button", { name: "toggle" }).click(),
  ]);
  await expect(popup.getByText("popped content")).toBeVisible();
  await expect(c.getByText("popped content")).toHaveCount(0);
  expect(await popup.title()).toBe("CT popout");
  // The opener's stylesheets are cloned into the popup head.
  expect(await popup.locator('head style, head link[rel="stylesheet"]').count()).toBeGreaterThan(0);
  await popup.close();
  await expect(c.getByText("popped content")).toBeVisible();
  await expect(c.getByTestId("last")).toHaveText("false:closed");
});

test("Escape inside the popup closes it and restores the content", async ({ mount, page }) => {
  const c = await mount(<PopOutHarness />);
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    c.getByRole("button", { name: "toggle" }).click(),
  ]);
  await expect(popup.getByText("popped content")).toBeVisible();
  // The keydown handler closes the window mid-press, so the keyup half of
  // press() can find the page gone; that is the behavior under test.
  await popup.keyboard.press("Escape").catch(() => {});
  await expect(c.getByText("popped content")).toBeVisible();
  await expect(c.getByTestId("last")).toHaveText("false:escape");
  await expect.poll(() => popup.isClosed()).toBe(true);
});

test("mirrors the opener's data-theme, live", async ({ mount, page }) => {
  const c = await mount(<PopOutHarness />);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    c.getByRole("button", { name: "toggle" }).click(),
  ]);
  await expect(popup.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await expect(popup.locator("html")).toHaveAttribute("data-theme", "light");
  await popup.close();
});

test("mirrors styles added to the opener after opening", async ({ mount, page }) => {
  const c = await mount(<PopOutHarness />);
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    c.getByRole("button", { name: "toggle" }).click(),
  ]);
  await expect(popup.getByText("popped content")).toBeVisible();
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.textContent = ".sf-ct-late-style { color: rgb(1, 2, 3); }";
    document.head.appendChild(style);
  });
  await expect
    .poll(async () =>
      popup.evaluate(() =>
        Array.from(document.head.querySelectorAll("style")).some((s) =>
          (s.textContent ?? "").includes("sf-ct-late-style"),
        ),
      ),
    )
    .toBe(true);
  await popup.close();
});

test("a blocked window.open reverts gracefully", async ({ mount, page }) => {
  const c = await mount(<PopOutHarness />);
  await page.evaluate(() => {
    window.open = () => null;
  });
  await c.getByRole("button", { name: "toggle" }).click();
  await expect(c.getByText("popped content")).toBeVisible();
  await expect(c.getByTestId("last")).toHaveText("false:blocked");
});

// --- Cross-document floaters (issue #84 M3) ---------------------------------

test("a Menu opened inside a popped window renders in that window", async ({ mount, page }) => {
  const c = await mount(<PopOutFloaterHarness />);
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    c.getByRole("button", { name: "toggle" }).click(),
  ]);
  await popup.getByRole("button", { name: "Open menu" }).click();
  // The dropdown items appear in the popup document, not the opener.
  await expect(popup.getByText("First item")).toBeVisible();
  await expect(c.getByText("First item")).toHaveCount(0);
  await popup.close();
});
