import { useState } from "react";
import type { ChartAnnotation } from "../../lib/chart";
import { Marimekko, type MarimekkoDatum, type MarimekkoProps } from "./Marimekko";

/** Playwright CT mounts top-level components with serializable props, so the
 *  stateful round-trips (annotation edits, the activate event, a controlled
 *  selection) need an owner. `editable` wires annotation editing and mirrors
 *  each commit to `onChange`; `logActivate` prints the last activated datum
 *  into a test id; `width` sizes the chart. */
export function MarimekkoHarness({
  editable,
  onChange,
  annotations: initial,
  logActivate,
  width = 480,
  ...props
}: Omit<MarimekkoProps, "onAnnotationsChange"> & {
  editable?: boolean;
  onChange?: (next: ChartAnnotation[]) => void;
  logActivate?: boolean;
  width?: number;
}) {
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>(initial ?? []);
  const [activated, setActivated] = useState<MarimekkoDatum | null>(null);
  return (
    <div style={{ width }}>
      <Marimekko
        {...props}
        annotations={editable ? annotations : initial}
        onAnnotationsChange={
          editable
            ? (next) => {
                setAnnotations(next);
                onChange?.(next);
              }
            : undefined
        }
        onPointActivate={logActivate ? setActivated : props.onPointActivate}
      />
      {logActivate ? (
        <div data-testid="activated">{activated ? JSON.stringify(activated) : ""}</div>
      ) : null}
    </div>
  );
}
