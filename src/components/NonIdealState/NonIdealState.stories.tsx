import type { Story } from "@ladle/react";
import { Button } from "../Button";
import { NonIdealState, type NonIdealStateVariant } from "./NonIdealState";

// Demo at half pace — calmer than the component's default speed of 1.
const STORY_SPEED = 0.5;

export const Empty: Story = () => (
  <NonIdealState
    variant="empty"
    speed={STORY_SPEED}
    title="No items yet"
    description="Nothing here so far. Create your first item to get started."
    action={<Button>New item</Button>}
  />
);

export const NoResults: Story = () => (
  <NonIdealState
    variant="no-results"
    speed={STORY_SPEED}
    title="No results"
    description="No rows match the current filters. Try widening or clearing them."
    action={<Button variant="secondary">Clear filters</Button>}
  />
);

export const ErrorState: Story = () => (
  <NonIdealState
    variant="error"
    speed={STORY_SPEED}
    title="Couldn't load data"
    description="The request failed. Check your connection and try again."
    action={<Button variant="secondary">Retry</Button>}
  />
);

export const Loading: Story = () => (
  <NonIdealState
    variant="loading"
    speed={STORY_SPEED}
    title="Loading…"
    description="Fetching the latest data."
  />
);

// A small, sized block — the dither fills whatever dimensions you give it.
export const Sized: Story = () => (
  <NonIdealState
    variant="empty"
    speed={STORY_SPEED}
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
          speed={STORY_SPEED}
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
    <NonIdealState
      height={9}
      speed={STORY_SPEED}
      opacity={0.4}
      title="opacity 0.4"
      description="Very faint."
    />
    <NonIdealState
      height={9}
      speed={STORY_SPEED}
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
    speed={STORY_SPEED}
    title="333 × 199"
    description="Fill covers all four edges."
  />
);

// All 24 animated effects. The gallery is split into sub-stories of 6 so each
// rendered story stays well under the browser's ~16 simultaneous-WebGL-context
// limit (each block owns its own canvas/context).
const ALL_EFFECTS = [
  "ripple",
  "noise",
  "scan",
  "plasma",
  "rain",
  "wave",
  "spiral",
  "radar",
  "tunnel",
  "fire",
  "bars",
  "metaballs",
  "rotozoom",
  "twister",
  "copper",
  "voronoi",
  "grid",
  "kaleidoscope",
  "starfield",
  "swirl",
  "helix",
  "checker",
  "droplets",
  "lissajous",
] as const;

function EffectGrid({ effects }: { effects: readonly (typeof ALL_EFFECTS)[number][] }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--sf-unit)" }}>
      {effects.map((e) => (
        <NonIdealState key={e} effect={e} speed={STORY_SPEED} height={9} title={e} />
      ))}
    </div>
  );
}

export const Effects1: Story = () => <EffectGrid effects={ALL_EFFECTS.slice(0, 6)} />;
export const Effects2: Story = () => <EffectGrid effects={ALL_EFFECTS.slice(6, 12)} />;
export const Effects3: Story = () => <EffectGrid effects={ALL_EFFECTS.slice(12, 18)} />;
export const Effects4: Story = () => <EffectGrid effects={ALL_EFFECTS.slice(18, 24)} />;

export const Playground: Story<{
  variant: NonIdealStateVariant;
  effect: "default" | (typeof ALL_EFFECTS)[number];
  speed: number;
  density: number;
  cellSize: number;
  opacity: number;
  title: string;
  description: string;
}> = ({ variant, effect, speed, density, cellSize, opacity, title, description }) => (
  <NonIdealState
    variant={variant}
    effect={effect === "default" ? undefined : effect}
    speed={speed}
    density={density}
    cellSize={cellSize}
    opacity={opacity}
    title={title}
    description={description}
    action={<Button>Action</Button>}
  />
);
Playground.args = {
  variant: "empty",
  effect: "default",
  speed: STORY_SPEED,
  density: 0.6,
  cellSize: 5,
  opacity: 1,
  title: "No items yet",
  description: "Create your first item to get started.",
};
Playground.argTypes = {
  variant: { options: ["empty", "no-results", "error", "loading"], control: { type: "radio" } },
  effect: { options: ["default", ...ALL_EFFECTS], control: { type: "select" } },
  speed: { control: { type: "range", min: 0, max: 5, step: 0.25 } },
  density: { control: { type: "range", min: 0.1, max: 1.5, step: 0.05 } },
  cellSize: { control: { type: "range", min: 3, max: 16, step: 1 } },
  opacity: { control: { type: "range", min: 0.1, max: 1, step: 0.05 } },
};
