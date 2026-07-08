import type { Story } from "@ladle/react";
import { Box } from "../Box";
import { Button } from "../Button";
import { Chip } from "../Chip";
import { ThemeBuilder } from "./ThemeBuilder";

export const Default: Story = () => (
  <div style={{ maxWidth: "56rem" }}>
    <ThemeBuilder />
  </div>
);

/** Narrow container: the controls / preview / export stack into one column
 *  (container-query driven, no viewport breakpoints). */
export const Narrow: Story = () => (
  <div style={{ maxWidth: "24rem" }}>
    <ThemeBuilder />
  </div>
);

/** Bring your own preview content — anything that reads `--sf-*` tokens
 *  re-themes live. */
export const CustomPreview: Story = () => (
  <div style={{ maxWidth: "56rem" }}>
    <ThemeBuilder defaultTheme="dark">
      <Box elevation={2} padding={1} style={{ display: "grid", gap: "var(--sf-unit)" }}>
        <h3 style={{ margin: 0, color: "var(--sf-color-fg)" }}>Release 1.16.0</h3>
        <p style={{ margin: 0, color: "var(--sf-color-fg)" }}>
          A live surface painted entirely from tokens — edit the palette on the left.
        </p>
        <div style={{ display: "flex", gap: "calc(var(--sf-unit) / 2)", flexWrap: "wrap" }}>
          <Chip tone="primary">shipped</Chip>
          <Chip tone="success" dot>
            passing
          </Chip>
          <Button size="sm">Deploy</Button>
        </div>
      </Box>
    </ThemeBuilder>
  </div>
);
