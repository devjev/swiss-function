import type { Story } from "@ladle/react";
import { Button, type ButtonProps } from "./Button";

export const Playground: Story<ButtonProps> = (args) => <Button {...args}>Click me</Button>;
Playground.args = { variant: "primary", size: "md", tight: false, disabled: false };
Playground.argTypes = {
  variant: {
    options: ["primary", "secondary", "ghost", "danger"],
    control: { type: "select" },
  },
  size: {
    options: ["sm", "md", "lg"],
    control: { type: "radio" },
  },
  tight: { control: { type: "boolean" } },
  disabled: { control: { type: "boolean" } },
};

export const AllVariants: Story = () => (
  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
    <Button variant="primary">Primary</Button>
    <Button variant="secondary">Secondary</Button>
    <Button variant="ghost">Ghost</Button>
    <Button variant="danger">Danger</Button>
  </div>
);

export const AllSizes: Story = () => (
  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
    <Button size="sm">Small</Button>
    <Button size="md">Medium</Button>
    <Button size="lg">Large</Button>
  </div>
);

// Tight: uniform 3/16u padding + 0.25u icon/text gap. Good for icon-only or
// dense toolbar buttons. Composes with size (font) and variant (colour).
export const Tight: Story = () => (
  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
    <Button tight aria-label="Add">
      ＋
    </Button>
    <Button tight>
      <span aria-hidden="true">＋</span>
      Add
    </Button>
    <Button tight variant="secondary" size="sm">
      <span aria-hidden="true">↻</span>
      Refresh
    </Button>
    <Button tight variant="ghost" size="lg">
      Tight large
    </Button>
  </div>
);

export const Disabled: Story = () => (
  <div style={{ display: "flex", gap: "0.5rem" }}>
    <Button disabled>Primary disabled</Button>
    <Button variant="secondary" disabled>
      Secondary disabled
    </Button>
  </div>
);
