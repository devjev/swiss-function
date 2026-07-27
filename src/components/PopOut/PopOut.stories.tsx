import type { Story } from "@ladle/react";
import { useState } from "react";
import { Box } from "../Box";
import { Button } from "../Button";
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
