import type { Story } from "@ladle/react";
import { Button } from "../Button";
import { Menu } from "./Menu";

export const Default: Story = () => (
  <Menu.Root>
    <Menu.Trigger render={<Button variant="secondary">Actions</Button>} />
    <Menu.Portal>
      <Menu.Positioner sideOffset={4}>
        <Menu.Popup>
          <Menu.Item>New file</Menu.Item>
          <Menu.Item>Rename</Menu.Item>
          <Menu.Separator />
          <Menu.Item disabled>Archive</Menu.Item>
          <Menu.Item>Delete</Menu.Item>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
);
