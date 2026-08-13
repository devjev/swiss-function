import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import { Glyph } from "../../lib/icons";
import type { Basemap } from "../../lib/map/types";
import { Button } from "../Button";
import { Fit, ZoomIn, ZoomOut } from "../Icon";
import { ToggleGroup } from "../ToggleGroup";
import styles from "./Controls.module.css";
import { useMapControls } from "./context";

/** Human labels for the basemap toggle, in display order. */
const BASEMAPS: ReadonlyArray<{ value: Basemap; label: string }> = [
  { value: "minimal", label: "Minimal" },
  { value: "street", label: "Street" },
  { value: "terrain", label: "Terrain" },
];

export interface MapControlsProps extends ComponentPropsWithoutRef<"div"> {}

/** Navigation toolbar for an enclosing `<Map>`: zoom in/out, fit-to-overlays,
 *  reset, and a basemap selector. Reads the camera/basemap handle from
 *  `MapContext`, so it must be rendered as a child of `<Map>`. Reuses the library
 *  `Button` and `ToggleGroup`; all visuals via `--sf-*` tokens. */
export const MapControlsBar = forwardRef<HTMLDivElement, MapControlsProps>(function MapControls(
  { className, ...rest },
  ref,
) {
  const { zoomIn, zoomOut, fitBounds, reset, basemap, setBasemap } = useMapControls();
  return (
    <div
      {...rest}
      ref={ref}
      role="toolbar"
      aria-label="Map controls"
      aria-orientation="horizontal"
      className={cx(styles.root, className)}
    >
      <div className={styles.cluster}>
        <Button variant="secondary" size="sm" aria-label="Zoom in" title="Zoom in" onClick={zoomIn}>
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
          aria-label="Fit to overlays"
          title="Fit to overlays"
          onClick={() => fitBounds()}
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
      </div>
      <ToggleGroup
        size="sm"
        aria-label="Basemap"
        value={[basemap]}
        onValueChange={(value) => {
          const next = (value as Basemap[])[0];
          // Single-select: ignore an empty toggle-off so a basemap stays active.
          if (next) setBasemap(next);
        }}
      >
        {BASEMAPS.map(({ value, label }) => (
          <ToggleGroup.Item key={value} value={value}>
            {label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup>
    </div>
  );
});
