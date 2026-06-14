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

// A small, sized block — the dither fills whatever dimensions you give it.
export const Sized: Story = () => (
  <NonIdealState
    variant="empty"
    width={28}
    height={10}
    title="No items"
    description="This block is sized to 28 × 10 units."
  />
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
        <NonIdealState
          key={it.variant}
          variant={it.variant}
          height={10}
          title={it.title}
          description="Lorem ipsum dolor."
        />
      ))}
    </div>
  );
};

// Subtlety + custom base color (any token). Lower opacity = fainter texture.
export const SubtleColor: Story = () => (
  <div style={{ display: "grid", gap: "var(--sf-unit)" }}>
    <NonIdealState height={9} opacity={0.4} title="opacity 0.4" description="Very faint." />
    <NonIdealState
      height={9}
      color="var(--sf-color-primary)"
      opacity={0.5}
      title="primary token"
      description="Base color from a token."
    />
  </div>
);

// Awkward dimensions — the fill must still reach every edge (coverage).
export const OddSize: Story = () => (
  <NonIdealState
    width="333px"
    height="199px"
    title="333 × 199"
    description="Fill covers all four edges."
  />
);

// Effects gallery — the same block under each fill effect.
export const Effects: Story = () => (
  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--sf-unit)" }}>
    <NonIdealState effect="vignette" height={10} title="vignette" />
    <NonIdealState effect="ripple" height={10} title="ripple" />
    <NonIdealState effect="noise" height={10} title="noise" />
  </div>
);

export const Playground: Story<{
  variant: NonIdealStateVariant;
  effect: "default" | "vignette" | "ripple" | "noise";
  speed: number;
  wavelength: number;
  title: string;
  description: string;
}> = ({ variant, effect, speed, wavelength, title, description }) => (
  <NonIdealState
    variant={variant}
    effect={effect === "default" ? undefined : effect}
    effectOptions={{ speed, wavelength }}
    title={title}
    description={description}
    action={<Button>Action</Button>}
  />
);
Playground.args = {
  variant: "empty",
  effect: "default",
  speed: 3,
  wavelength: 11,
  title: "No items yet",
  description: "Create your first item to get started.",
};
Playground.argTypes = {
  variant: { options: ["empty", "no-results", "error", "loading"], control: { type: "radio" } },
  effect: { options: ["default", "vignette", "ripple", "noise"], control: { type: "radio" } },
  speed: { control: { type: "range", min: 0, max: 12, step: 0.5 } },
  wavelength: { control: { type: "range", min: 3, max: 30, step: 1 } },
};
