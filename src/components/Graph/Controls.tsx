import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import type { LayoutKind } from "../../lib/graph/types";
import { Button } from "../Button";
import { ToggleGroup } from "../ToggleGroup";
import styles from "./Controls.module.css";
import { useGraphControls } from "./context";

/** Human labels for the layout toggle, in display order. */
const LAYOUTS: ReadonlyArray<{ value: LayoutKind; label: string }> = [
  { value: "force", label: "Force" },
  { value: "tree", label: "Tree" },
  { value: "radial", label: "Radial" },
  { value: "concentric", label: "Concentric" },
  { value: "grid", label: "Grid" },
];

export interface GraphControlsProps extends ComponentPropsWithoutRef<"div"> {}

/** Navigation toolbar for an enclosing `<Graph>`: zoom in/out, fit-to-view,
 *  reset, and a layout selector. Reads the camera/layout handle from
 *  `GraphContext`, so it must be rendered as a child of `<Graph>`. Reuses the
 *  library `Button` and `ToggleGroup`; all visuals via `--sf-*` tokens. */
export const GraphControlsBar = forwardRef<HTMLDivElement, GraphControlsProps>(
  function GraphControls({ className, ...rest }, ref) {
    const { zoomIn, zoomOut, fitView, reset, layout, setLayout } = useGraphControls();
    return (
      <div
        {...rest}
        ref={ref}
        role="toolbar"
        aria-label="Graph controls"
        aria-orientation="horizontal"
        className={cx(styles.root, className)}
      >
        <div className={styles.cluster}>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Zoom in"
            title="Zoom in"
            onClick={zoomIn}
          >
            <ZoomInIcon />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={zoomOut}
          >
            <ZoomOutIcon />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Fit to view"
            title="Fit to view"
            onClick={fitView}
          >
            <FitIcon />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Reset view"
            title="Reset view"
            onClick={reset}
          >
            Reset
          </Button>
        </div>
        <ToggleGroup
          size="sm"
          aria-label="Layout"
          value={[layout]}
          onValueChange={(value) => {
            const next = (value as LayoutKind[])[0];
            // ToggleGroup is single-select here; ignore an empty toggle-off so
            // the active layout always stays selected.
            if (next) setLayout(next);
          }}
        >
          {LAYOUTS.map(({ value, label }) => (
            <ToggleGroup.Item key={value} value={value}>
              {label}
            </ToggleGroup.Item>
          ))}
        </ToggleGroup>
      </div>
    );
  },
);

/* --- Icons. Sharp, single-stroke, sized to the current font; stroke is
   `currentColor` so they inherit the Button's themed foreground. --- */

const ICON_PROPS = {
  width: "1em",
  height: "1em",
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  "aria-hidden": true,
} as const;

function ZoomInIcon() {
  return (
    <svg {...ICON_PROPS}>
      <title>Zoom in</title>
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" />
      <line x1="7" y1="5" x2="7" y2="9" />
      <line x1="5" y1="7" x2="9" y2="7" />
    </svg>
  );
}

function ZoomOutIcon() {
  return (
    <svg {...ICON_PROPS}>
      <title>Zoom out</title>
      <circle cx="7" cy="7" r="4.5" />
      <line x1="10.5" y1="10.5" x2="14" y2="14" />
      <line x1="5" y1="7" x2="9" y2="7" />
    </svg>
  );
}

function FitIcon() {
  return (
    <svg {...ICON_PROPS}>
      <title>Fit to view</title>
      <path d="M2 5V2h3" />
      <path d="M14 5V2h-3" />
      <path d="M2 11v3h3" />
      <path d="M14 11v3h-3" />
    </svg>
  );
}
