/** WebGL "card" node program for Sigma: a sharp-cornered rectangle with a
 *  hairline border and a kind-coloured accent stripe on the leading edge, plus
 *  canvas text (name + sublabel) drawn INSIDE the rect by the label pass.
 *
 *  Modelled on Sigma's own `NodeCircleProgram` (one instanced quad instead of
 *  its triangle; same uniform chain, so a card of height `2 * size` visually
 *  matches a disc of that `size`). Under `PICKING_MODE` the whole rect emits
 *  the node id, so hover/click/drag hit the full card via Sigma's GPU picking.
 *
 *  Hovered/highlighted cards: Sigma paints `drawHover` output on the 2D hovers
 *  canvas, then re-renders the node's WebGL program ABOVE it on the hoverNodes
 *  canvas — which would bury in-card text. Cards therefore register a no-op
 *  hover program (`NodeCardHoverProgram`) and `drawCardNodeHover` paints the
 *  entire card (rect, stripe, text) in 2D instead. */

import type Sigma from "sigma";
import { NodeProgram, type ProgramInfo } from "sigma/rendering";
import type { NodeDisplayData, PartialButFor, RenderParams } from "sigma/types";
import { floatColor } from "sigma/utils";
import { token } from "./build";
import { CARD } from "./cardMetrics";

/** Node display data plus the attributes `applyCardAttributes` stamps. */
type CardData = PartialButFor<NodeDisplayData, "x" | "y" | "size" | "label" | "color"> & {
  cardWidth?: number;
  cardHeight?: number;
  cardBg?: string;
  cardBorder?: string;
  cardSub?: string;
  sublabel?: string;
  /** Per-node text colour override (the hover-fade reducer mutes text with
   *  it); matches the `labelColor: { attribute: "labelColor" }` setting. */
  labelColor?: string;
};

/** Minimal settings surface the canvas draws need (avoids Sigma's generics). */
interface CardLabelSettings {
  labelFont: string;
  labelWeight: string;
  labelColor: { color?: string; attribute?: string };
}

const UNIFORMS = ["u_sizeRatio", "u_correctionRatio", "u_matrix"] as const;

const { UNSIGNED_BYTE, FLOAT } = WebGLRenderingContext;

// language=GLSL
const VERTEX_SHADER_SOURCE = /* glsl */ `
attribute vec4 a_id;
attribute vec4 a_color;
attribute vec4 a_bg;
attribute vec4 a_border;
attribute vec2 a_position;
attribute vec2 a_dims;
attribute vec2 a_corner;

uniform mat3 u_matrix;
uniform float u_sizeRatio;
uniform float u_correctionRatio;

varying vec4 v_color;
varying vec4 v_bg;
varying vec4 v_border;
varying vec2 v_diff;
varying vec2 v_halfDims;
varying float v_cardPx;

const float bias = 255.0 / 254.0;

void main() {
  // Same scalar chain as the disc program (its drawn radius for size s is
  // 2 * s * correction / sizeRatio), so a card of height 2s matches a disc of
  // size s and the CPU-side scaleSize() math lines up with the labels.
  float scale = u_correctionRatio / u_sizeRatio * 2.0;
  vec2 diff = a_corner * a_dims * scale;
  vec2 position = a_position + diff;
  gl_Position = vec4((u_matrix * vec3(position, 1)).xy, 0, 1);

  v_diff = diff;
  v_halfDims = a_dims * 0.5 * scale;
  v_cardPx = scale;

  #ifdef PICKING_MODE
  v_color = a_id;
  #else
  v_color = a_color;
  #endif
  v_color.a *= bias;
  v_bg = a_bg;
  v_bg.a *= bias;
  v_border = a_border;
  v_border.a *= bias;
}
`;

// language=GLSL
const FRAGMENT_SHADER_SOURCE = /* glsl */ `
precision highp float;

varying vec4 v_color;
varying vec4 v_bg;
varying vec4 v_border;
varying vec2 v_diff;
varying vec2 v_halfDims;
varying float v_cardPx;

uniform float u_correctionRatio;

const vec4 transparent = vec4(0.0, 0.0, 0.0, 0.0);

void main(void) {
  vec2 d = abs(v_diff) - v_halfDims;
  float dist = max(d.x, d.y);
  float feather = u_correctionRatio * 2.0;

  #ifdef PICKING_MODE
  // The whole rect is the hit target; no antialiasing for picking.
  if (dist > 0.0)
    gl_FragColor = transparent;
  else
    gl_FragColor = v_color;
  #else
  // Hairline border scales with the card but never drops below the feather
  // (so it stays visible when zoomed out).
  float borderW = max(v_cardPx * 1.2, feather);
  vec4 fill = v_bg;
  if (v_diff.x < -v_halfDims.x + v_cardPx * ${CARD.stripe.toFixed(1)})
    fill = v_color;
  if (dist > -borderW)
    fill = v_border;

  float t = 0.0;
  if (dist > feather)
    t = 1.0;
  else if (dist > 0.0)
    t = dist / feather;
  gl_FragColor = mix(fill, transparent, t);
  #endif
}
`;

/** Truncate `text` with an ellipsis to fit `maxWidth` px in the current font.
 *  Memoized: the label pass redraws every frame during camera motion. */
const ellipsisCache = new Map<string, string>();
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  const key = `${ctx.font}|${Math.round(maxWidth)}|${text}`;
  const hit = ellipsisCache.get(key);
  if (hit !== undefined) return hit;
  if (ellipsisCache.size > 10_000) ellipsisCache.clear();
  let out = text;
  if (ctx.measureText(text).width > maxWidth) {
    let lo = 0;
    let hi = text.length;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (ctx.measureText(`${text.slice(0, mid)}…`).width <= maxWidth) lo = mid;
      else hi = mid - 1;
    }
    out = lo > 0 ? `${text.slice(0, lo)}…` : "…";
  }
  ellipsisCache.set(key, out);
  return out;
}

/** Draw the card's text block (name + optional sublabel) inside the rect, on
 *  the 2D labels canvas. Text sizes ride the same px-per-card-px factor as the
 *  WebGL rect, so type scales with the card. */
export function drawCardNodeLabel(
  context: CanvasRenderingContext2D,
  data: CardData,
  settings: CardLabelSettings,
  renderer: Sigma,
  /** Force both lines to one colour (the hover inversion passes the card
   *  background so text reads on the foreground-filled card). */
  textColor?: string,
): void {
  if (!data.label) return;
  const s = renderer.scaleSize(1);
  const w = (data.cardWidth ?? data.size * 2) * s;
  const h = (data.cardHeight ?? data.size * 2) * s;
  if (h < CARD.minTextPx) return;

  const left = data.x - w / 2 + (CARD.stripe + CARD.padX) * s;
  const maxWidth = w - (CARD.stripe + 2 * CARD.padX) * s;
  if (maxWidth <= 0) return;
  const hasSub = typeof data.sublabel === "string" && data.sublabel.length > 0;

  // A per-node labelColor (the hover-fade) mutes both lines uniformly; an
  // explicit textColor (the hover inversion) wins over everything.
  const faded = typeof data.labelColor === "string" ? data.labelColor : undefined;
  context.textBaseline = "middle";
  context.textAlign = "left";
  context.font = `600 ${CARD.labelPx * s}px ${settings.labelFont}`;
  context.fillStyle = textColor ?? faded ?? settings.labelColor.color ?? "#000000";
  const nameY = hasSub ? data.y - ((CARD.lineGap + CARD.sublabelPx) / 2) * s : data.y;
  context.fillText(ellipsize(context, data.label, maxWidth), left, nameY);

  if (hasSub) {
    context.font = `400 ${CARD.sublabelPx * s}px ${settings.labelFont}`;
    context.fillStyle =
      textColor ?? faded ?? data.cardSub ?? settings.labelColor.color ?? "#000000";
    const subY = data.y + ((CARD.lineGap + CARD.labelPx) / 2) * s;
    context.fillText(ellipsize(context, data.sublabel as string, maxWidth), left, subY);
  }
}

/** 2D hover/selection rendering of the whole card, INVERTED: foreground
 *  colour as the fill, background colour for the text — the terminal-selection
 *  read, unmissable in either theme. The accent stripe keeps its colour.
 *  Replaces the WebGL re-render (see the module comment). */
export function drawCardNodeHover(
  context: CanvasRenderingContext2D,
  data: CardData,
  settings: CardLabelSettings,
  renderer: Sigma,
): void {
  const s = renderer.scaleSize(1);
  const w = (data.cardWidth ?? data.size * 2) * s;
  const h = (data.cardHeight ?? data.size * 2) * s;
  const x = data.x - w / 2;
  const y = data.y - h / 2;
  const el = renderer.getContainer();
  const bg = data.cardBg ?? token("--sf-color-bg", "#ffffff", el);

  context.fillStyle = token("--sf-color-fg", "#0a0a0a", el);
  context.fillRect(x, y, w, h);
  // The accent stripe keeps its (possibly selection-tinted) colour.
  context.fillStyle = data.color;
  context.fillRect(x, y, Math.max(1, CARD.stripe * s), h);

  drawCardNodeLabel(context, data, settings, renderer, bg);
}

export class NodeCardProgram extends NodeProgram<(typeof UNIFORMS)[number]> {
  constructor(gl: WebGLRenderingContext, pickingBuffer: WebGLFramebuffer | null, renderer: Sigma) {
    super(gl, pickingBuffer, renderer);
    this.drawLabel = (context, data, settings) =>
      drawCardNodeLabel(context, data as CardData, settings as CardLabelSettings, renderer);
    this.drawHover = (context, data, settings) =>
      drawCardNodeHover(context, data as CardData, settings as CardLabelSettings, renderer);
  }

  getDefinition() {
    return {
      VERTICES: 6,
      VERTEX_SHADER_SOURCE,
      FRAGMENT_SHADER_SOURCE,
      METHOD: WebGLRenderingContext.TRIANGLES,
      UNIFORMS,
      ATTRIBUTES: [
        { name: "a_position", size: 2, type: FLOAT },
        { name: "a_dims", size: 2, type: FLOAT },
        { name: "a_color", size: 4, type: UNSIGNED_BYTE, normalized: true },
        { name: "a_bg", size: 4, type: UNSIGNED_BYTE, normalized: true },
        { name: "a_border", size: 4, type: UNSIGNED_BYTE, normalized: true },
        { name: "a_id", size: 4, type: UNSIGNED_BYTE, normalized: true },
      ],
      CONSTANT_ATTRIBUTES: [{ name: "a_corner", size: 2, type: FLOAT }],
      CONSTANT_DATA: [
        [-0.5, -0.5],
        [0.5, -0.5],
        [0.5, 0.5],
        [-0.5, -0.5],
        [0.5, 0.5],
        [-0.5, 0.5],
      ],
    };
  }

  processVisibleItem(nodeIndex: number, startIndex: number, data: NodeDisplayData): void {
    const card = data as CardData;
    const array = this.array;
    let i = startIndex;
    array[i++] = data.x;
    array[i++] = data.y;
    array[i++] = card.cardWidth ?? data.size * 2;
    array[i++] = card.cardHeight ?? data.size * 2;
    array[i++] = floatColor(data.color);
    array[i++] = floatColor(card.cardBg ?? "#ffffff");
    array[i++] = floatColor(card.cardBorder ?? "#e5e7eb");
    array[i] = nodeIndex;
  }

  setUniforms(params: RenderParams, { gl, uniformLocations }: ProgramInfo): void {
    gl.uniform1f(uniformLocations.u_correctionRatio ?? null, params.correctionRatio);
    gl.uniform1f(uniformLocations.u_sizeRatio ?? null, params.sizeRatio);
    gl.uniformMatrix3fv(uniformLocations.u_matrix ?? null, false, params.matrix);
  }
}

/** No-op WebGL render for hovered cards: the 2D `drawCardNodeHover` paints the
 *  whole card instead, so the hover text is never buried under a WebGL rect. */
export class NodeCardHoverProgram extends NodeCardProgram {
  override render(): void {
    // Intentionally empty (see class comment).
  }
}
