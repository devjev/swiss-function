import { Reflow } from "./Reflow";

interface HarnessProps {
  /** Outer width in px — drives the container-width collapse. */
  width?: number;
  collapseMode?: "accordion" | "tabs";
}

const cols = (
  <>
    <Reflow.Column title="Alpha" value="alpha">
      <p>Alpha body</p>
    </Reflow.Column>
    <Reflow.Column title="Beta" value="beta">
      <p>Beta body</p>
    </Reflow.Column>
  </>
);

// Use a px threshold so the test doesn't depend on --sf-unit being loaded.
export function ReflowHarness({ width = 1000, collapseMode }: HarnessProps) {
  return (
    <div style={{ width }}>
      {collapseMode === "tabs" ? (
        <Reflow.Root collapseMode="tabs" collapseAt="600px">
          {cols}
        </Reflow.Root>
      ) : (
        <Reflow.Root collapseAt="600px">{cols}</Reflow.Root>
      )}
    </div>
  );
}
