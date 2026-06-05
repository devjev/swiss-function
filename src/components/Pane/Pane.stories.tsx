import type { Story } from "@ladle/react";
import { Box } from "../Box";
import { Pane } from "./Pane";

const longContent = Array.from({ length: 40 }, (_, i) => i + 1);

export const Basic: Story = () => (
  // Outer fixed-size container — in a real app this would be the viewport
  // or a flex/grid cell that sizes the pane.
  <div
    style={{
      blockSize: "70vh",
      width: "min(40rem, 100%)",
      border: "1px solid var(--sf-color-border-subtle)",
    }}
  >
    <Pane>
      <Pane.Header>
        <Box
          elevation={0}
          style={{
            padding: "calc(var(--sf-unit) / 2)",
            borderBlockEnd: "1px solid var(--sf-color-border-subtle)",
            fontWeight: "var(--sf-font-weight-semibold)",
          }}
        >
          Header (auto-sized)
        </Box>
      </Pane.Header>
      <Pane.Body>
        <Box style={{ padding: "calc(var(--sf-unit) / 2)" }}>
          {longContent.map((n) => (
            <p key={n} style={{ margin: 0 }}>
              Body row {n} — this region scrolls when its content exceeds the parent height.
            </p>
          ))}
        </Box>
      </Pane.Body>
    </Pane>
  </div>
);

export const NoHeader: Story = () => (
  <div
    style={{
      blockSize: "60vh",
      width: "min(40rem, 100%)",
      border: "1px solid var(--sf-color-border-subtle)",
    }}
  >
    <Pane>
      <Pane.Body>
        <Box style={{ padding: "calc(var(--sf-unit) / 2)" }}>
          {longContent.map((n) => (
            <p key={n} style={{ margin: 0 }}>
              Row {n}. Without a Header, the Body takes the whole pane (auto row collapses to 0).
            </p>
          ))}
        </Box>
      </Pane.Body>
    </Pane>
  </div>
);

/**
 * Panes nest. The outer Body's `min-block-size: 0` lets the inner Pane
 * fill it and own its own scroll, without pushing scrolling up to the
 * outer container.
 */
export const Nested: Story = () => (
  <div
    style={{
      blockSize: "70vh",
      width: "min(48rem, 100%)",
      border: "1px solid var(--sf-color-border-subtle)",
    }}
  >
    <Pane>
      <Pane.Header>
        <Box
          style={{
            padding: "calc(var(--sf-unit) / 2)",
            borderBlockEnd: "1px solid var(--sf-color-border-subtle)",
            fontWeight: "var(--sf-font-weight-semibold)",
          }}
        >
          Outer header
        </Box>
      </Pane.Header>
      <Pane.Body>
        <Pane>
          <Pane.Header>
            <Box
              style={{
                padding: "calc(var(--sf-unit) / 2)",
                background: "var(--sf-color-bg-subtle)",
                borderBlockEnd: "1px solid var(--sf-color-border-subtle)",
                fontWeight: "var(--sf-font-weight-medium)",
              }}
            >
              Inner header
            </Box>
          </Pane.Header>
          <Pane.Body>
            <Box style={{ padding: "calc(var(--sf-unit) / 2)" }}>
              {longContent.map((n) => (
                <p key={n} style={{ margin: 0 }}>
                  Inner body row {n} — owns its own scroll.
                </p>
              ))}
            </Box>
          </Pane.Body>
        </Pane>
      </Pane.Body>
    </Pane>
  </div>
);
