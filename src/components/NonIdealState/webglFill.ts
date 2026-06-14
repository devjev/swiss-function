/** WebGL fragment-shader dithered fill. The GPU computes the effect intensity
 *  + Bayer ordered-dither per pixel; the CPU only updates uniforms and issues
 *  one draw call per frame (benchmarked ~0.05ms/frame, flat with grid size).
 *  Shared by the shipped component and the perf-regression rig. */

import type { EffectName, NoiseParams, RippleParams } from "./fields";

const BAYER16 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";
const FRAG = `precision mediump float;
uniform vec2 u_res;uniform vec2 u_cell;uniform vec2 u_grid;uniform float u_t;uniform float u_bayer[16];
uniform int u_effect;uniform float u_speed;uniform float u_wavelength;uniform float u_amplitude;
uniform float u_rate;uniform float u_density;uniform float u_seed;uniform vec3 u_color;uniform float u_alpha;
float hash(vec3 p){p=fract(p*vec3(0.1031,0.1030,0.0973));p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
void main(){
  float cx=floor(gl_FragCoord.x/u_cell.x);
  float cy=floor((u_res.y-gl_FragCoord.y)/u_cell.y);
  float inten=0.0;
  if(u_effect==0){
    float ox=(u_grid.x-1.0)*0.5;float oy=(u_grid.y-1.0)*0.5;
    float dx=cx-ox;float dy=(cy-oy)*1.7;float dist=sqrt(dx*dx+dy*dy);
    inten=(0.5+0.5*sin(dist*(6.2831853/u_wavelength)-u_t*u_speed))*u_amplitude;
  }else if(u_effect==1){
    float frame=floor(u_t*u_rate);
    inten=u_density+(hash(vec3(cx,cy,frame+u_seed))-0.5);
  }else{
    float nx=(cx/max(u_grid.x-1.0,1.0))*2.0-1.0;
    float ny=(cy/max(u_grid.y-1.0,1.0))*2.0-1.0;
    float d=min(1.0,sqrt(nx*nx+ny*ny)/1.41421356);
    inten=max(0.0,(d-0.28)/0.72);
  }
  int idx=int(mod(cy,4.0))*4+int(mod(cx,4.0));
  float th=0.0;
  for(int k=0;k<16;k++){if(k==idx)th=u_bayer[k];}
  float scaled=clamp(inten,0.0,1.0)*4.0;
  float base=floor(scaled);
  float level=min(base+(scaled-base>th?1.0:0.0),4.0);
  gl_FragColor=vec4(u_color,(level/4.0)*u_alpha);
}`;

const EFFECT_CODE: Record<EffectName, number> = { ripple: 0, noise: 1, vignette: 2 };

export interface FillFrame extends RippleParams, NoiseParams {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  /** Seconds since start. */
  t: number;
  effect?: EffectName;
  /** Base color as 0..1 RGB. Default a muted grey. */
  color?: [number, number, number];
  /** Overall opacity multiplier 0..1. Default 1. */
  alpha?: number;
}

export interface WebglFill {
  /** Resize the backing store to CSS size × dpr. */
  resize(wCss: number, hCss: number): void;
  /** Render one frame. */
  draw(f: FillFrame): void;
  /** Release the GL context. */
  destroy(): void;
}

/** Create a WebGL fill bound to `canvas`, or null if WebGL is unavailable. */
export function createWebglFill(canvas: HTMLCanvasElement): WebglFill | null {
  const gl = canvas.getContext("webgl", {
    alpha: true,
    antialias: false,
    premultipliedAlpha: true,
  });
  if (!gl) return null;

  const compile = (type: number, src: string): WebGLShader | null => {
    const sh = gl.createShader(type);
    if (!sh) return null;
    gl.shaderSource(sh, src);
    gl.compileShader(sh);
    return sh;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  // biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is a WebGL call, not a React hook
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); // premultiplied

  const u = (name: string) => gl.getUniformLocation(prog, name);
  const U = {
    res: u("u_res"),
    cell: u("u_cell"),
    grid: u("u_grid"),
    t: u("u_t"),
    effect: u("u_effect"),
    speed: u("u_speed"),
    wavelength: u("u_wavelength"),
    amplitude: u("u_amplitude"),
    rate: u("u_rate"),
    density: u("u_density"),
    seed: u("u_seed"),
    color: u("u_color"),
    alpha: u("u_alpha"),
  };
  gl.uniform1fv(u("u_bayer[0]"), BAYER16);

  let dpr = 1;

  return {
    resize(wCss, hCss) {
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.max(1, Math.ceil(wCss * dpr));
      canvas.height = Math.max(1, Math.ceil(hCss * dpr));
    },
    draw(f) {
      const effect = f.effect ?? "ripple";
      const [r, g, b] = f.color ?? [0.42, 0.447, 0.502];
      const alpha = f.alpha ?? 1;
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform2f(U.res, canvas.width, canvas.height);
      gl.uniform2f(U.cell, f.cellW * dpr, f.cellH * dpr);
      gl.uniform2f(U.grid, f.cols, f.rows);
      gl.uniform1f(U.t, f.t);
      gl.uniform1i(U.effect, EFFECT_CODE[effect]);
      gl.uniform1f(U.speed, f.speed ?? 3);
      gl.uniform1f(U.wavelength, f.wavelength ?? 11);
      gl.uniform1f(U.amplitude, f.amplitude ?? 0.95);
      gl.uniform1f(U.rate, f.rate ?? 12);
      gl.uniform1f(U.density, f.density ?? 0.55);
      gl.uniform1f(U.seed, f.seed ?? 1);
      // Premultiply color by alpha for the premultiplied blend.
      gl.uniform3f(U.color, r * alpha, g * alpha, b * alpha);
      gl.uniform1f(U.alpha, alpha);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    destroy() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
