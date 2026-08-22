import { expect, test } from "@playwright/experimental-ct-react";
import { LaunchButton } from "./LaunchButton";

test("starts closed: guard collapsed, well inert", async ({ mount }) => {
  const component = await mount(<LaunchButton onClick={() => {}}>Launch</LaunchButton>);
  const guard = component.getByRole("button", { name: "Guard for Launch" });
  await expect(guard).toHaveAttribute("aria-expanded", "false");
  await expect(component.locator("[inert]")).toHaveCount(1);
  expect(await component.getAttribute("data-open")).toBeNull();
});

test("open → fire: onClick once, fired flash, auto-close, second cycle fires again", async ({
  mount,
}) => {
  let fired = 0;
  const events: string[] = [];
  const component = await mount(
    <LaunchButton
      onClick={() => {
        fired += 1;
      }}
      onOpenChange={(open, reason) => {
        events.push(`${open}:${reason}`);
      }}
    >
      Launch
    </LaunchButton>,
  );
  const guard = component.getByRole("button", { name: "Guard for Launch" });

  await guard.click();
  await expect(guard).toHaveAttribute("aria-expanded", "true");
  await expect(component).toHaveAttribute("data-open", "true");

  const inner = component.getByRole("button", { name: "Launch", exact: true });
  await inner.click();
  await expect.poll(() => fired).toBe(1);
  await expect(component).toHaveAttribute("data-fired", "true");

  // Snaps shut on its own after the fired hold.
  await expect(guard).toHaveAttribute("aria-expanded", "false", { timeout: 2000 });
  expect(fired).toBe(1);
  expect(events).toEqual(["true:toggle", "false:fired"]);

  // A second cycle fires again.
  await guard.click();
  await component.getByRole("button", { name: "Launch", exact: true }).click();
  await expect.poll(() => fired).toBe(2);
});

test("Escape closes without firing and refocuses the guard", async ({ mount, page }) => {
  let fired = 0;
  const component = await mount(
    <LaunchButton
      onClick={() => {
        fired += 1;
      }}
    >
      Launch
    </LaunchButton>,
  );
  const guard = component.getByRole("button", { name: "Guard for Launch" });
  await guard.click();
  await expect(guard).toHaveAttribute("aria-expanded", "true");

  await page.keyboard.press("Escape");
  await expect(guard).toHaveAttribute("aria-expanded", "false");
  await expect(guard).toBeFocused();
  expect(fired).toBe(0);
});

test("focus leaving closes without firing", async ({ mount, page }) => {
  let fired = 0;
  const component = await mount(
    <LaunchButton
      onClick={() => {
        fired += 1;
      }}
    >
      Launch
    </LaunchButton>,
  );
  const guard = component.getByRole("button", { name: "Guard for Launch" });
  await guard.click();
  await expect(guard).toHaveAttribute("aria-expanded", "true");

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(guard).toHaveAttribute("aria-expanded", "false");
  expect(fired).toBe(0);
});

test("full keyboard path: Enter opens onto the control, Enter fires, guard refocused", async ({
  mount,
  page,
}) => {
  let fired = 0;
  const component = await mount(
    <LaunchButton
      onClick={() => {
        fired += 1;
      }}
    >
      Launch
    </LaunchButton>,
  );
  const guard = component.getByRole("button", { name: "Guard for Launch" });

  await guard.focus();
  await page.keyboard.press("Enter");
  await expect(guard).toHaveAttribute("aria-expanded", "true");
  const inner = component.getByRole("button", { name: "Launch", exact: true });
  await expect(inner).toBeFocused();

  await page.keyboard.press("Enter");
  await expect.poll(() => fired).toBe(1);
  await expect(guard).toBeFocused();
  await expect(guard).toHaveAttribute("aria-expanded", "false", { timeout: 2000 });
});

test("switch mode: arming keeps the guard open through blur", async ({ mount, page }) => {
  const changes: boolean[] = [];
  const component = await mount(
    <LaunchButton mode="switch" guardLabel="ARM" onCheckedChange={(c) => changes.push(c)}>
      Autopilot override
    </LaunchButton>,
  );
  const guard = component.getByRole("button", { name: "ARM guard" });
  await guard.click();
  await component.getByRole("switch").click();
  await expect(component).toHaveAttribute("data-armed", "true");
  await expect.poll(() => changes).toEqual([true]);

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  // Armed: the open lid is the status display — blur neither closes nor disarms.
  await expect(guard).toHaveAttribute("aria-expanded", "true");
  await expect(component).toHaveAttribute("data-armed", "true");
});

test("switch mode: Escape slams the guard — disarms and closes", async ({ mount, page }) => {
  const changes: boolean[] = [];
  const component = await mount(
    <LaunchButton mode="switch" guardLabel="ARM" onCheckedChange={(c) => changes.push(c)}>
      Autopilot override
    </LaunchButton>,
  );
  const guard = component.getByRole("button", { name: "ARM guard" });
  await guard.click();
  await component.getByRole("switch").click();
  await expect(component).toHaveAttribute("data-armed", "true");

  await page.keyboard.press("Escape");
  await expect(guard).toHaveAttribute("aria-expanded", "false");
  await expect(component).not.toHaveAttribute("data-armed", "true");
  await expect.poll(() => changes).toEqual([true, false]);
  await expect(guard).toBeFocused();
});

test("switch mode: clicking the raised lid slams the guard", async ({ mount, page }) => {
  const changes: boolean[] = [];
  const component = await mount(
    // The open lid projects above the component's top edge; margin keeps it
    // inside the viewport (the CT harness mounts flush at the top-left).
    <LaunchButton
      mode="switch"
      guardLabel="ARM"
      onCheckedChange={(c) => changes.push(c)}
      style={{ marginTop: 48 }}
    >
      Autopilot override
    </LaunchButton>,
  );
  const guard = component.getByRole("button", { name: "ARM guard" });
  await guard.click();
  await component.getByRole("switch").click();
  await expect(component).toHaveAttribute("data-armed", "true");

  // The open lid rests leaning back over the hinge: a slim strip projected
  // just above the component's top edge. Click the middle of its projection.
  const lid = component.locator('[class*="lid"]').first();
  const box = await lid.boundingBox();
  if (!box) throw new Error("no lid bounding box");
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await expect(guard).toHaveAttribute("aria-expanded", "false");
  await expect.poll(() => changes).toEqual([true, false]);
});

test("vertical lever: toggles through role=switch, slams like the pill", async ({
  mount,
  page,
}) => {
  const changes: boolean[] = [];
  const component = await mount(
    <LaunchButton
      mode="switch"
      orientation="vertical"
      guardLabel="ARM"
      onCheckedChange={(c) => changes.push(c)}
    >
      MASTER ARM
    </LaunchButton>,
  );
  const guard = component.getByRole("button", { name: "ARM guard" });
  await guard.click();
  const lever = component.getByRole("switch");
  await lever.click();
  await expect(lever).toHaveAttribute("aria-checked", "true");
  await expect(component).toHaveAttribute("data-armed", "true");
  await expect.poll(() => changes).toEqual([true]);

  await page.keyboard.press("Escape");
  await expect(guard).toHaveAttribute("aria-expanded", "false");
  await expect.poll(() => changes).toEqual([true, false]);
});

test("controlled open: prop wins, onOpenChange reports intent", async ({ mount }) => {
  const events: string[] = [];
  const component = await mount(
    <LaunchButton
      open={false}
      onOpenChange={(open, reason) => {
        events.push(`${open}:${reason}`);
      }}
      onClick={() => {}}
    >
      Launch
    </LaunchButton>,
  );
  const guard = component.getByRole("button", { name: "Guard for Launch" });

  await guard.click();
  await expect.poll(() => events).toEqual(["true:toggle"]);
  // Controlled and not updated by the consumer: stays closed.
  await expect(guard).toHaveAttribute("aria-expanded", "false");

  await component.update(
    <LaunchButton open onOpenChange={() => {}} onClick={() => {}}>
      Launch
    </LaunchButton>,
  );
  await expect(guard).toHaveAttribute("aria-expanded", "true");
});

test("disabled: nothing opens", async ({ mount }) => {
  const component = await mount(
    <LaunchButton disabled onClick={() => {}}>
      Launch
    </LaunchButton>,
  );
  const guard = component.getByRole("button", { name: "Guard for Launch" });
  await expect(guard).toBeDisabled();
  await guard.click({ force: true });
  await expect(guard).toHaveAttribute("aria-expanded", "false");
});
