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
export const Top: Story = () => <Demo side="top" />;
export const Bottom: Story = () => <Demo side="bottom" />;

/** `resizable={false}` → a fixed-size panel with no divider. */
export const FixedNonResizable: Story = () => <Demo side="right" resizable={false} />;

/** A percentage panel keeps its share of the container: drag the width slider
 *  and the panel follows at 35%. A px panel would keep its px (and be clamped
 *  once the container cannot hold it). */
export const Ratio: Story = () => {
  const [width, setWidth] = useState(720);
  return (
    <div style={{ display: "grid", gap: "var(--sf-unit)" }}>
      <label style={{ display: "grid", gap: 4, maxWidth: 320 }}>
        Container width: {width}px
        <input
          type="range"
          min={360}
          max={900}
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
        />
      </label>
      <div
        style={{
          inlineSize: width,
          blockSize: 260,
          border: "1px solid var(--sf-color-border-subtle)",
        }}
      >
        <SplitPane defaultOpen side="right" defaultSize="35%" minSize={120}>
          <SplitPane.Main>
            <div style={{ padding: "var(--sf-unit)" }}>Main</div>
          </SplitPane.Main>
          <SplitPane.Panel>
            <div style={{ padding: "var(--sf-unit)" }}>Panel at 35%</div>
          </SplitPane.Panel>
        </SplitPane>
      </div>
    </div>
  );
};

/** A px panel in a container that shrinks below it: the panel is clamped to
 *  the container minus `minMainSize`, and returns to its px when the room is
 *  back. */
export const ShrinkingContainer: Story = () => {
  const [narrow, setNarrow] = useState(false);
  return (
    <div style={{ display: "grid", gap: "var(--sf-unit)", justifyItems: "start" }}>
      <Button variant="secondary" onClick={() => setNarrow((n) => !n)}>
        {narrow ? "Widen to 720px" : "Shrink to 360px"}
      </Button>
      <div
        style={{
          inlineSize: narrow ? 360 : 720,
          blockSize: 260,
          border: "1px solid var(--sf-color-border-subtle)",
        }}
      >
        <SplitPane defaultOpen side="right" defaultSize={320} minSize={120}>
          <SplitPane.Main>
            <div style={{ padding: "var(--sf-unit)" }}>Main keeps at least 96px</div>
          </SplitPane.Main>
          <SplitPane.Panel>
            <div style={{ padding: "var(--sf-unit)" }}>320px panel</div>
          </SplitPane.Panel>
        </SplitPane>
      </div>
    </div>
  );
};

/** A controlled size: the owner holds it (here as a percentage) and applies
 *  what `onSizeChange` reports, so it can persist or share the value. */
export const Controlled: Story = () => {
  const [size, setSize] = useState<string>("30%");
  return (
    <div style={{ display: "grid", gap: "var(--sf-unit)" }}>
      <div style={{ fontFamily: "var(--sf-font-mono)", fontSize: "var(--sf-font-size-sm)" }}>
        size: {size}
      </div>
      <div
        style={{
          inlineSize: 720,
          blockSize: 260,
          border: "1px solid var(--sf-color-border-subtle)",
        }}
      >
        <SplitPane
          defaultOpen
          side="right"
          size={size}
          minSize={120}
          onSizeChange={(_px, fraction) => setSize(`${Math.round(fraction * 100)}%`)}
        >
          <SplitPane.Main>
            <div style={{ padding: "var(--sf-unit)" }}>Main</div>
          </SplitPane.Main>
          <SplitPane.Panel>
            <div style={{ padding: "var(--sf-unit)" }}>Controlled panel</div>
          </SplitPane.Panel>
        </SplitPane>
      </div>
    </div>
  );
};
