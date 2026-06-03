import type { Story } from "@ladle/react";
import { Input, type InputProps } from "./Input";

export const Playground: Story<InputProps> = (args) => <Input {...args} />;
Playground.args = { placeholder: "Type here…", inputSize: "md", disabled: false };
Playground.argTypes = {
  inputSize: { options: ["sm", "md", "lg"], control: { type: "radio" } },
  disabled: { control: { type: "boolean" } },
};

export const AllSizes: Story = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", maxWidth: 280 }}>
    <Input inputSize="sm" placeholder="Small" />
    <Input inputSize="md" placeholder="Medium" />
    <Input inputSize="lg" placeholder="Large" />
  </div>
);
