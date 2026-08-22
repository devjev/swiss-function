/** WebGL straight-edge program with line styles (solid / dashed / dotted),
 *  selected per edge via an `edgeStyle` attribute. Modelled on Sigma's
 *  `EdgeRectangleProgram` (same thickness + antialiasing idiom); the dash
 *  pattern runs along the segment in size units, so it scales with the graph
 *  like everything else. Under `PICKING_MODE` the pattern is skipped — the hit
 *  target stays the full continuous edge. Styled edges render without
 *  arrowheads (the style itself is the differentiation). */

import {
  createEdgeCompoundProgram,
  EdgeArrowHeadProgram,
  EdgeProgram,
  type ProgramInfo,
} from "sigma/rendering";
import type { EdgeDisplayData, NodeDisplayData, RenderParams } from "sigma/types";
import { floatColor } from "sigma/utils";

/** Numeric codes for the `edgeStyle` attribute, consumed by the shaders. */
export const EDGE_STYLE_CODE = { solid: 0, dashed: 1, dotted: 2 } as const;
export type EdgeStyle = keyof typeof EDGE_STYLE_CODE;

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
attribute vec2 a_positionStart;
attribute vec2 a_positionEnd;
attribute float a_thickness;
attribute float a_style;
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
  vec2 dir = a_positionEnd - a_positionStart;
  float len = length(dir);
  vec2 unitDir = len > 0.0 ? dir / len : vec2(0.0, 0.0);
  vec2 unitNormal = vec2(-unitDir.y, unitDir.x);

  float pixelsThickness = max(a_thickness, u_minEdgeThickness * u_sizeRatio);
  float webGLThickness = pixelsThickness * u_correctionRatio / u_sizeRatio;

  vec2 point = mix(a_positionStart, a_positionEnd, a_positionCoef);
  gl_Position = vec4((u_matrix * vec3(point + unitNormal * a_normalCoef * webGLThickness, 1)).xy, 0, 1);

  v_thickness = webGLThickness / u_zoomRatio;
  v_normal = unitNormal * a_normalCoef;
  v_feather = u_feather * u_correctionRatio / u_zoomRatio / u_pixelRatio * 2.0;
  v_style = a_style;
  // Distance along the edge in size units (framed length / the framed-per-
  // size-unit factor), so the dash pitch rides the same scale as node sizes.
  float dimScale = u_correctionRatio / u_sizeRatio * 2.0;
  v_along = a_positionCoef * len / dimScale;

  #ifdef PICKING_MODE
  v_color = a_id;
  #else
  v_color = a_color;
  #endif
  v_color.a *= bias;
}
`;

// language=GLSL
export const STYLED_FRAGMENT_SHADER_SOURCE = /* glsl */ `
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
    // Dash pattern along the edge: dashed = 6-unit pitch, dotted = 2-unit.
    float period = v_style > 1.5 ? 2.0 : 6.0;
    float duty = v_style > 1.5 ? 0.4 : 0.6;
    if (fract(v_along / period) > duty) color = transparent;
  }
  gl_FragColor = color;
  #endif
}
`;

const CONSTANT_DATA = [
  [0, 1],
  [0, -1],
  [1, 1],
  [1, 1],
  [0, -1],
  [1, -1],
];

export class EdgeStyledProgram extends EdgeProgram<(typeof UNIFORMS)[number]> {
  getDefinition() {
    return {
      VERTICES: 6,
      VERTEX_SHADER_SOURCE,
      FRAGMENT_SHADER_SOURCE: STYLED_FRAGMENT_SHADER_SOURCE,
      METHOD: WebGLRenderingContext.TRIANGLES,
      UNIFORMS,
      ATTRIBUTES: [
        { name: "a_positionStart", size: 2, type: FLOAT },
        { name: "a_positionEnd", size: 2, type: FLOAT },
        { name: "a_thickness", size: 1, type: FLOAT },
        { name: "a_style", size: 1, type: FLOAT },
        { name: "a_color", size: 4, type: UNSIGNED_BYTE, normalized: true },
        { name: "a_id", size: 4, type: UNSIGNED_BYTE, normalized: true },
      ],
      CONSTANT_ATTRIBUTES: [
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
    const style = (data as { edgeStyle?: EdgeStyle }).edgeStyle;
    const array = this.array;
    let i = startIndex;
    array[i++] = sourceData.x;
    array[i++] = sourceData.y;
    array[i++] = targetData.x;
    array[i++] = targetData.y;
    array[i++] = data.size || 1;
    array[i++] = EDGE_STYLE_CODE[style ?? "solid"] ?? 0;
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

/** Styled edge + directed arrowhead: the line runs to the target centre (the
 *  overshoot past the head hides under the node, which paints above edges),
 *  the head clamps to the target's radius as in Sigma's stock arrow. */
export const EdgeStyledArrowProgram = createEdgeCompoundProgram([
  EdgeStyledProgram,
  EdgeArrowHeadProgram,
]);
