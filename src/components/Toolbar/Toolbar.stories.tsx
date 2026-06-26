import type { Story } from "@ladle/react";
import { useState } from "react";
import { Button } from "../Button";
import { Input } from "../Input";
import { Switch } from "../Switch";
import { ToggleGroup } from "../ToggleGroup";
import { Toolbar } from "./Toolbar";

function EditorBar() {
  const [wrap, setWrap] = useState(true);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<string[]>(["code"]);
  return (
    <Toolbar.Root collapseAt={48}>
      <Toolbar.Start>Editor</Toolbar.Start>
      <Toolbar.Item>
        <Button variant="ghost" size="sm">
          Open
        </Button>
      </Toolbar.Item>
      <Toolbar.Item>
        <Button variant="primary" size="sm">
          Save
        </Button>
      </Toolbar.Item>
      <Toolbar.Separator />
      <Toolbar.Item label="View">
        <ToggleGroup size="sm" value={view} onValueChange={(v) => setView(v as string[])}>
          <ToggleGroup.Item value="code">Code</ToggleGroup.Item>
          <ToggleGroup.Item value="preview">Preview</ToggleGroup.Item>
        </ToggleGroup>
      </Toolbar.Item>
      <Toolbar.Item label="Wrap lines">
        <Switch checked={wrap} onCheckedChange={setWrap} />
      </Toolbar.Item>
      <Toolbar.Item label="Find">
        <Input
          inputSize="sm"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </Toolbar.Item>
      <Toolbar.Spacer />
      <Toolbar.Item>
        <Button variant="danger" size="sm">
          Delete
        </Button>
      </Toolbar.Item>
    </Toolbar.Root>
  );
}

/**
 * A bar of mixed controls — ghost/primary/danger buttons, a segmented toggle, a
 * switch, and a search input. Drag the browser narrower than ~48 units (≈1152px)
 * to watch everything fold into the ☰ panel, each control labelled.
 */
export const RichBar: Story = () => <EditorBar />;

/** Forced into the collapsed panel by a narrow wrapper. Click the ☰. */
export const Collapsed: Story = () => (
  <div style={{ inlineSize: 360, border: "1px solid var(--sf-color-border-subtle)" }}>
    <EditorBar />
  </div>
);
