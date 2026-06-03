import type { Story } from "@ladle/react";
import type { CSSProperties, ReactNode } from "react";
import { Grid } from "./Grid";

const Card = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <div
    style={{
      padding: "var(--sf-unit)",
      border: "1px solid var(--sf-color-border)",
      borderRadius: "var(--sf-radius-md)",
      background: "var(--sf-color-bg-subtle)",
      minHeight: "calc(var(--sf-unit) * 2)",
      display: "grid",
      placeItems: "center",
      fontSize: "var(--sf-font-size-sm)",
      color: "var(--sf-color-fg)",
      ...style,
    }}
  >
    {children}
  </div>
);

export const AutoFlow: Story = () => (
  <Grid columns={3} gap={1}>
    <Card>1</Card>
    <Card>2</Card>
    <Card>3</Card>
    <Card>4</Card>
    <Card>5</Card>
    <Card>6</Card>
  </Grid>
);

export const Stack: Story = () => (
  <Grid gap={1}>
    <Card>First</Card>
    <Card>Second</Card>
    <Card>Third</Card>
  </Grid>
);

export const Asymmetric: Story = () => (
  <Grid columns={["min-content", "1fr"]} gap={1}>
    <Card style={{ minWidth: "calc(var(--sf-unit) * 6)" }}>Sidebar</Card>
    <Card>Main</Card>
  </Grid>
);

export const NamedAreas: Story = () => (
  <Grid
    areas={["header header", "nav    main", "footer footer"]}
    columns={["min-content", "1fr"]}
    rows={["min-content", "1fr", "min-content"]}
    gap={0.5}
    style={{ minHeight: "calc(var(--sf-unit) * 12)" }}
  >
    <Grid.Item area="header">
      <Card>Header</Card>
    </Grid.Item>
    <Grid.Item area="nav">
      <Card style={{ minWidth: "calc(var(--sf-unit) * 5)" }}>Nav</Card>
    </Grid.Item>
    <Grid.Item area="main">
      <Card>Main content</Card>
    </Grid.Item>
    <Grid.Item area="footer">
      <Card>Footer</Card>
    </Grid.Item>
  </Grid>
);

export const Cluster: Story = () => (
  <Grid columns="repeat(auto-fit, minmax(0, max-content))" gap={0.5}>
    {["alpha", "beta", "gamma", "delta", "epsilon", "zeta", "eta", "theta"].map((t) => (
      <Card key={t} style={{ padding: "calc(var(--sf-unit) * 0.25) var(--sf-unit)" }}>
        {t}
      </Card>
    ))}
  </Grid>
);

export const Spans: Story = () => (
  <Grid columns={4} gap={0.5}>
    <Grid.Item colSpan={2}>
      <Card>Span 2</Card>
    </Grid.Item>
    <Card>1</Card>
    <Card>1</Card>
    <Card>1</Card>
    <Grid.Item colSpan={3}>
      <Card>Span 3</Card>
    </Grid.Item>
  </Grid>
);

export const Polymorphic: Story = () => (
  <Grid columns={2} gap={0.5} render={<ul style={{ margin: 0, padding: 0, listStyle: "none" }} />}>
    {["one", "two", "three", "four"].map((label) => (
      <Grid.Item key={label} render={<li />}>
        <Card>{label}</Card>
      </Grid.Item>
    ))}
  </Grid>
);

export const StyleEscape: Story = () => (
  <Grid columns={3} gap={1} style={{ gridAutoRows: "calc(var(--sf-unit) * 2)" }}>
    <Card>auto row 1</Card>
    <Card>auto row 1</Card>
    <Card>auto row 1</Card>
    <Card>auto row 2</Card>
    <Card>auto row 2</Card>
  </Grid>
);
