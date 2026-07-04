/** On-chart control toolbar for the 2D charts (issue #27 M3 chrome) — the
 *  Graph.Controls posture (Button secondary/ghost sm + ToggleGroup sm,
 *  sharp single-stroke icons) as an internal, prop-driven component: the
 *  charts pass their viewport and annotation editor straight in, no context.
 *  Rendered inside the plot cell, overlaid top-left. */

import type { ReactNode } from "react";
import { Button } from "../../components/Button";
import { ToggleGroup } from "../../components/ToggleGroup";
import { cx } from "../cx";
import styles from "./ChartControls.module.css";
import type { AnnotationEditor, AnnotationTool } from "./useAnnotationEditor";
import type { Viewport } from "./useViewport";

export interface ChartControlsProps {
  /** Zoom cluster (present when the chart is zoomable). */
  viewport?: Pick<Viewport, "zoomOut" | "reset" | "isZoomed" | "marqueeArmed" | "setMarqueeArmed">;
  /** Annotation tool palette (present when editing is enabled). */
  editor?: Pick<AnnotationEditor, "tool" | "setTool" | "selectedIndex" | "deleteSelected">;
  className?: string;
}

const TOOLS: { value: AnnotationTool; label: string; icon: () => ReactNode }[] = [
  { value: "select", label: "Select", icon: SelectIcon },
  { value: "line", label: "Trend line", icon: TrendIcon },
  { value: "hline", label: "Horizontal line", icon: HLineIcon },
  { value: "vline", label: "Vertical line", icon: VLineIcon },
  { value: "rect", label: "Region", icon: RectIcon },
  { value: "text", label: "Text note", icon: TextIcon },
  { value: "measure", label: "Measure", icon: MeasureIcon },
];

export function ChartControls({ viewport, editor, className }: ChartControlsProps) {
  if (!viewport && !editor) return null;
  return (
    <div
      role="toolbar"
      aria-label="Chart controls"
      aria-orientation="horizontal"
      className={cx(styles.root, className)}
    >
      {viewport ? (
        <div className={styles.cluster}>
          <Button
            // Zoom is a MODE (issue #27 follow-up): arm it, drag a region,
            // the viewport zooms to it. Arming disarms any drawing tool.
            variant={viewport.marqueeArmed ? "primary" : "secondary"}
            size="sm"
            aria-label="Zoom in"
            aria-pressed={viewport.marqueeArmed}
            title="Zoom in: drag to select the region to zoom to"
            onClick={() => {
              const next = !viewport.marqueeArmed;
              viewport.setMarqueeArmed(next);
              if (next) editor?.setTool("select");
            }}
          >
            <ZoomInIcon />
          </Button>
          <Button
            variant="secondary"
            size="sm"
            aria-label="Zoom out"
            title="Zoom out"
            onClick={viewport.zoomOut}
          >
            <ZoomOutIcon />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Reset view"
            title="Reset view"
            onClick={viewport.reset}
            disabled={!viewport.isZoomed}
          >
            Reset
          </Button>
        </div>
      ) : null}
      {editor ? (
        <>
          <ToggleGroup
            size="sm"
            aria-label="Annotation tool"
            value={[editor.tool]}
            onValueChange={(value) => {
              const next = (value as AnnotationTool[])[0];
              // Ignore empty toggle-off: "select" is the resting tool.
              if (next) {
                editor.setTool(next);
                // Drawing tools and zoom mode are mutually exclusive.
                viewport?.setMarqueeArmed(false);
              }
            }}
          >
            {TOOLS.map(({ value, label, icon: Icon }) => (
              <ToggleGroup.Item key={value} value={value} aria-label={label} title={label}>
                <Icon />
              </ToggleGroup.Item>
            ))}
          </ToggleGroup>
          <Button
            variant="ghost"
            size="sm"
            aria-label="Delete annotation"
            title="Delete annotation"
            onClick={editor.deleteSelected}
            disabled={editor.selectedIndex == null}
          >
            <DeleteIcon />
          </Button>
        </>
      ) : null}
    </div>
  );
}

/* --- Icons. Sharp, single-stroke, sized to the current font; stroke is
   `currentColor` so they inherit the Button's themed foreground. The zoom
   pair mirrors Graph.Controls'. --- */

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

function SelectIcon() {
  return (
    <svg {...ICON_PROPS}>
      <title>Select</title>
      <path d="M4.5 2.5l7.5 6.5-4.2.6-1.8 3.9z" />
    </svg>
  );
}

function TrendIcon() {
  return (
    <svg {...ICON_PROPS}>
      <title>Trend line</title>
      <line x1="3.5" y1="12.5" x2="12.5" y2="3.5" />
      <circle cx="3.5" cy="12.5" r="1.4" />
      <circle cx="12.5" cy="3.5" r="1.4" />
    </svg>
  );
}

function HLineIcon() {
  return (
    <svg {...ICON_PROPS}>
      <title>Horizontal line</title>
      <line x1="2" y1="8" x2="14" y2="8" strokeDasharray="2.5 2" />
    </svg>
  );
}

function VLineIcon() {
  return (
    <svg {...ICON_PROPS}>
      <title>Vertical line</title>
      <line x1="8" y1="2" x2="8" y2="14" strokeDasharray="2.5 2" />
    </svg>
  );
}

function RectIcon() {
  return (
    <svg {...ICON_PROPS}>
      <title>Region</title>
      <rect x="3" y="4.5" width="10" height="7" />
    </svg>
  );
}

function TextIcon() {
  return (
    <svg {...ICON_PROPS}>
      <title>Text note</title>
      <line x1="4" y1="4" x2="12" y2="4" />
      <line x1="8" y1="4" x2="8" y2="12.5" />
    </svg>
  );
}

/* A ruler: measuring line with perpendicular end ticks. */
function MeasureIcon() {
  return (
    <svg {...ICON_PROPS}>
      <title>Measure</title>
      <line x1="3.5" y1="12.5" x2="12.5" y2="3.5" />
      <line x1="2" y1="11" x2="5" y2="14" />
      <line x1="11" y1="2" x2="14" y2="5" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg {...ICON_PROPS}>
      <title>Delete annotation</title>
      <path d="M4.5 4.5h7l-.7 9h-5.6z" />
      <line x1="3" y1="4.5" x2="13" y2="4.5" />
      <path d="M6.5 4.5V3h3v1.5" />
    </svg>
  );
}
