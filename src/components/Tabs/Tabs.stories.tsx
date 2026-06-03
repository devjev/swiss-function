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
