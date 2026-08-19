import { Stat, type StatProps } from "./Stat";

/** CT mount wrapper. The delta verdict, sparkline, and layout are all
 *  DOM-observable (data attributes, elements), so no callback mirroring is
 *  needed; the harness just fixes a width for the group layout. */
export function StatHarness(props: Partial<StatProps>) {
  return (
    <div style={{ width: 320 }}>
      <Stat label="Revenue" value="1,284,500" {...props} />
    </div>
  );
}

export function StatGroupHarness() {
  return (
    <div style={{ width: 640 }}>
      <Stat.Group columns={3}>
        <Stat label="Revenue" value="1.28M" delta={12.5} trend={[1, 2, 3, 4]} />
        <Stat label="Users" value="8,204" delta={8} />
        <Stat label="Churn" value="2.1%" delta={-0.3} goodDirection="down" />
      </Stat.Group>
    </div>
  );
}
