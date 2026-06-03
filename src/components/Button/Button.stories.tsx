import type { Story } from "@ladle/react";
import { Button, type ButtonProps } from "./Button";

export const Playground: Story<ButtonProps> = (args) => <Button {...args}>Click me</Button>;
Playground.args = { variant: "primary", size: "md", disabled: false };
Playground.argTypes = {
  variant: {
    options: ["primary", "secondary", "ghost", "danger"],
    control: { type: "select" },
  },
  size: {
    options: ["sm", "md", "lg"],
    control: { type: "radio" },
  },
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

export const Disabled: Story = () => (
  <div style={{ display: "flex", gap: "0.5rem" }}>
    <Button disabled>Primary disabled</Button>
    <Button variant="secondary" disabled>
      Secondary disabled
    </Button>
  </div>
);
