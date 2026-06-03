import type { Story } from "@ladle/react";
import { Button } from "../Button";
import { Popover } from "./Popover";

export const Default: Story = () => (
  <Popover.Root>
    <Popover.Trigger render={<Button variant="secondary">Show info</Button>} />
    <Popover.Portal>
      <Popover.Positioner sideOffset={8}>
        <Popover.Popup>
          <Popover.Title>Hello</Popover.Title>
          <Popover.Description>I'm a popover.</Popover.Description>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
);
