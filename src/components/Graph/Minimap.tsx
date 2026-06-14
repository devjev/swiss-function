import type { ComponentPropsWithoutRef, PointerEvent as ReactPointerEvent } from "react";
import { forwardRef, useCallback, useEffect, useRef } from "react";
import { cx } from "../../lib/cx";
import { useGraphInternals } from "./context";
import styles from "./Minimap.module.css";

/** Read a `--sf-*` token off a themed element so minimap colors track the active
 *  theme, never hard-coded. Reads from `el` (the minimap's own canvas, inside the
 *  graph's themed subtree) so it resolves whatever `data-theme` an ancestor sets.
 *  (Mirrors `Graph.tsx`'s helper — kept local to avoid importing a private.) */
function token(name: string, fallback: string, el?: Element | null): string {
  if (typeof document === "undefined") return fallback;
  const source = el ?? document.documentElement;
  const value = getComputedStyle(source).getPropertyValue(name).trim();
  return value || fallback;
}

/** The linear map from framed graph coordinates (the space shared by
 *  `getNodeDisplayData` and `viewportToFramedGraph`) to minimap CSS pixels.
 *  Inverting it turns a minimap click back into a framed point to center on. */
interface Transform {
  minX: number;
  minY: number;
  scale: number;
  offX: number;
  offY: number;
}

export interface GraphMinimapProps extends ComponentPropsWithoutRef<"div"> {}

/** Overview minimap for an enclosing `<Graph>`: a miniature of the whole graph
 *  with a rectangle marking the current viewport. Click or drag anywhere on it
 *  to recenter the camera there. Must be rendered as a child of `<Graph>` (it
 *  reads the renderer from `GraphInternalContext`).
 *
 *  Sigma paints to WebGL with no per-node DOM, so the overview is drawn on a 2D
 *  canvas from framed node positions. Those positions are camera-independent, so
 *  the node layer is cached offscreen and rebuilt only when the graph/layout
 *  changes (`epoch`); each camera move just re-strokes the viewport rectangle. */
export const GraphMinimap = forwardRef<HTMLDivElement, GraphMinimapProps>(function GraphMinimap(
  { className, ...rest },
  ref,
) {
  const { getRenderer, getGraph, epoch } = useGraphInternals();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Offscreen cache of the node dots (camera-independent) + the framed→minimap
  // transform used to place them and to invert clicks.
  const layerRef = useRef<HTMLCanvasElement | null>(null);
  const tfRef = useRef<Transform | null>(null);

  // Re-stroke the viewport rectangle over the cached node layer. Cheap enough to
  // run on every camera update (one drawImage + one strokeRect).
  const drawViewport = useCallback(() => {
    const renderer = getRenderer();
    const canvas = canvasRef.current;
    const layer = layerRef.current;
    const tf = tfRef.current;
    const ctx = canvas?.getContext("2d");
    if (!renderer || !canvas || !layer || !tf || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(layer, 0, 0);
    ctx.scale(dpr, dpr);
    // Viewport corners in framed space (current camera) → minimap pixels.
    const dim = renderer.getDimensions();
    const tl = renderer.viewportToFramedGraph({ x: 0, y: 0 });
    const br = renderer.viewportToFramedGraph({ x: dim.width, y: dim.height });
    const x1 = tf.offX + (tl.x - tf.minX) * tf.scale;
    const y1 = tf.offY + (tl.y - tf.minY) * tf.scale;
    const x2 = tf.offX + (br.x - tf.minX) * tf.scale;
    const y2 = tf.offY + (br.y - tf.minY) * tf.scale;
    ctx.strokeStyle = token("--sf-color-primary", "#2563eb", canvas);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
  }, [getRenderer]);

  // Recompute node geometry and repaint the offscreen layer. Run on mount, when
  // the graph/layout changes, and on resize.
  const rebuild = useCallback(() => {
    const renderer = getRenderer();
    const g = getGraph();
    const canvas = canvasRef.current;
    if (!renderer || !g || !canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w === 0 || h === 0) return;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);

    // Bounding box of framed node positions.
    let minX = Number.POSITIVE_INFINITY;
    let minY = Number.POSITIVE_INFINITY;
    let maxX = Number.NEGATIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;
    const pts: Array<{ x: number; y: number }> = [];
    g.forEachNode((n) => {
      const d = renderer.getNodeDisplayData(n);
      if (!d) return;
      pts.push({ x: d.x, y: d.y });
      if (d.x < minX) minX = d.x;
      if (d.x > maxX) maxX = d.x;
      if (d.y < minY) minY = d.y;
      if (d.y > maxY) maxY = d.y;
    });
    if (pts.length === 0) return;

    const pad = 6;
    const spanX = maxX - minX || 1;
    const spanY = maxY - minY || 1;
    const scale = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY);
    const offX = (w - spanX * scale) / 2;
    const offY = (h - spanY * scale) / 2;
    tfRef.current = { minX, minY, scale, offX, offY };

    let layer = layerRef.current;
    if (!layer) {
      layer = document.createElement("canvas");
      layerRef.current = layer;
    }
    layer.width = canvas.width;
    layer.height = canvas.height;
    const lc = layer.getContext("2d");
    if (!lc) return;
    lc.scale(dpr, dpr);
    lc.fillStyle = token("--sf-color-fg-subtle", "#737373", canvas);
    for (const p of pts) {
      lc.fillRect(offX + (p.x - minX) * scale, offY + (p.y - minY) * scale, 1.2, 1.2);
    }
    drawViewport();
  }, [getRenderer, getGraph, drawViewport]);

  // Subscribe to camera updates + element resize; rebuild on graph/layout epoch.
  // `epoch` is an intentional retrigger: `getRenderer` reads a ref, so the
  // effect must re-run when the graph (re)builds to pick up the new renderer and
  // (re)subscribe + rebuild — it is a dep even though the body doesn't read it.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above — epoch gates re-subscription on (re)build.
  useEffect(() => {
    const renderer = getRenderer();
    const canvas = canvasRef.current;
    if (!renderer || !canvas) return;
    rebuild();
    const camera = renderer.getCamera();
    camera.on("updated", drawViewport);
    // Debounce resize: a rebuild iterates every node, so coalesce the burst of
    // ResizeObserver callbacks during a drag-resize into one trailing rebuild.
    let resizeTimer = 0;
    const ro = new ResizeObserver(() => {
      clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(rebuild, 100);
    });
    ro.observe(canvas);
    return () => {
      camera.off("updated", drawViewport);
      ro.disconnect();
      clearTimeout(resizeTimer);
    };
  }, [getRenderer, epoch, rebuild, drawViewport]);

  // Recenter the camera on the framed point under the pointer (instant — a
  // minimap drag wants to track the cursor, so there is no animation to gate on
  // prefers-reduced-motion).
  const recenter = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      const renderer = getRenderer();
      const tf = tfRef.current;
      const canvas = canvasRef.current;
      if (!renderer || !tf || !canvas) return;
      const box = canvas.getBoundingClientRect();
      const px = event.clientX - box.left;
      const py = event.clientY - box.top;
      renderer.getCamera().setState({
        x: (px - tf.offX) / tf.scale + tf.minX,
        y: (py - tf.offY) / tf.scale + tf.minY,
      });
    },
    [getRenderer],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      recenter(event);
    },
    [recenter],
  );
  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLCanvasElement>) => {
      if (event.buttons === 0) return;
      recenter(event);
    },
    [recenter],
  );

  return (
    <div {...rest} ref={ref} className={cx(styles.root, className)}>
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        aria-label="Graph minimap — click to navigate"
        data-graph-minimap
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
      />
    </div>
  );
});
