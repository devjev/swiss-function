import type { Story } from "@ladle/react";
import { Combobox } from "./Combobox";

const fruits = ["Apple", "Banana", "Cherry", "Date", "Elderberry", "Fig", "Grape"];

export const Default: Story = () => (
  <Combobox.Root items={fruits}>
    <Combobox.Input placeholder="Search fruit…" />
    <Combobox.Portal>
      <Combobox.Positioner sideOffset={4}>
        <Combobox.Popup>
          <Combobox.Empty>
            <div className="empty">No results</div>
          </Combobox.Empty>
          <Combobox.List>
            {(fruit: string) => (
              <Combobox.Item key={fruit} value={fruit}>
                {fruit}
              </Combobox.Item>
            )}
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
);
