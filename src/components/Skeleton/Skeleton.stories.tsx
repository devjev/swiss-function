import type { Story } from "@ladle/react";
import { Grid } from "../Grid";
import { Skeleton, type SkeletonProps } from "./Skeleton";

export const Playground: Story<SkeletonProps> = (args) => (
  <div style={{ maxWidth: "calc(var(--sf-unit) * 20)" }}>
    <Skeleton {...args} />
  </div>
);
Playground.args = { shape: "rect" };
Playground.argTypes = {
  shape: { options: ["rect", "circle", "pill"], control: { type: "radio" } },
};

export const Rect: Story = () => (
  <div style={{ maxWidth: "calc(var(--sf-unit) * 20)" }}>
    <Skeleton />
  </div>
);

export const DitheredEffect: Story = () => (
  <div style={{ display: "grid", gap: "1rem", maxWidth: "calc(var(--sf-unit) * 20)" }}>
    <Skeleton effect="noise" height={4} />
    <Skeleton effect="plasma" height={4} />
    <Skeleton effect="ripple" height={4} />
  </div>
);

export const Sized: Story = () => (
  <Grid gap={0.5}>
    <Skeleton width={20} height={1} />
    <Skeleton width={15} height={1} />
    <Skeleton width={10} height={1} />
  </Grid>
);

export const Circle: Story = () => <Skeleton shape="circle" size={3} />;

export const Pill: Story = () => <Skeleton shape="pill" width={6} height={1.5} />;

export const TextBlock: Story = () => (
  <Grid gap={0.25} style={{ maxWidth: "calc(var(--sf-unit) * 20)" }}>
    <Skeleton width="100%" height={1} />
    <Skeleton width="100%" height={1} />
    <Skeleton width="100%" height={1} />
    <Skeleton width="60%" height={1} />
  </Grid>
);

export const Card: Story = () => (
  <Grid
    areas={["avatar headline", "avatar subhead"]}
    columns={["min-content", "1fr"]}
    rowGap={0.25}
    columnGap={0.75}
    style={{ maxWidth: "calc(var(--sf-unit) * 18)" }}
  >
    <Grid.Item area="avatar">
      <Skeleton shape="circle" size={3} />
    </Grid.Item>
    <Grid.Item area="headline">
      <Skeleton width={12} height={1} />
    </Grid.Item>
    <Grid.Item area="subhead">
      <Skeleton width={8} height={0.75} />
    </Grid.Item>
  </Grid>
);

export const Polymorphic: Story = () => (
  <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
    <Grid gap={0.5}>
      {[20, 18, 22, 16].map((w) => (
        <Skeleton key={w} width={w} height={1} render={<li />} />
      ))}
    </Grid>
  </ul>
);
