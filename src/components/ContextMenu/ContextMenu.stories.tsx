import type { Story } from "@ladle/react";
import { ContextMenu } from "./ContextMenu";

export const Default: Story = () => (
  <ContextMenu.Root>
    <ContextMenu.Trigger
      style={{
        display: "grid",
        placeItems: "center",
        height: "12rem",
        border: "1px solid var(--sf-color-border)",
        color: "var(--sf-color-fg)",
        userSelect: "none",
      }}
    >
      Right-click anywhere in this area
    </ContextMenu.Trigger>
    <ContextMenu.Portal>
      <ContextMenu.Positioner>
        <ContextMenu.Popup>
          <ContextMenu.Item>Cut</ContextMenu.Item>
          <ContextMenu.Item>Copy</ContextMenu.Item>
          <ContextMenu.Item>Paste</ContextMenu.Item>
          <ContextMenu.Separator />
          <ContextMenu.Item disabled>Rename</ContextMenu.Item>
          <ContextMenu.Item>Delete</ContextMenu.Item>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  </ContextMenu.Root>
);
