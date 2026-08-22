/** WebGL "elbow" edge program for Sigma: an orthogonal three-segment connector
 *  (parent edge → axis drop → bus → axis drop into the child's near edge), the
 *  classic symmetric org-chart wiring. Used by the Graph's org+card mode in
 *  place of straight center-to-center edges.
 *
 *  Modelled on Sigma's `EdgeRectangleProgram`: same uniform chain and
 *  antialiasing idiom, but each instance draws three quads (18 vertices) whose
 *  endpoints are the per-edge waypoints computed CPU-side from the node boxes.
 *  Segment ends extend by a half-thickness along their direction so the
 *  right-angle joints render as clean filled corners instead of notches; the
 *  overshoot into the cards is hidden (nodes paint above edges). Under
 *  `PICKING_MODE` all three segments emit the edge id, so edge hover/click
 *  follow the actual elbow path. */

import { EdgeProgram, type ProgramInfo } from "sigma/rendering";
import type { EdgeDisplayData, NodeDisplayData, RenderParams } from "sigma/types";
import { floatColor } from "sigma/utils";
import { EDGE_STYLE_CODE, type EdgeStyle } from "./styledEdgeProgram";

/** Node display data plus the card attributes (when `nodeStyle="card"`). */
type BoxData = NodeDisplayData & {
  type?: string;
  cardWidth?: number;
  cardHeight?: number;
  /** Stacked-member spine offset stamped by the org layout (size units). */
  orgStacked?: number;
};

const UNIFORMS = [
  "u_matrix",
  "u_zoomRatio",
  "u_sizeRatio",
  "u_correctionRatio",
  "u_pixelRatio",
  "u_feather",
  "u_minEdgeThickness",
] as const;

const { UNSIGNED_BYTE, FLOAT } = WebGLRenderingContext;

// language=GLSL
const VERTEX_SHADER_SOURCE = /* glsl */ `
attribute vec4 a_id;
attribute vec4 a_color;
attribute vec2 a_source;
attribute vec2 a_target;
attribute vec2 a_sourceHalf;
attribute vec2 a_targetHalf;
attribute float a_thickness;
attribute float a_style;
attribute float a_spine;
attribute float a_seg;
attribute float a_positionCoef;
attribute float a_normalCoef;

uniform mat3 u_matrix;
uniform float u_sizeRatio;
uniform float u_zoomRatio;
uniform float u_pixelRatio;
uniform float u_correctionRatio;
uniform float u_minEdgeThickness;
uniform float u_feather;

varying vec4 v_color;
varying vec2 v_normal;
varying float v_thickness;
varying float v_feather;
varying float v_style;
varying float v_along;

const float bias = 255.0 / 254.0;

void main() {
  // Node half-extents arrive in SIZE units (card px); positions are in the
  // framed graph space. The same correction chain the card program uses maps
  // size units into framed units, so the elbow meets the card edges exactly.
  float dimScale = u_correctionRatio / u_sizeRatio * 2.0;
  vec2 sHalf = a_sourceHalf * dimScale;
  vec2 tHalf = a_targetHalf * dimScale;

  // Routing: rank-separated boxes get the classic vertical elbow (bottom →
  // bus → top) — even a far-off child connects through its parent's bottom
  // edge, never sideways across the chart. Only vertically-overlapping boxes
  // (direction "right" peers) route through their side edges.
  vec2 p0; vec2 p1; vec2 p2; vec2 p3;
  bool vertSep = (a_target.y + tHalf.y < a_source.y - sHalf.y)
    || (a_source.y + sHalf.y < a_target.y - tHalf.y);
  // Only a truly collinear pair collapses to a straight run; visible offsets
  // keep the honest elbow so drops always leave the parent's centre.
  float straightBelow = 1.5 * dimScale;
  if (vertSep) {
    float down = a_target.y <= a_source.y ? 1.0 : -1.0;
    float sEdge = a_source.y - down * sHalf.y;
    float tEdge = a_target.y + down * tHalf.y;
    float mid = (sEdge + tEdge) * 0.5;
    float spineX = a_target.x - tHalf.x - a_spine * dimScale;
    p3 = vec2(a_target.x, tEdge);
    if (a_spine > 0.0 && down > 0.0 && abs(spineX - a_source.x) < sHalf.x) {
      // Stacked member whose spine falls under the source card: file-tree
      // side entry — one shared spine down the stack, a stub into each
      // member's leading edge.
      p0 = vec2(spineX, sEdge);
      p1 = vec2(spineX, a_target.y);
      p2 = vec2(a_target.x - tHalf.x, a_target.y);
      p3 = p2;
    } else if (abs(a_target.x - a_source.x) < straightBelow) {
      p0 = vec2(a_target.x, sEdge);
      p1 = p0;
      p2 = p3;
    } else {
      p0 = vec2(a_source.x, sEdge);
      p1 = vec2(a_source.x, mid);
      p2 = vec2(a_target.x, mid);
    }
  } else {
    float right = a_target.x >= a_source.x ? 1.0 : -1.0;
    float sEdge = a_source.x + right * sHalf.x;
    float tEdge = a_target.x - right * tHalf.x;
    float mid = (sEdge + tEdge) * 0.5;
    p3 = vec2(tEdge, a_target.y);
    if (abs(a_target.y - a_source.y) < straightBelow) {
      p0 = vec2(sEdge, a_target.y);
      p1 = p0;
      p2 = p3;
    } else {
      p0 = vec2(sEdge, a_source.y);
      p1 = vec2(mid, a_source.y);
      p2 = vec2(mid, a_target.y);
    }
  }

  vec2 A = p0;
  vec2 B = p1;
  float lenBefore = 0.0;
  if (a_seg > 1.5) {
    A = p2;
    B = p3;
    lenBefore = length(p1 - p0) + length(p2 - p1);
  } else if (a_seg > 0.5) {
    A = p1;
    B = p2;
    lenBefore = length(p1 - p0);
  }
  vec2 dir = B - A;
  float len = length(dir);
  vec2 unitDir = len > 0.0 ? dir / len : vec2(0.0, 0.0);
  vec2 unitNormal = vec2(-unitDir.y, unitDir.x);

  // Same thickness chain as Sigma's edge rectangle: at least
  // u_minEdgeThickness px on screen, corrected into WebGL units.
  float pixelsThickness = max(a_thickness, u_minEdgeThickness * u_sizeRatio);
  float webGLThickness = pixelsThickness * u_correctionRatio / u_sizeRatio;

  // Extend both ends along the segment by the half-thickness so the
  // right-angle joints overlap into clean square corners.
  vec2 point = mix(A, B, a_positionCoef) + unitDir * (a_positionCoef * 2.0 - 1.0) * webGLThickness;
  gl_Position = vec4((u_matrix * vec3(point + unitNormal * a_normalCoef * webGLThickness, 1)).xy, 0, 1);

  v_thickness = webGLThickness / u_zoomRatio;
  v_normal = unitNormal * a_normalCoef;
  v_feather = u_feather * u_correctionRatio / u_zoomRatio / u_pixelRatio * 2.0;
  v_style = a_style;
  // Cumulative distance along the whole elbow in size units, so the dash
  // pattern flows continuously around the corners.
  v_along = (lenBefore + a_positionCoef * len) / dimScale;

  #ifdef PICKING_MODE
  v_color = a_id;
  #else
  v_color = a_color;
  #endif
  v_color.a *= bias;
}
`;

// language=GLSL
const FRAGMENT_SHADER_SOURCE = /* glsl */ `
precision mediump float;

varying vec4 v_color;
varying vec2 v_normal;
varying float v_thickness;
varying float v_feather;
varying float v_style;
varying float v_along;

const vec4 transparent = vec4(0.0, 0.0, 0.0, 0.0);

void main(void) {
  #ifdef PICKING_MODE
  // Solid coverage for picking: the hit target has no holes.
  gl_FragColor = v_color;
  #else
  float dist = length(v_normal) * v_thickness;
  float t = smoothstep(v_thickness - v_feather, v_thickness, dist);
  vec4 color = mix(v_color, transparent, t);
  if (v_style > 0.5) {
    // Dash pattern along the connector: dashed = 6-unit pitch, dotted = 2.
    float period = v_style > 1.5 ? 2.0 : 6.0;
    float duty = v_style > 1.5 ? 0.4 : 0.6;
    if (fract(v_along / period) > duty) color = transparent;
  }
  gl_FragColor = color;
  #endif
}
`;

/** Half-extent of a node along an axis: card half-dims for cards, the disc
 *  radius otherwise. */
function halfExtent(data: BoxData, axis: "x" | "y"): number {
  if (data.type === "card") {
    const dim = axis === "x" ? data.cardWidth : data.cardHeight;
    if (typeof dim === "number") return dim / 2;
  }
  return data.size;
}

/** Constant per-vertex data: 3 segments × 6 vertices of
 *  [segment, positionCoef, normalCoef]. */
const CONSTANT_DATA: number[][] = [];
for (let seg = 0; seg < 3; seg++) {
  CONSTANT_DATA.push(
    [seg, 0, 1],
    [seg, 0, -1],
    [seg, 1, 1],
    [seg, 1, 1],
    [seg, 0, -1],
    [seg, 1, -1],
  );
}

export class EdgeElbowProgram extends EdgeProgram<(typeof UNIFORMS)[number]> {
  getDefinition() {
    return {
      VERTICES: 18,
      VERTEX_SHADER_SOURCE,
      FRAGMENT_SHADER_SOURCE,
      METHOD: WebGLRenderingContext.TRIANGLES,
      UNIFORMS,
      ATTRIBUTES: [
        { name: "a_source", size: 2, type: FLOAT },
        { name: "a_target", size: 2, type: FLOAT },
        { name: "a_sourceHalf", size: 2, type: FLOAT },
        { name: "a_targetHalf", size: 2, type: FLOAT },
        { name: "a_thickness", size: 1, type: FLOAT },
        { name: "a_style", size: 1, type: FLOAT },
        { name: "a_spine", size: 1, type: FLOAT },
        { name: "a_color", size: 4, type: UNSIGNED_BYTE, normalized: true },
        { name: "a_id", size: 4, type: UNSIGNED_BYTE, normalized: true },
      ],
      CONSTANT_ATTRIBUTES: [
        { name: "a_seg", size: 1, type: FLOAT },
        { name: "a_positionCoef", size: 1, type: FLOAT },
        { name: "a_normalCoef", size: 1, type: FLOAT },
      ],
      CONSTANT_DATA,
    };
  }

  processVisibleItem(
    edgeIndex: number,
    startIndex: number,
    sourceData: NodeDisplayData,
    targetData: NodeDisplayData,
    data: EdgeDisplayData,
  ): void {
    const s = sourceData as BoxData;
    const t = targetData as BoxData;

    const array = this.array;
    let i = startIndex;
    array[i++] = s.x;
    array[i++] = s.y;
    array[i++] = t.x;
    array[i++] = t.y;
    array[i++] = halfExtent(s, "x");
    array[i++] = halfExtent(s, "y");
    array[i++] = halfExtent(t, "x");
    array[i++] = halfExtent(t, "y");
    array[i++] = data.size || 1;
    array[i++] = EDGE_STYLE_CODE[(data as { edgeStyle?: EdgeStyle }).edgeStyle ?? "solid"] ?? 0;
    array[i++] = typeof t.orgStacked === "number" ? t.orgStacked : 0;
    array[i++] = floatColor(data.color);
    array[i] = edgeIndex;
  }

  setUniforms(params: RenderParams, { gl, uniformLocations }: ProgramInfo): void {
    gl.uniformMatrix3fv(uniformLocations.u_matrix ?? null, false, params.matrix);
    gl.uniform1f(uniformLocations.u_zoomRatio ?? null, params.zoomRatio);
    gl.uniform1f(uniformLocations.u_sizeRatio ?? null, params.sizeRatio);
    gl.uniform1f(uniformLocations.u_correctionRatio ?? null, params.correctionRatio);
    gl.uniform1f(uniformLocations.u_pixelRatio ?? null, params.pixelRatio);
    gl.uniform1f(uniformLocations.u_feather ?? null, params.antiAliasingFeather);
    gl.uniform1f(uniformLocations.u_minEdgeThickness ?? null, params.minEdgeThickness);
  }
}
