import { useState } from "react";
import type { ChartAnnotation } from "../../lib/chart";
import { DotPlot, type DotPlotDatum, type DotPlotProps } from "./DotPlot";

/** Playwright CT mounts top-level components with serializable props, so the
 *  annotation round-trip and the pinned selection need a stateful owner.
 *  `editable` wires annotation editing and mirrors each commit through
 *  `onChange`; `selectable` mirrors the pinned datum into a readout. */
export function DotPlotHarness({
  editable,
  onChange,
  annotations: initial,
  width = 480,
  ...props
}: Omit<DotPlotProps, "onAnnotationsChange" | "onSelectionChange"> & {
  editable?: boolean;
  onChange?: (next: ChartAnnotation[]) => void;
  width?: number;
}) {
  const [annotations, setAnnotations] = useState<ChartAnnotation[]>(initial ?? []);
  const [selected, setSelected] = useState<DotPlotDatum | null>(null);
  return (
    <div style={{ width }}>
      <DotPlot
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
        onSelectionChange={props.selectable ? setSelected : undefined}
      />
      {props.selectable ? (
        <div data-testid="selected">
          {selected ? `${selected.category} ${selected.series} ${selected.value}` : "none"}
        </div>
      ) : null}
    </div>
  );
}
