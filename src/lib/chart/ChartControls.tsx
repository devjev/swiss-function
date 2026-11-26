/** On-chart control toolbar for the 2D charts (issue #27 M3 chrome) — the
 *  Graph.Controls posture (Button secondary/ghost sm + ToggleGroup sm,
 *  sharp single-stroke icons) as an internal, prop-driven component: the
 *  charts pass their viewport and annotation editor straight in, no context.
 *  Rendered inside the plot cell, overlaid top-left. */

import type { ReactNode } from "react";
import { lazy, Suspense, useLayoutEffect, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { ChevronDown, Trash, ZoomIn, ZoomOut } from "../../components/Icon";
import { ToggleGroup } from "../../components/ToggleGroup";
import { cx } from "../cx";
import { Glyph } from "../icons";
import { DEFAULT_UNIT_PX, measureCssLength } from "../useCssPx";
import { useCoarsePointer } from "../useMediaQuery";
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

const ChartToolMenu = lazy(() => import("./ChartToolMenu"));

export interface ChartTool {
  value: AnnotationTool;
  label: string;
  icon: () => ReactNode;
}

const TOOLS: ChartTool[] = [
  { value: "select", label: "Select", icon: SelectIcon },
  { value: "line", label: "Trend line", icon: TrendIcon },
  { value: "hline", label: "Horizontal line", icon: HLineIcon },
  { value: "vline", label: "Vertical line", icon: VLineIcon },
  { value: "rect", label: "Region", icon: RectIcon },
  { value: "text", label: "Text note", icon: TextIcon },
  { value: "measure", label: "Measure", icon: MeasureIcon },
];

/** Whether a toolbar of `need` px fits a plot of `plot` px beside what the
 *  plot's top edge already holds (`reserve`: the toolbar's own offsets and the
 *  fullscreen key in the opposite corner). */
export function toolbarFits(need: number, plot: number, reserve: number): boolean {
  return need <= plot - reserve;
}

/** The full toolbar while the plot has room for its widest cluster (the tool
 *  palette), the compact one otherwise. The full form is measured while it is
 *  rendered and the figure kept while the compact form is, so the plot can
 *  grow back into it. */
function useCompact(): { ref: (node: HTMLDivElement | null) => void; compact: boolean } {
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  const [compact, setCompact] = useState(false);
  const compactRef = useRef(false);
  compactRef.current = compact;
  const fullWidth = useRef(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `compact` re-runs the measure after the form swaps, so the full form's width is read as soon as it is back.
  useLayoutEffect(() => {
    const host = root?.parentElement;
    if (!root || !host) return;
    const unit = measureCssLength(root, "var(--sf-unit)") || DEFAULT_UNIT_PX;
    const measure = () => {
      if (!compactRef.current) {
        // The full form wraps its clusters onto rows, so what must fit is the
        // widest cluster (the tool palette) inside the bar's own chrome.
        const cs = getComputedStyle(root);
        const chrome =
          Number.parseFloat(cs.paddingLeft) +
          Number.parseFloat(cs.paddingRight) +
          Number.parseFloat(cs.borderLeftWidth) +
          Number.parseFloat(cs.borderRightWidth);
        let widest = 0;
        for (const child of root.children) {
          widest = Math.max(widest, (child as HTMLElement).offsetWidth);
        }
        fullWidth.current = widest + chrome;
      }
      // Twice the toolbar's inset (it mirrors on the far side) plus the
      // fullscreen key's corner: two units.
      const reserve = root.offsetLeft * 2 + unit * 2;
      setCompact(!toolbarFits(fullWidth.current, host.clientWidth, reserve));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, [root, compact]);
  return { ref: setRoot, compact };
}

export function ChartControls({ viewport, editor, className }: ChartControlsProps) {
  const { ref, compact } = useCompact();
  const coarse = useCoarsePointer();
  if (!viewport && !editor) return null;

  const armZoom = () => {
    if (!viewport) return;
    // Zoom is a MODE (issue #27 follow-up): arm it, drag a region, the
    // viewport zooms to it. Arming disarms any drawing tool.
    const next = !viewport.marqueeArmed;
    viewport.setMarqueeArmed(next);
    if (next) editor?.setTool("select");
  };
  const pickTool = (next: AnnotationTool) => {
    editor?.setTool(next);
    // Drawing tools and zoom mode are mutually exclusive.
    viewport?.setMarqueeArmed(false);
  };
  const reset = viewport ? (
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
  ) : null;

  if (compact) {
    // A plot too narrow for the palette: one key opens the tools as a named
    // list. The zoom keys join that list for a mouse and drop out for a
    // finger, which pinches. Delete shows only while there is something to
    // delete.
    const current = TOOLS.find((t) => t.value === editor?.tool) ?? TOOLS[0];
    const CurrentIcon = current?.icon ?? SelectIcon;
    const zoomInMenu = viewport && !coarse;
    const toolKeyVariant =
      editor && (editor.tool !== "select" || viewport?.marqueeArmed) ? "primary" : "secondary";
    return (
      <div
        ref={ref}
        role="toolbar"
        aria-label="Chart controls"
        aria-orientation="horizontal"
        data-compact=""
        className={cx(styles.root, className)}
      >
        {editor ? (
          // The menu brings Base UI's Menu with it: loaded only once a plot is
          // narrow enough to need it. Until then the key shows, inert.
          <Suspense
            fallback={
              <Button
                variant={toolKeyVariant}
                size="sm"
                aria-label={`Tool: ${current?.label ?? "Select"}`}
                title="Tools"
              >
                <CurrentIcon />
                <Glyph slot="chevronDown" fallback={ChevronDown} size="0.85em" />
              </Button>
            }
          >
            <ChartToolMenu
              tools={TOOLS}
              tool={editor.tool}
              onPick={pickTool}
              variant={toolKeyVariant}
              zoom={
                zoomInMenu
                  ? { armed: viewport.marqueeArmed, onArm: armZoom, onZoomOut: viewport.zoomOut }
                  : undefined
              }
            />
          </Suspense>
        ) : null}
        {viewport && !editor && !coarse ? <ZoomKeys viewport={viewport} armZoom={armZoom} /> : null}
        {reset}
        {editor && editor.selectedIndex != null ? (
          <Button
            variant="ghost"
            size="sm"
            aria-label="Delete annotation"
            title="Delete annotation"
            onClick={editor.deleteSelected}
          >
            <Glyph slot="delete" fallback={Trash} />
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-label="Chart controls"
      aria-orientation="horizontal"
      className={cx(styles.root, className)}
    >
      {viewport ? (
        <div className={styles.cluster}>
          <ZoomKeys viewport={viewport} armZoom={armZoom} />
          {reset}
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
              if (next) pickTool(next);
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
            <Glyph slot="delete" fallback={Trash} />
          </Button>
        </>
      ) : null}
    </div>
  );
}

function ZoomKeys({
  viewport,
  armZoom,
}: {
  viewport: NonNullable<ChartControlsProps["viewport"]>;
  armZoom: () => void;
}) {
  return (
    <>
      <Button
        variant={viewport.marqueeArmed ? "primary" : "secondary"}
        size="sm"
        aria-label="Zoom in"
        aria-pressed={viewport.marqueeArmed}
        title="Zoom in: drag to select the region to zoom to"
        onClick={armZoom}
      >
        <Glyph slot="zoomIn" fallback={ZoomIn} />
      </Button>
      <Button
        variant="secondary"
        size="sm"
        aria-label="Zoom out"
        title="Zoom out"
        onClick={viewport.zoomOut}
      >
        <Glyph slot="zoomOut" fallback={ZoomOut} />
      </Button>
    </>
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
