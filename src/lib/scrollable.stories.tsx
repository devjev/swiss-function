import type { Story } from "@ladle/react";
import { cx } from "./cx";
import styles from "./scrollable.module.css";

// The shared scroll-surface styling, in isolation. In real use this class is
// `composes`d into a component's scroll container (Pane.Body, DataTable.viewport,
// Prose body); here we apply it directly so the scrollbar itself is reviewable.

const frame: React.CSSProperties = {
  border: "1px solid var(--sf-color-border-subtle)",
  background: "var(--sf-color-bg)",
  padding: "calc(var(--sf-unit) / 2)",
};

const rows = Array.from({ length: 40 }, (_, i) => i + 1);

export const Vertical: Story = () => (
  <div
    className={cx(styles.scrollable)}
    style={{ ...frame, blockSize: "60vh", inlineSize: "min(32rem, 100%)", overflowY: "auto" }}
  >
    {rows.map((n) => (
      <p key={n} style={{ margin: 0 }}>
        Row {n} — the thumb is invisible at rest and appears in the primary color when you hover
        this surface (instantly on Win/Linux; macOS gives a genuine fade via its native overlay).
      </p>
    ))}
  </div>
);

export const Horizontal: Story = () => (
  <div
    className={cx(styles.scrollable)}
    style={{ ...frame, inlineSize: "min(32rem, 100%)", overflowX: "auto" }}
  >
    <p style={{ margin: 0, whiteSpace: "nowrap" }}>
      {rows.map((n) => `Cell ${n} · wide content that overflows horizontally — `).join("")}
    </p>
  </div>
);

export const Both: Story = () => (
  <div
    className={cx(styles.scrollable)}
    style={{ ...frame, blockSize: "60vh", inlineSize: "min(32rem, 100%)", overflow: "auto" }}
  >
    {rows.map((n) => (
      <p key={n} style={{ margin: 0, whiteSpace: "nowrap" }}>
        Row {n} · {rows.map((m) => `col ${m} `).join("")}
      </p>
    ))}
  </div>
);

/**
 * Side-by-side comparison: a styled `.scrollable` surface next to a default,
 * unstyled one, so the difference is obvious. Toggle Ladle's theme to confirm
 * dark mode adapts without any per-theme override.
 */
export const ComparedToDefault: Story = () => (
  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--sf-unit)" }}>
    <div>
      <p
        style={{
          marginBlock: "0 calc(var(--sf-unit) / 4)",
          fontWeight: "var(--sf-font-weight-medium)",
        }}
      >
        .scrollable
      </p>
      <div
        className={cx(styles.scrollable)}
        style={{ ...frame, blockSize: "50vh", overflowY: "auto" }}
      >
        {rows.map((n) => (
          <p key={n} style={{ margin: 0 }}>
            Styled row {n}.
          </p>
        ))}
      </div>
    </div>
    <div>
      <p
        style={{
          marginBlock: "0 calc(var(--sf-unit) / 4)",
          fontWeight: "var(--sf-font-weight-medium)",
        }}
      >
        native default
      </p>
      <div style={{ ...frame, blockSize: "50vh", overflowY: "auto" }}>
        {rows.map((n) => (
          <p key={n} style={{ margin: 0 }}>
            Default row {n}.
          </p>
        ))}
      </div>
    </div>
  </div>
);
