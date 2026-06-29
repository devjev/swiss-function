import type { Story } from "@ladle/react";
import { SPINNERS, type SpinnerVariant } from "../../lib/effects";
import { Spinner } from "./Spinner";

const ALL = Object.keys(SPINNERS) as SpinnerVariant[];

export const Gallery: Story = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(8rem, 1fr))",
      gap: "var(--sf-unit)",
      maxWidth: "40rem",
    }}
  >
    {ALL.map((v) => (
      <div
        key={v}
        style={{ display: "flex", alignItems: "center", gap: "calc(var(--sf-unit) / 2)" }}
      >
        <Spinner variant={v} size="lg" />
        <code style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)" }}>
          {v}
        </code>
      </div>
    ))}
  </div>
);

export const InlineWithText: Story = () => (
  <p style={{ fontSize: "var(--sf-font-size-md)" }}>
    <Spinner variant="braille" /> Loading results… <Spinner variant="dots" />
  </p>
);

export const Speeds: Story = () => (
  <div style={{ display: "flex", gap: "var(--sf-unit)", alignItems: "center" }}>
    {[0.5, 1, 2, 4].map((s) => (
      <div
        key={s}
        style={{ display: "flex", alignItems: "center", gap: "calc(var(--sf-unit) / 3)" }}
      >
        <Spinner variant="bars" size="lg" speed={s} />
        <code style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)" }}>
          {s}×
        </code>
      </div>
    ))}
  </div>
);

export const Colors: Story = () => (
  <div style={{ display: "flex", gap: "var(--sf-unit)", alignItems: "center" }}>
    <Spinner variant="braille" size="lg" color="var(--sf-color-primary)" />
    <Spinner variant="pulse" size="lg" color="var(--sf-color-success)" />
    <Spinner variant="bars" size="lg" color="var(--sf-color-danger)" />
    <Spinner variant="dots" size="lg" color="var(--sf-color-muted)" />
    {/* No color → inherits currentColor from this orange container. */}
    <span style={{ color: "#c2410c" }}>
      <Spinner variant="star" size="lg" /> inherits
    </span>
  </div>
);
