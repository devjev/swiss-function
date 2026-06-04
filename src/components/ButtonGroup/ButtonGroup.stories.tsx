import type { Story } from "@ladle/react";
import { Button } from "../Button";
import { ButtonGroup } from "./ButtonGroup";

const log = (_msg: string) => () => {};

export const Default: Story = () => (
  <ButtonGroup>
    <Button variant="primary" onClick={log("save")}>
      Save
    </Button>
    <Button variant="secondary" onClick={log("cancel")}>
      Cancel
    </Button>
  </ButtonGroup>
);

export const ThreeActions: Story = () => (
  <ButtonGroup>
    <Button variant="secondary" onClick={log("prev")}>
      ← Prev
    </Button>
    <Button variant="secondary" onClick={log("page")}>
      Page 1 of 12
    </Button>
    <Button variant="secondary" onClick={log("next")}>
      Next →
    </Button>
  </ButtonGroup>
);

export const MixedVariants: Story = () => (
  <ButtonGroup>
    <Button variant="secondary">Discard</Button>
    <Button variant="primary">Publish</Button>
    <Button variant="danger">Delete</Button>
  </ButtonGroup>
);

export const Sizes: Story = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: "calc(var(--sf-unit) / 2)" }}>
    <ButtonGroup size="sm">
      <Button variant="secondary">Small</Button>
      <Button variant="secondary">Group</Button>
      <Button variant="secondary">Items</Button>
    </ButtonGroup>
    <ButtonGroup size="md">
      <Button variant="secondary">Medium</Button>
      <Button variant="secondary">Group</Button>
      <Button variant="secondary">Items</Button>
    </ButtonGroup>
    <ButtonGroup size="lg">
      <Button variant="secondary">Large</Button>
      <Button variant="secondary">Group</Button>
      <Button variant="secondary">Items</Button>
    </ButtonGroup>
  </div>
);
