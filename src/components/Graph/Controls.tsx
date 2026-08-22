import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import type { LayoutKind } from "../../lib/graph/types";
import { Glyph } from "../../lib/icons";
import { Button } from "../Button";
import { Connect, Fit, ZoomIn, ZoomOut } from "../Icon";
import { ToggleGroup } from "../ToggleGroup";
import styles from "./Controls.module.css";
import { useGraphControls } from "./context";

/** Human labels for the layout toggle, in display order. */
const LAYOUTS: ReadonlyArray<{ value: LayoutKind; label: string }> = [
  { value: "force", label: "Force" },
  { value: "tree", label: "Tree" },
  { value: "org", label: "Org" },
  { value: "radial", label: "Radial" },
  { value: "concentric", label: "Concentric" },
  { value: "grid", label: "Grid" },
];

export interface GraphControlsProps extends ComponentPropsWithoutRef<"div"> {
  /** Which layouts the switcher offers, in this order. Omit for the full set;
   *  `[]` removes the layout switcher entirely (zoom/fit/reset stay). A
   *  layout can still be active without appearing here — the switcher then
   *  just shows nothing pressed. */
  layouts?: LayoutKind[];
}

/** Navigation toolbar for an enclosing `<Graph>`: zoom in/out, fit-to-view,
 *  reset, and a layout selector. Reads the camera/layout handle from
 *  `GraphContext`, so it must be rendered as a child of `<Graph>`. Reuses the
 *  library `Button` and `ToggleGroup`; all visuals via `--sf-*` tokens. */
export const GraphControlsBar = forwardRef<HTMLDivElement, GraphControlsProps>(
  function GraphControls({ className, layouts, ...rest }, ref) {
    const {
      zoomIn,
      zoomOut,
      fitView,
      reset,
      layout,
      setLayout,
      connectable,
      connectMode,
      toggleConnect,
    } = useGraphControls();
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
            <Glyph slot="zoomIn" fallback={ZoomIn} />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={zoomOut}
          >
            <Glyph slot="zoomOut" fallback={ZoomOut} />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Fit to view"
            title="Fit to view"
            onClick={fitView}
          >
            <Glyph slot="fit" fallback={Fit} />
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
          {/* Connect toggle: only shown when the graph is `editable`. While
            pressed, a node→node drag draws an edge. */}
          {connectable && (
            <Button
              variant={connectMode ? "primary" : "secondary"}
              size="sm"
              aria-label="Connect nodes"
              title="Connect nodes — drag from one node to another to add an edge"
              aria-pressed={connectMode}
              data-pressed={connectMode ? "" : undefined}
              onClick={toggleConnect}
            >
              <Glyph slot="connect" fallback={Connect} />
            </Button>
          )}
        </div>
        {(() => {
          const offered =
            layouts === undefined
              ? LAYOUTS
              : layouts
                  .map((v) => LAYOUTS.find((l) => l.value === v))
                  .filter((l): l is (typeof LAYOUTS)[number] => l !== undefined);
          if (offered.length === 0) return null;
          return (
            <ToggleGroup
              size="sm"
              aria-label="Layout"
              value={[layout]}
              onValueChange={(value) => {
                const next = (value as LayoutKind[])[0];
                // ToggleGroup is single-select here; ignore an empty toggle-off
                // so the active layout always stays selected.
                if (next) setLayout(next);
              }}
            >
              {offered.map(({ value, label }) => (
                <ToggleGroup.Item key={value} value={value}>
                  {label}
                </ToggleGroup.Item>
              ))}
            </ToggleGroup>
          );
        })()}
      </div>
    );
  },
);
