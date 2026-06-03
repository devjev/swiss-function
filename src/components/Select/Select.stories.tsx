import type { Story } from "@ladle/react";
import { Select } from "./Select";

export const Default: Story = () => (
  <Select.Root defaultValue="apple">
    <Select.Trigger>
      <Select.Value />
    </Select.Trigger>
    <Select.Portal>
      <Select.Positioner sideOffset={4}>
        <Select.Popup>
          <Select.Item value="apple">
            <Select.ItemText>Apple</Select.ItemText>
          </Select.Item>
          <Select.Item value="banana">
            <Select.ItemText>Banana</Select.ItemText>
          </Select.Item>
          <Select.Item value="cherry">
            <Select.ItemText>Cherry</Select.ItemText>
          </Select.Item>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
);
