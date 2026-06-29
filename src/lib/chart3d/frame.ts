/** Draw the axonometric cube frame + axis ticks onto a Canvas2D context. Shared
 *  by Surface and PointCloud. Split into back/front passes so the data can be
 *  drawn between them (the frame reads as an enclosure, not a wire blob). */

import { token } from "../token";
import { axisTicks, CUBE_EDGES } from "./cube";
import { type Camera, type Fit, project } from "./projection";
import type { Domain } from "./types";

export interface FrameOptions {
  camera: Camera;
  fit: Fit;
  xDomain: Domain;
  yDomain: Domain;
  zDomain: Domain;
  xLabel?: string;
  yLabel?: string;
  /** The chart element, for resolving `--sf-*` tokens (theme-aware). */
  host: Element;
}

function edgeMidDepths(camera: Camera, fit: Fit) {
  return CUBE_EDGES.map(([a, b]) => {
    const pa = project(a[0], a[1], a[2], camera, fit);
    const pb = project(b[0], b[1], b[2], camera, fit);
    return { ax: pa.x, ay: pa.y, bx: pb.x, by: pb.y, depth: (pa.depth + pb.depth) / 2 };
  });
}

/** Edges behind the cube center — draw before the data. */
export function drawFrameBack(ctx: CanvasRenderingContext2D, o: FrameOptions) {
  ctx.strokeStyle = token("--sf-color-border-subtle", "#e5e5e5", o.host);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const e of edgeMidDepths(o.camera, o.fit)) {
    if (e.depth < 0) {
      ctx.moveTo(e.ax, e.ay);
      ctx.lineTo(e.bx, e.by);
    }
  }
  ctx.stroke();
}

/** Front edges + axis ticks/labels — draw after the data. */
export function drawFrameFront(ctx: CanvasRenderingContext2D, o: FrameOptions) {
  const { camera, fit } = o;
  ctx.strokeStyle = token("--sf-color-border-subtle", "#e5e5e5", o.host);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const e of edgeMidDepths(camera, fit)) {
    if (e.depth >= 0) {
      ctx.moveTo(e.ax, e.ay);
      ctx.lineTo(e.bx, e.by);
    }
  }
  ctx.stroke();

  ctx.fillStyle = token("--sf-color-fg", "#0a0a0a", o.host);
  ctx.font = `11px ${token("--sf-font-sans", "system-ui", o.host)}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const text = (t: string, p: { x: number; y: number }, dx: number, dy: number) =>
    ctx.fillText(t, p.x + dx, p.y + dy);
  for (const t of axisTicks(o.xDomain)) text(t.label, project(t.n, 0.5, -0.5, camera, fit), 0, 12);
  for (const t of axisTicks(o.yDomain)) text(t.label, project(0.5, t.n, -0.5, camera, fit), 14, 0);
  for (const t of axisTicks(o.zDomain)) text(t.label, project(-0.5, 0.5, t.n, camera, fit), -14, 0);
  if (o.xLabel) text(o.xLabel, project(0, 0.5, -0.5, camera, fit), 0, 26);
  if (o.yLabel) text(o.yLabel, project(0.5, 0, -0.5, camera, fit), 30, 0);
}
