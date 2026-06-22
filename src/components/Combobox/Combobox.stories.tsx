import type { Story } from "@ladle/react";
import { useState } from "react";
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

// Multi-select with an inline (tag-input) chip layout: the chips and the input
// share one bordered group.
export const MultiSelect: Story = () => {
  const [value, setValue] = useState<string[]>(["Apple", "Cherry"]);
  return (
    <Combobox.Root multiple items={fruits} value={value} onValueChange={setValue}>
      <Combobox.InputGroup>
        <Combobox.Chips>
          {value.map((fruit) => (
            <Combobox.Chip key={fruit}>
              {fruit}
              <Combobox.ChipRemove aria-label={`Remove ${fruit}`}>×</Combobox.ChipRemove>
            </Combobox.Chip>
          ))}
        </Combobox.Chips>
        <Combobox.Input placeholder={value.length ? "" : "Search fruit…"} />
        <Combobox.Clear aria-label="Clear all">Clear</Combobox.Clear>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner sideOffset={4}>
          <Combobox.Popup>
            <Combobox.Empty>
              <div className="empty">No results</div>
            </Combobox.Empty>
            <Combobox.List>
              {(fruit: string) => (
                <Combobox.Item key={fruit} value={fruit}>
                  <Combobox.ItemIndicator>✓</Combobox.ItemIndicator>
                  {fruit}
                </Combobox.Item>
              )}
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
};
