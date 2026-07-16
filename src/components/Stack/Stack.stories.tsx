import type { Story } from "@ladle/react";
import { useState } from "react";
import { Button } from "../Button";
import { Dialog } from "../Dialog";
import { Field } from "../Field";
import { Input } from "../Input";
import { TextEdit } from "../TextEdit";
import { Stack } from "./Stack";

const labelStyle: React.CSSProperties = {
  fontSize: "var(--sf-font-size-sm)",
  fontWeight: 500,
  color: "var(--sf-color-fg)",
  fontFamily: "var(--sf-font-sans)",
  marginBlockEnd: "calc(var(--sf-unit) / 4)",
};

/** A labelled field whose control fills the region: a `Stack.Fill` (so it grows)
 *  holding a natural-height label and a `TextEdit fill` that takes the rest. */
function ReasonField({ value, onChange }: { value?: string; onChange?: (v: string) => void }) {
  return (
    <Stack.Fill>
      <span style={{ ...labelStyle, flex: "none" }}>Reason</span>
      <TextEdit
        fill
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        placeholder="Grows to fill the space below and locks to the edge on resize."
      />
    </Stack.Fill>
  );
}

const box = (h: string, children: React.ReactNode) => (
  <div
    style={{
      height: h,
      border: "1px solid var(--sf-color-border)",
      borderRadius: "var(--sf-radius-default)",
      padding: "var(--sf-unit)",
      background: "var(--sf-color-bg)",
    }}
  >
    {children}
  </div>
);

/** A fixed-height region: the header and fields keep their natural height, and
 *  the `Stack.Fill` (a `<TextEdit fill />`) stretches to the bottom edge. */
export const Basic: Story = () => (
  <div style={{ width: "min(28rem, 100%)" }}>
    {box(
      "20rem",
      <Stack fill gap={0.75}>
        <strong style={{ color: "var(--sf-color-fg)", fontFamily: "var(--sf-font-sans)" }}>
          Adjustment
        </strong>
        <Field>
          <Field.Label>Amount</Field.Label>
          <Input placeholder="0.00" />
        </Field>
        <ReasonField />
      </Stack>,
    )}
  </div>
);

/** The motivating case (issue #74): a draggable, resizable `Dialog.Popup` whose
 *  body is a `Stack fill`. The Reason region is a `Stack.Fill` + `TextEdit fill`,
 *  so it stays locked to the lower edge (above the action row) as the window is
 *  resized. */
export const InAResizableDialog: Story = () => {
  const [reason, setReason] = useState("");
  return (
    <Dialog.Root>
      <Dialog.Trigger render={<Button>Add adjustment</Button>} />
      <Dialog.Portal>
        <Dialog.Backdrop />
        <Dialog.Popup draggable resizable defaultWidth={460} defaultHeight={380}>
          <Dialog.Handle>
            <Dialog.Title>Manual adjustment</Dialog.Title>
            <Dialog.Actions>
              <Dialog.Maximize />
              <Dialog.CloseButton />
            </Dialog.Actions>
          </Dialog.Handle>
          <Stack fill gap={0.75} style={{ marginBlockStart: "var(--sf-unit)" }}>
            <Field>
              <Field.Label>Account</Field.Label>
              <Input placeholder="e.g. 4000 — Revenue" />
            </Field>
            <ReasonField value={reason} onChange={setReason} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--sf-unit)" }}>
              <Dialog.Close render={<Button variant="secondary">Cancel</Button>} />
              <Dialog.Close render={<Button>Save</Button>} />
            </div>
          </Stack>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

/** Horizontal: a fixed sidebar plus a `Stack.Fill` main column that absorbs the
 *  remaining width. */
export const Horizontal: Story = () => (
  <div style={{ width: "min(36rem, 100%)" }}>
    {box(
      "12rem",
      <Stack direction="horizontal" fill gap={0.75}>
        <div style={{ width: "8rem", color: "var(--sf-color-fg)" }}>Sidebar (8rem)</div>
        <Stack.Fill>
          <div
            style={{
              background: "var(--sf-color-bg-subtle)",
              border: "1px solid var(--sf-color-border)",
              borderRadius: "var(--sf-radius-default)",
              display: "grid",
              placeItems: "center",
              color: "var(--sf-color-fg)",
            }}
          >
            Fills the rest
          </div>
        </Stack.Fill>
      </Stack>,
    )}
  </div>
);
