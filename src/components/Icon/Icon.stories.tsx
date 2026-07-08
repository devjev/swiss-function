import type { Story } from "@ladle/react";
import { Button } from "../Button";
import { Icon } from "./Icon";
import * as Icons from "./icons";

const entries = Object.entries(Icons) as [string, typeof Icon][];

export const Gallery: Story = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(7rem, 1fr))",
      gap: "var(--sf-unit)",
      color: "var(--sf-color-fg)",
      fontFamily: "var(--sf-font-sans)",
    }}
  >
    {entries.map(([name, Glyph]) => (
      <div
        key={name}
        style={{
          display: "grid",
          justifyItems: "center",
          gap: "calc(var(--sf-unit) / 4)",
          padding: "calc(var(--sf-unit) / 2)",
          border: "1px solid var(--sf-color-border)",
          borderRadius: "var(--sf-radius-default)",
        }}
      >
        <Glyph size={1} label={name} />
        <span style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)" }}>
          {name}
        </span>
      </div>
    ))}
  </div>
);

export const Sizes: Story = () => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: "var(--sf-unit)",
      color: "var(--sf-color-fg)",
    }}
  >
    <Icons.Star label="1em (default)" />
    <Icons.Star size={0.75} label="0.75u" />
    <Icons.Star size={1} label="1u" />
    <Icons.Star size={1.5} label="1.5u" />
    <Icons.Star size="32px" label="32px" />
  </div>
);

export const InButtons: Story = () => (
  <div style={{ display: "flex", gap: "calc(var(--sf-unit) / 2)", flexWrap: "wrap" }}>
    <Button>
      <Icons.Download aria-hidden /> Download
    </Button>
    <Button variant="secondary">
      <Icons.Pencil aria-hidden /> Edit
    </Button>
    <Button variant="danger">
      <Icons.Trash aria-hidden /> Delete
    </Button>
    <Button variant="ghost" aria-label="Search">
      <Icons.Search aria-hidden />
    </Button>
  </div>
);

/** A custom icon — pass your own 16×16 path content to the `Icon` primitive. */
export const Custom: Story = () => (
  <Icon size={1.5} label="Lightning" color="var(--sf-color-primary)">
    <path d="M9 1 3 9h4l-1 6 6-8H8z" />
  </Icon>
);
