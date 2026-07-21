import type { Story } from "@ladle/react";
import { Tabs } from "./Tabs";

export const Default: Story = () => (
  <Tabs.Root defaultValue="overview">
    <Tabs.List>
      <Tabs.Tab value="overview">Overview</Tabs.Tab>
      <Tabs.Tab value="details">Details</Tabs.Tab>
      <Tabs.Tab value="history">History</Tabs.Tab>
      <Tabs.Indicator />
    </Tabs.List>
    <Tabs.Panel value="overview">Overview content</Tabs.Panel>
    <Tabs.Panel value="details">Details content</Tabs.Panel>
    <Tabs.Panel value="history">History content</Tabs.Panel>
  </Tabs.Root>
);

const sections = [
  "Overview",
  "Activity",
  "Settings",
  "Billing",
  "Members",
  "Integrations",
  "Audit log",
  "Danger zone",
];

// `overflow` folds the tabs that don't fit into a trailing ⋯ menu instead of
// overrunning the row. The container is narrow on purpose; widen it (the box is
// resizable) and tabs unfold. The selected tab always stays visible, so picking
// one from the ⋯ menu pulls it into the row.
export const Overflow: Story = () => (
  <div style={{ inlineSize: "24rem", resize: "horizontal", overflow: "hidden" }}>
    <Tabs.Root defaultValue="overview">
      <Tabs.List overflow>
        {sections.map((s) => (
          <Tabs.Tab key={s} value={s.toLowerCase()}>
            {s}
          </Tabs.Tab>
        ))}
        <Tabs.Indicator />
      </Tabs.List>
      {sections.map((s) => (
        <Tabs.Panel key={s} value={s.toLowerCase()}>
          {s} content
        </Tabs.Panel>
      ))}
    </Tabs.Root>
  </div>
);
