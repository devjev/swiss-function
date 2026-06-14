/** WebGL fragment-shader dithered fill. The GPU computes the effect intensity
 *  + Bayer ordered-dither per pixel; the CPU only updates uniforms and issues
 *  one draw call per frame (benchmarked ~0.05ms/frame, flat with grid size).
 *  Shared by the shipped component and the perf-regression rig. */

import type { EffectName, EffectOptions } from "./effects";

const VERT = "attribute vec2 p;void main(){gl_Position=vec4(p,0.0,1.0);}";
// highp: u_t grows unbounded; mediump loses sub-frame precision after a minute
// or two and the animation stutters. Also wrap the ripple phase mod 2π.
const FRAG = `precision highp float;
uniform vec2 u_res;uniform vec2 u_cell;uniform vec2 u_grid;uniform float u_t;
uniform int u_effect;uniform float u_speed;uniform float u_wavelength;uniform float u_gain;
uniform float u_seed;uniform vec3 u_color;uniform float u_alpha;
float hash(vec3 p){p=fract(p*vec3(0.1031,0.1030,0.0973));p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
void main(){
  float colf=gl_FragCoord.x/u_cell.x;
  float rowf=(u_res.y-gl_FragCoord.y)/u_cell.y;
  float cx=floor(colf);float cy=floor(rowf);
  // u_speed is a multiplier (1 = normal pace); per-effect base rates baked in.
  float inten=0.0;
  if(u_effect==0){ // ripple — concentric waves from center (square cells → no aspect skew)
    float ox=(u_grid.x-1.0)*0.5;float oy=(u_grid.y-1.0)*0.5;
    float dx=cx-ox;float dy=cy-oy;float dist=sqrt(dx*dx+dy*dy);
    inten=0.5+0.5*sin(dist*(6.2831853/u_wavelength)-mod(u_t*u_speed*3.0,6.2831853));
  }else if(u_effect==1){ // noise — random per-cell flicker
    float frame=floor(u_t*12.0*u_speed);
    inten=0.55+(hash(vec3(cx,cy,frame+u_seed))-0.5);
  }else if(u_effect==2){ // scan — a band sweeps down, wrapping
    float r=cy/max(u_grid.y-1.0,1.0);
    float pos=fract(u_t*u_speed*0.24);
    float d=abs(r-pos);d=min(d,1.0-d);
    inten=smoothstep(0.18,0.0,d);
  }else if(u_effect==3){ // plasma — interfering sine fields drift
    float s=u_t*u_speed*1.8;
    float v=sin(cx*0.3+s)+sin(cy*0.25-s*0.8)+sin((cx+cy)*0.2+s*0.6)+sin(sqrt(cx*cx+cy*cy)*0.25+s);
    inten=v*0.25*0.5+0.5;
  }else if(u_effect==4){ // rain — per-column density falls downward
    float cseed=hash(vec3(cx,0.0,u_seed));
    float r=cy/max(u_grid.y-1.0,1.0);
    float head=fract(u_t*u_speed*0.18*(0.6+cseed)+cseed);
    inten=pow(1.0-fract(head-r),6.0);
  }else{ // pulse — whole field breathes up/down
    inten=0.55+0.45*sin(mod(u_t*u_speed*3.0,6.2831853));
  }
  // u_gain scales overall density (average + max coverage).
  inten*=u_gain;
  // Discrete density level 0..4 = the shade-block step (' ░▒▓█').
  float level=min(4.0,floor(clamp(inten,0.0,1.0)*5.0));
  float fillRatio=level*0.25;
  // Sub-cell 2×2 ordered dither — exactly the ░ (1/4) ▒ (2/4) ▓ (3/4) █ (4/4)
  // glyph patterns, so each block reads as a console shade character.
  int sidx=int(fract(rowf)*2.0)*2+int(fract(colf)*2.0);
  float sth=sidx==0?0.125:sidx==1?0.625:sidx==2?0.875:0.375;
  float on=fillRatio>sth?1.0:0.0;
  gl_FragColor=vec4(u_color,on*u_alpha);
}`;

const EFFECT_CODE: Record<EffectName, number> = {
  ripple: 0,
  noise: 1,
  scan: 2,
  plasma: 3,
  rain: 4,
  pulse: 5,
};

export interface FillFrame extends EffectOptions {
  cols: number;
  rows: number;
  cellW: number;
  cellH: number;
  /** Seconds since start. */
  t: number;
  /** Animation speed multiplier (1 = normal). Default 1. */
  speed?: number;
  /** Overall density gain — scales coverage. Default 1. */
  density?: number;
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
  const gl = canvas.getContext("webgl", { alpha: true, antialias: false });
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
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); // straight alpha

  const u = (name: string) => gl.getUniformLocation(prog, name);
  const U = {
    res: u("u_res"),
    cell: u("u_cell"),
    grid: u("u_grid"),
    t: u("u_t"),
    effect: u("u_effect"),
    speed: u("u_speed"),
    wavelength: u("u_wavelength"),
    gain: u("u_gain"),
    seed: u("u_seed"),
    color: u("u_color"),
    alpha: u("u_alpha"),
  };

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
      gl.uniform1f(U.speed, f.speed ?? 1);
      gl.uniform1f(U.wavelength, f.wavelength ?? 11);
      gl.uniform1f(U.gain, f.density ?? 1);
      gl.uniform1f(U.seed, f.seed ?? 1);
      gl.uniform3f(U.color, r, g, b);
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
