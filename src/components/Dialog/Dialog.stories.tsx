import type { Story } from "@ladle/react";
import { Button } from "../Button";
import { DatePicker } from "../DatePicker";
import { Field } from "../Field";
import { Picker } from "../Picker";
import { Dialog } from "./Dialog";

const fruit = ["Apple", "Banana", "Cherry", "Date", "Elderberry", "Fig", "Grape"];

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

// The pop-out chrome button moves the dialog's content into a separate browser
// window (over the dialog's on-screen spot); the dialog stays open as a small
// placeholder whose focus trap keeps trapping here, and closing it (or the
// popup, or Escape in the popup) brings everything back. The ✕ inside the
// popup window still closes the whole dialog.
export const PopOutWindow: Story = () => (
  <Dialog.Root>
    <Dialog.Trigger render={<Button>Open window</Button>} />
    <Dialog.Portal>
      <Dialog.Backdrop />
      <Dialog.Popup draggable resizable defaultWidth={520} defaultHeight={320} popOutTitle="Notes">
        <Dialog.Handle>
          <Dialog.Title>A dialog that pops out</Dialog.Title>
          <Dialog.Actions>
            <Dialog.PopOut />
            <Dialog.Maximize />
            <Dialog.CloseButton />
          </Dialog.Actions>
        </Dialog.Handle>
        <Dialog.Description>
          Hit the pop-out button (the arrow leaving a box) to continue in a separate browser window.
          The pressed button in the popup, its ✕, or Escape brings the content back.
        </Dialog.Description>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <Dialog.Close render={<Button variant="secondary">Close</Button>} />
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
);

// Floaters opened from inside a dialog paint above it (issue #82): open the
// Picker dropdown or the DatePicker calendar and it sits over the dialog, not
// behind it. No app-side z-index lift needed.
export const FloatersInside: Story = () => (
  <Dialog.Root defaultOpen>
    <Dialog.Trigger render={<Button>Open settings</Button>} />
    <Dialog.Portal>
      <Dialog.Backdrop />
      <Dialog.Popup>
        <Dialog.Title>Settings</Dialog.Title>
        <Dialog.Description>
          The dropdown and the calendar below open above this dialog.
        </Dialog.Description>
        <div style={{ display: "grid", gap: 16, marginTop: 12, minWidth: 280 }}>
          <Field>
            <Field.Label>Fruit</Field.Label>
            <Picker items={fruit} placeholder="Pick one" />
          </Field>
          <Field>
            <Field.Label>Date</Field.Label>
            <DatePicker aria-label="Date" />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
          <Dialog.Close render={<Button variant="secondary">Cancel</Button>} />
          <Dialog.Close render={<Button>Save</Button>} />
        </div>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
);
