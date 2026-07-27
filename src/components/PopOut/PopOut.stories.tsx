import type { Story } from "@ladle/react";
import { useState } from "react";
import { Box } from "../Box";
import { Button } from "../Button";
import { Field } from "../Field";
import { Picker } from "../Picker";
import { PopOut } from "./PopOut";

const Sample = () => (
  <div style={{ padding: "calc(var(--sf-unit) * 2)" }}>
    <h2 style={{ margin: 0, font: "var(--sf-font-size-lg)/1.4 var(--sf-font-sans)" }}>
      Popped content
    </h2>
    <p style={{ maxWidth: "var(--sf-measure)" }}>
      This subtree renders in place while closed and inside the separate browser window while
      popped. Close the popup (or press Escape in it) to bring it back.
    </p>
  </div>
);

// Toggle from a click handler: popup blockers require the user gesture.
export const Default: Story = () => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: "grid", gap: "var(--sf-unit)", justifyItems: "start" }}>
      <Button onClick={() => setOpen(!open)}>{open ? "Bring back" : "Pop out"}</Button>
      <Box elevation={1} style={{ minWidth: "40ch" }}>
        <PopOut
          open={open}
          onOpenChange={(next) => setOpen(next)}
          title="PopOut demo"
          rect={{ width: 520, height: 360 }}
        >
          <Sample />
        </PopOut>
      </Box>
    </div>
  );
};

// `pip` prefers a chromeless Picture-in-Picture window (no address bar) where
// the browser supports it (Chromium: Chrome/Edge/Brave, secure context), and
// falls back to a normal window.open popup otherwise.
export const Chromeless: Story = () => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: "grid", gap: "var(--sf-unit)", justifyItems: "start" }}>
      <Button onClick={() => setOpen(!open)}>{open ? "Bring back" : "Pop out (chromeless)"}</Button>
      <Box elevation={1} style={{ minWidth: "40ch" }}>
        <PopOut
          open={open}
          onOpenChange={(next) => setOpen(next)}
          title="Chromeless demo"
          pip
          rect={{ width: 520, height: 360 }}
        >
          <Sample />
        </PopOut>
      </Box>
    </div>
  );
};

// Uncontrolled, with a close-reason readout.
export const CloseReasons: Story = () => {
  const [log, setLog] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: "grid", gap: "var(--sf-unit)", justifyItems: "start" }}>
      <Button onClick={() => setOpen(!open)}>{open ? "Close popup" : "Pop out"}</Button>
      <PopOut
        open={open}
        onOpenChange={(next, reason) => {
          setOpen(next);
          setLog((l) => [...l, `${next ? "open" : "closed"}${reason ? ` (${reason})` : ""}`]);
        }}
        title="Close reasons"
        rect={{ width: 400, height: 240 }}
      >
        <Sample />
      </PopOut>
      <pre style={{ font: "var(--sf-font-size-sm)/1.5 var(--sf-font-mono)" }}>
        {log.join("\n") || "no transitions yet"}
      </pre>
    </div>
  );
};

// A floater (Picker) opened inside the popped window renders in THAT window,
// not the opener: PopOut publishes its body as the portal container and every
// library overlay reads it (issue #84 M3).
export const FloaterInside: Story = () => {
  const [open, setOpen] = useState(false);
  const [fruit, setFruit] = useState<string | undefined>(undefined);
  return (
    <div style={{ display: "grid", gap: "var(--sf-unit)", justifyItems: "start" }}>
      <Button onClick={() => setOpen(!open)}>{open ? "Bring back" : "Pop out"}</Button>
      <PopOut
        open={open}
        onOpenChange={setOpen}
        title="Floater inside"
        rect={{ width: 480, height: 360 }}
      >
        <div
          style={{ display: "grid", gap: "var(--sf-unit)", padding: "calc(var(--sf-unit) * 2)" }}
        >
          <p style={{ margin: 0 }}>Open the picker — its dropdown stays inside this window.</p>
          <Field>
            <Field.Label>Fruit</Field.Label>
            <Picker
              items={["Apple", "Banana", "Cherry", "Date", "Elderberry"]}
              value={fruit}
              onChange={setFruit}
              placeholder="Pick one"
            />
          </Field>
        </div>
      </PopOut>
    </div>
  );
};
