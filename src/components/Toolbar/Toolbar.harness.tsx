import { useState } from "react";
import { Button } from "../Button";
import { Switch } from "../Switch";
import { Toolbar } from "./Toolbar";

interface HarnessProps {
  /** Outer width in px — drives the container-width collapse. */
  width?: number;
}

// px threshold so the test doesn't depend on --sf-unit being loaded.
export function ToolbarHarness({ width = 1000 }: HarnessProps) {
  const [on, setOn] = useState(false);
  return (
    <div style={{ width }}>
      <Toolbar.Root collapseAt="600px" menuLabel="Menu">
        <Toolbar.Start>App</Toolbar.Start>
        <Toolbar.Item>
          <Button variant="primary" size="sm">
            Save
          </Button>
        </Toolbar.Item>
        <Toolbar.Item label="Wrap">
          <Switch checked={on} onCheckedChange={setOn} />
        </Toolbar.Item>
      </Toolbar.Root>
      <div data-testid="on">{String(on)}</div>
    </div>
  );
}
