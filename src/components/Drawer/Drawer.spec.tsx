import { expect, test } from "@playwright/experimental-ct-react";
import { Button } from "../Button";
import { Drawer } from "./Drawer";

test("opens from the trigger and closes via Close", async ({ mount, page }) => {
  await mount(
    <Drawer.Root side="right">
      <Drawer.Trigger render={<Button>Open</Button>} />
      <Drawer.Portal>
        <Drawer.Popup>
          <Drawer.Viewport>
            <Drawer.Content>
              <Drawer.Title>Panel</Drawer.Title>
              <Drawer.Close render={<Button>Close</Button>} />
            </Drawer.Content>
          </Drawer.Viewport>
        </Drawer.Popup>
      </Drawer.Portal>
    </Drawer.Root>,
  );

  // Closed: the portal content isn't mounted.
  await expect(page.getByRole("heading", { name: "Panel" })).toHaveCount(0);

  await page.getByRole("button", { name: "Open" }).click();
  await expect(page.getByRole("heading", { name: "Panel" })).toBeVisible();

  await page.getByRole("button", { name: "Close" }).click();
  await expect(page.getByRole("heading", { name: "Panel" })).toHaveCount(0);
});

test("the SwipeArea handle stays mounted while the drawer is closed", async ({ mount, page }) => {
  await mount(
    <Drawer.Root side="right">
      <Drawer.Trigger render={<Button>Open</Button>} />
      <Drawer.SwipeArea data-testid="handle" />
      <Drawer.Portal>
        <Drawer.Popup>
          <Drawer.Content>
            <Drawer.Title>Panel</Drawer.Title>
          </Drawer.Content>
        </Drawer.Popup>
      </Drawer.Portal>
    </Drawer.Root>,
  );
  // Drawer closed, but the grab handle remains.
  await expect(page.getByTestId("handle")).toBeVisible();
});
