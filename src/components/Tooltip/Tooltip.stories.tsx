import type { Story } from "@ladle/react";
import { Button } from "../Button";
import { Tooltip } from "./Tooltip";

export const Default: Story = () => (
  <Tooltip.Provider>
    <Tooltip.Root>
      <Tooltip.Trigger render={<Button variant="secondary">Hover me</Button>} />
      <Tooltip.Portal>
        <Tooltip.Positioner sideOffset={6}>
          <Tooltip.Popup>This is a tooltip</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
);
