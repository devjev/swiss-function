import type { Story } from "@ladle/react";
import { ArrowUp, User, Warning } from "../Icon";
import { Stat, type StatSize } from "./Stat";

export default { title: "Stat" };

const REVENUE = [3, 4, 3.5, 5, 4.5, 6, 5.5, 7, 8];
const CHURN = [4, 3.6, 3.8, 3.2, 3, 2.6, 2.4, 2.2, 2.1];

const wrap = (children: React.ReactNode) => <div style={{ maxWidth: 820 }}>{children}</div>;

export const Playground: Story<{
  size: StatSize;
  delta: number;
  goodDirection: "up" | "down";
  trendType: "line" | "bar";
  showTrend: boolean;
}> = ({ size, delta, goodDirection, trendType, showTrend }) =>
  wrap(
    <Stat
      label="Revenue"
      value="1,284,500 CHF"
      delta={delta}
      goodDirection={goodDirection}
      caption="vs last month"
      trend={showTrend ? REVENUE : undefined}
      trendType={trendType}
      size={size}
      elevation={1}
    />,
  );
Playground.args = {
  size: "md",
  delta: 12.5,
  goodDirection: "up",
  trendType: "line",
  showTrend: true,
};
Playground.argTypes = {
  size: { options: ["sm", "md", "lg"], control: { type: "inline-radio" } },
  trendType: { options: ["line", "bar"], control: { type: "inline-radio" } },
  goodDirection: { options: ["up", "down"], control: { type: "inline-radio" } },
};

export const Group: Story = () =>
  wrap(
    <Stat.Group>
      <Stat
        label="Revenue"
        value="1.28M CHF"
        delta={12.5}
        caption="vs last month"
        trend={REVENUE}
      />
      <Stat label="Active users" value="8,204" delta={8.1} icon={<User />} trend={REVENUE} />
      <Stat
        label="Churn"
        value="2.1%"
        delta={-0.3}
        goodDirection="down"
        caption="lower is better"
        trend={CHURN}
      />
    </Stat.Group>,
  );

export const Standalone: Story = () =>
  wrap(
    <div style={{ display: "grid", gap: "var(--sf-unit)", gridTemplateColumns: "repeat(3, 1fr)" }}>
      <Stat label="Revenue" value="1.28M" delta={12.5} caption="vs last month" elevation={1} />
      <Stat
        label="MRR"
        value="214,000 CHF"
        deltaLabel="87% of target"
        delta={0}
        caption="target 246k"
        elevation={1}
        tone="warning"
      />
      <Stat
        label="Errors"
        value="3"
        delta={2}
        goodDirection="down"
        tone="danger"
        elevation={1}
        icon={<Warning />}
      />
    </div>,
  );

export const Deltas: Story = () =>
  wrap(
    <Stat.Group columns={4}>
      <Stat label="Up is good" value="128" delta={12.5} />
      <Stat label="Down is bad" value="96" delta={-4.2} />
      <Stat label="Churn down" value="2.1%" delta={-0.3} goodDirection="down" />
      <Stat label="No change" value="500" delta={0} />
    </Stat.Group>,
  );

export const Sizes: Story = () =>
  wrap(
    <Stat.Group columns={3}>
      <Stat label="Small" value="42" delta={3} size="sm" trend={REVENUE} />
      <Stat label="Medium" value="42" delta={3} size="md" trend={REVENUE} />
      <Stat label="Large" value="42" delta={3} size="lg" trend={REVENUE} />
    </Stat.Group>,
  );

export const BarTrend: Story = () =>
  wrap(
    <Stat
      label="Weekly signups"
      value="3,912"
      delta={8}
      trend={REVENUE}
      trendType="bar"
      icon={<ArrowUp />}
      elevation={1}
    />,
  );

export const Minimal: Story = () => wrap(<Stat label="Total orders" value="1,204" />);
