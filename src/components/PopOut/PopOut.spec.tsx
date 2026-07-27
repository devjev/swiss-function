import { expect, test } from "@playwright/experimental-ct-react";
import { PopOutHarness, PopOutStrictHarness } from "./PopOut.harness";
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

test("mirrors the opener's root theme/palette attributes and class, live", async ({
  mount,
  page,
}) => {
  const c = await mount(<PopOutHarness />);
  // Apps carry the palette on more than data-theme (data-colors, a class, ...).
  await page.evaluate(() => {
    const r = document.documentElement;
    r.setAttribute("data-theme", "dark");
    r.setAttribute("data-colors", "titanium");
    r.classList.add("brand-x");
  });
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    c.getByRole("button", { name: "toggle" }).click(),
  ]);
  await expect(popup.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(popup.locator("html")).toHaveAttribute("data-colors", "titanium");
  await expect(popup.locator("html")).toHaveClass(/brand-x/);
  // A runtime scheme switch in the opener propagates.
  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "light");
    document.documentElement.setAttribute("data-colors", "copper");
  });
  await expect(popup.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(popup.locator("html")).toHaveAttribute("data-colors", "copper");
  // A removed attribute is dropped in the popup too.
  await page.evaluate(() => document.documentElement.removeAttribute("data-colors"));
  await expect(popup.locator("html")).not.toHaveAttribute("data-colors", /.*/);
  await page.evaluate(() => {
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.classList.remove("brand-x");
  });
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

// --- Chromeless Picture-in-Picture (issue #84 follow-up) --------------------

test("pip mode opens a chromeless picture-in-picture window and restores on close", async ({
  mount,
  page,
}) => {
  // Document PiP is Chromium-only; skip where the runner lacks it.
  const supported = await page.evaluate(() => "documentPictureInPicture" in window);
  test.skip(!supported, "Document Picture-in-Picture unsupported in this browser");

  const c = await mount(<PopOutHarness pip />);
  await c.getByRole("button", { name: "toggle" }).click();
  // The content is portaled into the PiP window (no address bar, no popup
  // event — it is not a normal window.open popup).
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { documentPictureInPicture: { window: Window | null } })
            .documentPictureInPicture.window?.document.body.textContent ?? "",
      ),
    )
    .toContain("popped content");
  await expect(c.getByText("popped content")).toHaveCount(0);

  // Closing the PiP window returns the content to the page.
  await page.evaluate(() =>
    (
      window as unknown as { documentPictureInPicture: { window: Window | null } }
    ).documentPictureInPicture.window?.close(),
  );
  await expect(c.getByText("popped content")).toBeVisible();
  await expect(c.getByTestId("last")).toHaveText("false:closed");
});

// --- React StrictMode (dev double-invoke of effects) ------------------------

test("survives StrictMode's mount→cleanup→mount without closing (window.open)", async ({
  mount,
  page,
}) => {
  const c = await mount(<PopOutStrictHarness />);
  const [popup] = await Promise.all([
    page.waitForEvent("popup"),
    c.getByRole("button", { name: "toggle" }).click(),
  ]);
  await expect(popup.getByText("popped content")).toBeVisible();
  // The window stays open (it must not blink open then close), and the opener
  // did not revert `open` to false.
  await page.waitForTimeout(200);
  await expect.poll(() => popup.isClosed()).toBe(false);
  await expect(c.getByText("popped content")).toHaveCount(0);
  await popup.close();
});

test("survives StrictMode without closing (chromeless picture-in-picture)", async ({
  mount,
  page,
}) => {
  const supported = await page.evaluate(() => "documentPictureInPicture" in window);
  test.skip(!supported, "Document Picture-in-Picture unsupported in this browser");

  const c = await mount(<PopOutStrictHarness pip />);
  await c.getByRole("button", { name: "toggle" }).click();
  // The PiP window stays open across the StrictMode double-invoke (it used to
  // open, get canceled, and the second requestWindow reject → revert to closed).
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { documentPictureInPicture: { window: Window | null } })
            .documentPictureInPicture.window?.document.body.textContent ?? "",
      ),
    )
    .toContain("popped content");
  await page.waitForTimeout(200);
  const stillOpen = await page.evaluate(
    () =>
      !!(window as unknown as { documentPictureInPicture: { window: Window | null } })
        .documentPictureInPicture.window,
  );
  expect(stillOpen).toBe(true);
  await page.evaluate(() =>
    (
      window as unknown as { documentPictureInPicture: { window: Window | null } }
    ).documentPictureInPicture.window?.close(),
  );
});
