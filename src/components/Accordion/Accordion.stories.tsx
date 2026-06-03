import type { Story } from "@ladle/react";
import { Accordion } from "./Accordion";

export const Default: Story = () => (
  <div style={{ maxWidth: 480 }}>
    <Accordion.Root>
      <Accordion.Item>
        <Accordion.Header>
          <Accordion.Trigger>What is Swiss-Function?</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>
          A design system built on Base UI primitives with CSS Modules and design tokens.
        </Accordion.Panel>
      </Accordion.Item>
      <Accordion.Item>
        <Accordion.Header>
          <Accordion.Trigger>Is it themeable?</Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Panel>
          Yes — all tokens are CSS custom properties; override them at any scope.
        </Accordion.Panel>
      </Accordion.Item>
    </Accordion.Root>
  </div>
);
