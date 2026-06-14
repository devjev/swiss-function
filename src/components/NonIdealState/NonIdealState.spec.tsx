import { expect, test } from "@playwright/experimental-ct-react";
import { NonIdealState } from "./NonIdealState";

test("renders title, description, and action", async ({ mount }) => {
  const c = await mount(
    <NonIdealState
      variant="empty"
      title="No items"
      description="Add one."
      action={<button type="button">New</button>}
    />,
  );
  await expect(c.getByText("No items")).toBeVisible();
  await expect(c.getByText("Add one.")).toBeVisible();
  await expect(c.getByRole("button", { name: "New" })).toBeVisible();
});

test("continuously fills with dithered shade blocks, hidden from a11y", async ({ mount }) => {
  const c = await mount(<NonIdealState variant="empty" title="x" width={24} height={10} />);
  const fill = c.locator("pre");
  await expect(fill).toHaveAttribute("aria-hidden", "true");
  // The fill is generated after the block is measured.
  await expect.poll(async () => /[░▒▓█]/.test((await fill.textContent()) ?? "")).toBe(true);
});

test("error variant is an assertive alert", async ({ mount }) => {
  const c = await mount(<NonIdealState variant="error" title="Failed" />);
  await expect(c).toHaveAttribute("role", "alert");
});

test("loading variant is a busy status", async ({ mount }) => {
  const c = await mount(<NonIdealState variant="loading" title="Loading" />);
  await expect(c).toHaveAttribute("role", "status");
  await expect(c).toHaveAttribute("aria-busy", "true");
});

test("empty variant has no live-region role", async ({ mount }) => {
  const c = await mount(<NonIdealState variant="empty" title="Nothing" />);
  expect(await c.getAttribute("role")).toBeNull();
});
