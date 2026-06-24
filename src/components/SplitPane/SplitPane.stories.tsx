import type { Story } from "@ladle/react";
import { useState } from "react";
import { Button } from "../Button";
import { SplitPane, type SplitSide } from "./SplitPane";

export default { title: "SplitPane" };

function Demo({ side, resizable = true }: { side: SplitSide; resizable?: boolean }) {
  const [open, setOpen] = useState(true);
  const [size, setSize] = useState<number | null>(null);
  return (
    <div style={{ blockSize: 420, border: "1px solid var(--sf-color-border-subtle)" }}>
      <SplitPane
        side={side}
        open={open}
        onOpenChange={setOpen}
        resizable={resizable}
        defaultSize={320}
        minSize={200}
        maxSize={560}
        onSizeChange={setSize}
      >
        <SplitPane.Main>
          <div
            style={{
              padding: "var(--sf-unit)",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <Button onClick={() => setOpen((o) => !o)}>{open ? "Close" : "Open"} panel</Button>
            <p style={{ margin: 0 }}>
              Main content — the panel pushes it aside.{" "}
              {resizable ? `Drag the divider to resize${size ? ` (now ${size}px)` : ""}.` : ""}
            </p>
          </div>
        </SplitPane.Main>
        <SplitPane.Panel>
          <div
            style={{
              padding: "var(--sf-unit)",
              background: "var(--sf-color-bg-subtle)",
              blockSize: "100%",
              boxSizing: "border-box",
            }}
          >
            <strong>Panel ({side})</strong>
            <p>Resizable side panel content.</p>
          </div>
        </SplitPane.Panel>
      </SplitPane>
    </div>
  );
}

/** A right-edge resizable panel that pushes the main content. Toggle it with the
 *  button; drag the divider to resize (or focus it and use the arrow keys). */
export const Right: Story = () => <Demo side="right" />;
export const Left: Story = () => <Demo side="left" />;
export const Bottom: Story = () => <Demo side="bottom" />;

/** `resizable={false}` → a fixed-size panel with no divider. */
export const FixedNonResizable: Story = () => <Demo side="right" resizable={false} />;
