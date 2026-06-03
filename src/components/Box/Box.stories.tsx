import type { Story } from "@ladle/react";
import { Box, type BoxElevation } from "./Box";

const LEVELS: BoxElevation[] = [0, 1, 2, 3, 4, 5];

export const Elevations: Story = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: "calc(var(--sf-unit) * 2)",
      padding: "var(--sf-unit)",
      background: "var(--sf-color-bg)",
    }}
  >
    {LEVELS.map((e) => (
      <Box key={e} elevation={e}>
        <strong>elevation = {e}</strong>
        <p style={{ margin: 0, color: "var(--sf-color-fg-subtle)" }}>
          {e === 0 ? "flat" : `level ${e}`}
        </p>
      </Box>
    ))}
  </div>
);

export const WithTexture: Story = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: "calc(var(--sf-unit) * 2)",
      padding: "var(--sf-unit)",
    }}
  >
    {[0, 2, 4].map((e) => (
      <Box key={e} elevation={e as BoxElevation} texture>
        <strong>elevation {e}</strong>
        <p style={{ margin: 0, color: "var(--sf-color-fg-subtle)" }}>texture on</p>
      </Box>
    ))}
  </div>
);

export const PolymorphicSection: Story = () => (
  <Box render={<section />} elevation={2}>
    Rendered as a <code>&lt;section&gt;</code> via the <code>render</code> prop.
  </Box>
);

export const CustomPadding: Story = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: "calc(var(--sf-unit))",
    }}
  >
    <Box padding={0} elevation={1}>
      <span style={{ background: "var(--sf-color-bg-subtle)" }}>padding 0</span>
    </Box>
    <Box padding={0.5} elevation={1}>
      padding 0.5
    </Box>
    <Box padding={2} elevation={1}>
      padding 2
    </Box>
  </div>
);
