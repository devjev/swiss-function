import type { Story } from "@ladle/react";
import { Reflow } from "./Reflow";

const columns = (
  <>
    <Reflow.Column title="Overview" value="overview">
      <p style={{ margin: 0 }}>
        The wide layout shows every column side by side. Narrow the container and it collapses to
        the chosen mode.
      </p>
    </Reflow.Column>
    <Reflow.Column title="Details" value="details">
      <p style={{ margin: 0 }}>
        Each column carries a title that becomes the accordion trigger or the tab label when
        collapsed.
      </p>
    </Reflow.Column>
    <Reflow.Column title="Activity" value="activity">
      <p style={{ margin: 0 }}>Switch between columns instead of scrolling a cramped grid.</p>
    </Reflow.Column>
  </>
);

/** Drag the browser narrower than ~768px (32 units) to watch it collapse. */
export const Wide: Story = () => <Reflow.Root>{columns}</Reflow.Root>;

/** Forced into the collapsed accordion by a narrow wrapper. */
export const NarrowAccordion: Story = () => (
  <div style={{ inlineSize: 360, border: "1px solid var(--sf-color-border-subtle)" }}>
    <Reflow.Root collapseAt={32}>{columns}</Reflow.Root>
  </div>
);

/** Forced into the collapsed tab switcher by a narrow wrapper. */
export const NarrowTabs: Story = () => (
  <div style={{ inlineSize: 360 }}>
    <Reflow.Root collapseMode="tabs" collapseAt={32}>
      {columns}
    </Reflow.Root>
  </div>
);
