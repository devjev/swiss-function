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

// A window-style dialog with chrome: drag it by the header (Dialog.Handle),
// resize it from any edge or corner grip, maximize it with the chrome button,
// and close it with the ✕. Note the very subtle backdrop dim.
export const Window: Story = () => (
  <Dialog.Root>
    <Dialog.Trigger render={<Button>Open window</Button>} />
    <Dialog.Portal>
      <Dialog.Backdrop />
      <Dialog.Popup draggable resizable defaultWidth={520} defaultHeight={320}>
        <Dialog.Handle>
          <Dialog.Title>Movable, resizable window</Dialog.Title>
          <Dialog.Actions>
            <Dialog.Maximize />
            <Dialog.CloseButton />
          </Dialog.Actions>
        </Dialog.Handle>
        <Dialog.Description>
          Drag the header to move me; drag any edge or corner to resize. Use the chrome buttons to
          maximize or close. The page behind stays clearly visible — the scrim is deliberately
          faint.
        </Dialog.Description>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Dialog.Close render={<Button variant="secondary">Close</Button>} />
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
);
