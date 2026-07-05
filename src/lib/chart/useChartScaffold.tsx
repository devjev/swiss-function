/** Shared wiring for the interactive 2D-chart scaffolding (issue #35).
 *
 *  `useChartScaffold` bundles the three stateful hooks every Cartesian chart
 *  needs — fullscreen, the annotation editor, and the zoom/pan viewport — plus
 *  the keyboard cascade and the root data-attributes, so each chart wires them
 *  the same way and can't drift. The chart still owns its own geometry: it
 *  computes its scales from `viewport.domain`, writes its px→data inverses into
 *  `invertRef` each render (the pointer handlers read them live), and renders
 *  its `AnnotationsLayer` inside whatever SVG it already draws.
 *
 *  `ChartChrome` renders the SVG-independent overlays that are identical across
 *  charts: the controls toolbar, the inline note editor, and the aria-live
 *  range readout. `FullscreenToggle` is a single element the chart drops in its
 *  own root grid.
 */

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";
import { useRef } from "react";
import { FullscreenToggle } from "../../components/Fullscreen";
import { useFullscreen } from "../useFullscreen";
import type { AnnotationX, ChartAnnotation } from "./Annotations";
import { ChartControls } from "./ChartControls";
import type { ChartScaffolding } from "./scaffolding";
import type { AnnotationEditor } from "./useAnnotationEditor";
import { useAnnotationEditor } from "./useAnnotationEditor";
import scaffoldStyles from "./useChartScaffold.module.css";
import type { Domain, Viewport } from "./useViewport";
import { useViewport } from "./useViewport";

/** px→data inverses, refreshed by the chart every render. */
export interface ChartInverts {
  xFromPx: (px: number) => AnnotationX;
  yFromPx: (px: number) => number;
}

export interface UseChartScaffoldOptions {
  plotRef: RefObject<HTMLElement | null>;
  scaffolding: ChartScaffolding;
  controls?: boolean;
  zoomable?: boolean;
  annotations?: readonly ChartAnnotation[];
  onAnnotationsChange?: ((annotations: ChartAnnotation[]) => void) | undefined;
  /** The continuous axis this chart windows when `zoomable`. */
  value: {
    /** Full data extent of the value axis. */
    extent: Domain;
    /** Controlled visible domain, or omit/null for uncontrolled. */
    domain?: Domain | null;
    onDomainChange?: (domain: Domain | null) => void;
    /** Smallest visible span (zoom-in ceiling). */
    minSpan: number;
    formatValue: (value: number) => string;
    /** Screen axis the value maps to. Default `"y"` (a vertical value axis). */
    axis?: "x" | "y";
  };
}

export interface ChartScaffold {
  /** The viewport — inert (full extent) unless `zoomable`. Feed
   *  `zoomable ? viewport.domain : extent` to the value scale. */
  viewport: Viewport;
  zoomable: boolean;
  editor: AnnotationEditor;
  editingEnabled: boolean;
  expanded: boolean;
  toggleExpanded: () => void;
  /** The chart writes its current px→data inverses here each render. */
  invertRef: RefObject<ChartInverts>;
  /** Spread on the chart root: focusability + the merged keyboard cascade. */
  rootProps: {
    tabIndex?: number;
    onKeyDown?: (e: ReactKeyboardEvent) => void;
    "aria-keyshortcuts"?: string;
  };
  /** Data-attributes for the root (posture, zoom, armed tool, expansion). */
  rootData: Record<string, string | undefined>;
  /** True when either zoom or annotation editing is active. */
  interactive: boolean;
}

export function useChartScaffold({
  plotRef,
  scaffolding,
  controls,
  zoomable,
  annotations,
  onAnnotationsChange,
  value,
}: UseChartScaffoldOptions): ChartScaffold {
  const { expanded, toggle: toggleExpanded } = useFullscreen({});

  const invertRef = useRef<ChartInverts>({ xFromPx: (px) => px, yFromPx: (px) => px });

  const editingEnabled = !!controls && !!onAnnotationsChange;
  const editor = useAnnotationEditor({
    annotations: annotations ?? [],
    onAnnotationsChange,
    enabled: editingEnabled,
    xFromPx: (px) => invertRef.current.xFromPx(px),
    yFromPx: (px) => invertRef.current.yFromPx(px),
    plotRef,
  });

  const viewport = useViewport({
    extent: value.extent,
    domain: zoomable ? (value.domain ?? undefined) : undefined,
    onDomainChange: value.onDomainChange,
    minSpan: value.minSpan,
    plotRef,
    enabled: !!zoomable,
    suspended: editor.toolArmed,
    formatValue: value.formatValue,
    axis: value.axis ?? "y",
  });

  const interactive = !!zoomable || editingEnabled;

  const handleRootKeyDown = (e: ReactKeyboardEvent) => {
    if (editingEnabled && editor.handleKeyDown(e)) return;
    if (zoomable) viewport.rootProps.onKeyDown(e);
  };

  const rootProps = interactive
    ? {
        tabIndex: 0,
        onKeyDown: handleRootKeyDown,
        ...(zoomable ? { "aria-keyshortcuts": viewport.rootProps["aria-keyshortcuts"] } : {}),
      }
    : {};

  const rootData: Record<string, string | undefined> = {
    "data-scaffolding": scaffolding,
    "data-zoomable": zoomable ? "" : undefined,
    "data-tool": editor.toolArmed || viewport.marqueeArmed ? "" : undefined,
    "data-expanded": expanded ? "" : undefined,
  };

  return {
    viewport,
    zoomable: !!zoomable,
    editor,
    editingEnabled,
    expanded,
    toggleExpanded,
    invertRef,
    rootProps,
    rootData,
    interactive,
  };
}

export { FullscreenToggle, scaffoldStyles };

/** The SVG-independent overlays every chart renders identically inside its plot
 *  cell: the controls toolbar, the inline note editor, and the aria-live range
 *  readout. The chart passes its own data→px projectors so the note editor can
 *  sit at the annotation's anchor. */
export function ChartChrome({
  scaffold,
  controls,
  xDataToPx,
  yDataToPx,
}: {
  scaffold: ChartScaffold;
  controls: boolean;
  xDataToPx: (x: AnnotationX) => number;
  yDataToPx: (y: number) => number;
}) {
  const { viewport, zoomable, editor, editingEnabled } = scaffold;
  const textEdit = editor.textEdit;
  return (
    <>
      {controls ? (
        <ChartControls
          viewport={zoomable ? viewport : undefined}
          editor={editingEnabled ? editor : undefined}
        />
      ) : null}
      {textEdit ? (
        <div
          className={scaffoldStyles.textEditWrap}
          style={
            {
              left: xDataToPx(textEdit.anchor.x),
              top: yDataToPx(textEdit.anchor.y),
            } as CSSProperties
          }
          data-annotation=""
        >
          <input
            ref={(el) => el?.focus()}
            className={scaffoldStyles.textEditInput}
            value={textEdit.value}
            placeholder="Note…"
            onChange={(e) => textEdit.onChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                textEdit.commit();
              } else if (e.key === "Escape") {
                e.preventDefault();
                e.stopPropagation();
                textEdit.cancel();
              }
            }}
            onBlur={() => textEdit.commit()}
          />
        </div>
      ) : null}
      {zoomable ? (
        <div className={scaffoldStyles.srOnly} aria-live="polite">
          {viewport.announcement}
        </div>
      ) : null}
    </>
  );
}
