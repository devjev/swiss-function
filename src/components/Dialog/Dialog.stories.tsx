import type { Story } from "@ladle/react";
import { Button } from "../Button";
import { Dialog } from "./Dialog";

export const Default: Story = () => (
  <Dialog.Root>
    <Dialog.Trigger render={<Button>Open dialog</Button>} />
    <Dialog.Portal>
      <Dialog.Backdrop />
      <Dialog.Popup>
        <Dialog.Title>Confirm action</Dialog.Title>
        <Dialog.Description>This action cannot be undone.</Dialog.Description>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Dialog.Close render={<Button variant="secondary">Cancel</Button>} />
          <Dialog.Close render={<Button variant="danger">Delete</Button>} />
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
);
