import type { Story } from "@ladle/react";
import { Button } from "../Button";
import { NonIdealState, type NonIdealStateVariant } from "./NonIdealState";

export const Empty: Story = () => (
  <NonIdealState
    variant="empty"
    title="No items yet"
    description="Nothing here so far. Create your first item to get started."
    action={<Button>New item</Button>}
  />
);

export const NoResults: Story = () => (
  <NonIdealState
    variant="no-results"
    title="No results"
    description="No rows match the current filters. Try widening or clearing them."
    action={<Button variant="secondary">Clear filters</Button>}
  />
);

export const ErrorState: Story = () => (
  <NonIdealState
    variant="error"
    title="Couldn't load data"
    description="The request failed. Check your connection and try again."
    action={<Button variant="secondary">Retry</Button>}
  />
);

export const Loading: Story = () => (
  <NonIdealState variant="loading" title="Loading…" description="Fetching the latest data." />
);

// All four side by side to check they read as a family.
export const Gallery: Story = () => {
  const items: { variant: NonIdealStateVariant; title: string }[] = [
    { variant: "empty", title: "Empty" },
    { variant: "no-results", title: "No results" },
    { variant: "error", title: "Error" },
    { variant: "loading", title: "Loading…" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "var(--sf-unit)" }}>
      {items.map((it) => (
        <div key={it.variant} style={{ border: "1px solid var(--sf-color-border-subtle)" }}>
          <NonIdealState variant={it.variant} title={it.title} description="Lorem ipsum dolor." />
        </div>
      ))}
    </div>
  );
};

export const Playground: Story<{
  variant: NonIdealStateVariant;
  title: string;
  description: string;
}> = ({ variant, title, description }) => (
  <NonIdealState
    variant={variant}
    title={title}
    description={description}
    action={<Button>Action</Button>}
  />
);
Playground.args = {
  variant: "empty",
  title: "No items yet",
  description: "Create your first item to get started.",
};
Playground.argTypes = {
  variant: {
    options: ["empty", "no-results", "error", "loading"],
    control: { type: "radio" },
  },
};
