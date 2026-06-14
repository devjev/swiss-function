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
  }else if(u_effect==6){ // wave — undulating horizontal band (sine scroller)
    float r=cy/max(u_grid.y-1.0,1.0);
    float bandY=0.5+0.28*sin(cx*0.3-u_t*u_speed*1.5);
    inten=smoothstep(0.22,0.0,abs(r-bandY));
  }else if(u_effect==7){ // spiral — rotating arms
    float dx=cx-(u_grid.x-1.0)*0.5;float dy=cy-(u_grid.y-1.0)*0.5;
    inten=0.5+0.5*sin(atan(dy,dx)*3.0+sqrt(dx*dx+dy*dy)*0.5-u_t*u_speed*2.0);
  }else if(u_effect==8){ // radar — rotating sweep with trailing fade
    float dx=cx-(u_grid.x-1.0)*0.5;float dy=cy-(u_grid.y-1.0)*0.5;
    float a=mod(atan(dy,dx)-u_t*u_speed*1.2,6.2831853);
    inten=pow(1.0-a/6.2831853,3.0);
  }else if(u_effect==9){ // tunnel — checkerboard rushing inward
    float dx=cx-(u_grid.x-1.0)*0.5;float dy=cy-(u_grid.y-1.0)*0.5;
    float dist=sqrt(dx*dx+dy*dy)+0.5;
    inten=0.5+0.5*sin(6.0/dist+u_t*u_speed*2.0)*cos(atan(dy,dx)*6.0);
  }else if(u_effect==10){ // fire — hot flicker rising from the bottom
    float h=cy/max(u_grid.y-1.0,1.0);
    float scroll=u_t*u_speed*4.0;
    float f=hash(vec3(cx,floor(cy*0.5-scroll),u_seed));
    inten=pow(h,0.8)*(0.45+0.85*f);
  }else if(u_effect==11){ // bars — equalizer columns rising from the bottom
    float fromBottom=(u_grid.y-1.0-cy)/max(u_grid.y-1.0,1.0);
    float barH=0.5+0.5*sin(cx*0.7+u_t*u_speed*2.0+hash(vec3(cx,0.0,u_seed))*6.2831853);
    inten=fromBottom<barH?1.0:0.0;
  }else if(u_effect==12){ // metaballs — merging blobs
    float ox=(u_grid.x-1.0)*0.5;float oy=(u_grid.y-1.0)*0.5;
    float tt=u_t*u_speed*1.2;vec2 p=vec2(cx,cy);
    vec2 c1=vec2(ox+cos(tt)*ox*0.6,oy+sin(tt*1.1)*oy*0.6);
    vec2 c2=vec2(ox+cos(tt*0.8+2.0)*ox*0.6,oy+sin(tt*1.3+1.0)*oy*0.6);
    vec2 c3=vec2(ox+cos(tt*1.2+4.0)*ox*0.6,oy+sin(tt*0.7+3.0)*oy*0.6);
    float rr=oy*0.5;
    inten=0.5*(rr/(distance(p,c1)+1.0)+rr/(distance(p,c2)+1.0)+rr/(distance(p,c3)+1.0));
  }else if(u_effect==13){ // rotozoom — rotating + zooming checker
    float ox=(u_grid.x-1.0)*0.5;float oy=(u_grid.y-1.0)*0.5;float tt=u_t*u_speed;
    float ca=cos(tt),sa=sin(tt);float zoom=0.3+0.2*sin(tt*0.5);
    float qx=((cx-ox)*ca-(cy-oy)*sa)*zoom;float qy=((cx-ox)*sa+(cy-oy)*ca)*zoom;
    inten=0.5+0.5*sin(qx)*sin(qy);
  }else if(u_effect==14){ // twister — twisting vertical ribbon
    float ox=(u_grid.x-1.0)*0.5;float nx=(cx-ox)/max(ox,1.0);
    float angle=cy*0.25+u_t*u_speed*1.5;float e1=cos(angle)*0.8;float e2=cos(angle+2.2)*0.8;
    inten=step(min(e1,e2),nx)*step(nx,max(e1,e2))*(0.45+0.55*sin(angle));
  }else if(u_effect==15){ // copper — Amiga raster bars bobbing
    float r=cy/max(u_grid.y-1.0,1.0);float tt=u_t*u_speed;
    inten=smoothstep(0.13,0.0,abs(r-fract(0.5+0.32*sin(tt))))
      +smoothstep(0.11,0.0,abs(r-fract(0.5+0.42*sin(tt*0.7+2.0))))
      +smoothstep(0.09,0.0,abs(r-fract(0.5+0.5*sin(tt*1.3+4.0))));
  }else if(u_effect==16){ // voronoi — shifting flat-shaded cells (nearest of 4 moving points)
    float ox=(u_grid.x-1.0)*0.5;float oy=(u_grid.y-1.0)*0.5;float tt=u_t*u_speed*0.8;vec2 p=vec2(cx,cy);
    vec2 q0=vec2(ox+cos(tt)*ox,oy+sin(tt*1.2)*oy);
    vec2 q1=vec2(ox+cos(tt*1.3+1.5)*ox*0.8,oy+sin(tt*0.9+2.0)*oy*0.8);
    vec2 q2=vec2(ox+cos(tt*0.7+3.0)*ox*0.9,oy+sin(tt*1.1+4.0)*oy*0.6);
    vec2 q3=vec2(ox+cos(tt*1.1+5.0)*ox*0.7,oy+sin(tt*1.4+0.5)*oy*0.9);
    float d0=distance(p,q0),d1=distance(p,q1),d2=distance(p,q2),d3=distance(p,q3);
    float md=min(min(d0,d1),min(d2,d3));
    inten=md==d0?0.25:md==d1?0.5:md==d2?0.7:0.95;
  }else if(u_effect==17){ // grid — synthwave perspective floor
    float ox=(u_grid.x-1.0)*0.5;float r=cy/max(u_grid.y-1.0,1.0);float fy=r-0.5;
    if(fy<=0.0){inten=0.0;}else{
      float depth=0.35/fy;
      float horiz=pow(0.5+0.5*sin(depth+u_t*u_speed*2.0),8.0);
      float vert=pow(0.5+0.5*sin((cx-ox)/fy*0.25),8.0);
      inten=max(horiz,vert);
    }
  }else if(u_effect==18){ // kaleidoscope — folded radial symmetry
    float dx=cx-(u_grid.x-1.0)*0.5;float dy=cy-(u_grid.y-1.0)*0.5;
    float ang=atan(dy,dx);float dist=sqrt(dx*dx+dy*dy);
    ang=abs(mod(ang,1.0472)-0.5236);
    inten=0.5+0.5*sin(dist*0.35-u_t*u_speed*2.0+cos(ang*4.0)*3.0);
  }else if(u_effect==19){ // bobs — solid blobs bouncing off the walls (Amiga)
    float gx=u_grid.x;float gy=u_grid.y;vec2 p=vec2(cx,cy);float tt=u_t*u_speed;
    vec2 b1=vec2(abs(fract(tt*0.13)*2.0-1.0)*gx,abs(fract(tt*0.17+0.3)*2.0-1.0)*gy);
    vec2 b2=vec2(abs(fract(tt*0.19+0.5)*2.0-1.0)*gx,abs(fract(tt*0.11+0.7)*2.0-1.0)*gy);
    vec2 b3=vec2(abs(fract(tt*0.15+0.2)*2.0-1.0)*gx,abs(fract(tt*0.21+0.1)*2.0-1.0)*gy);
    float R=gy*0.32;
    inten=max(max(1.0-distance(p,b1)/R,1.0-distance(p,b2)/R),1.0-distance(p,b3)/R);
  }else if(u_effect==20){ // swirl — domain-warped plasma
    float dx=cx-(u_grid.x-1.0)*0.5;float dy=cy-(u_grid.y-1.0)*0.5;
    float dist=sqrt(dx*dx+dy*dy);float ang=atan(dy,dx)+dist*0.06-u_t*u_speed*0.8;
    inten=0.5+0.25*(sin(cos(ang)*dist*0.3)+sin(sin(ang)*dist*0.3));
  }else if(u_effect==21){ // helix — twin DNA strands
    float ox=(u_grid.x-1.0)*0.5;float nx=(cx-ox)/max(ox,1.0);float ph=cy*0.3-u_t*u_speed*2.0;
    inten=smoothstep(0.18,0.0,abs(nx-cos(ph)*0.7))+smoothstep(0.18,0.0,abs(nx-cos(ph+3.1416)*0.7));
  }else if(u_effect==22){ // checker — Mode-7 scrolling floor
    float ox=(u_grid.x-1.0)*0.5;float r=cy/max(u_grid.y-1.0,1.0);float fy=r-0.5;
    if(fy<=0.0){inten=0.0;}else{
      float v=sin((cx-ox)/fy*0.04*3.1416)*sin((0.4/fy+u_t*u_speed*2.0)*3.1416);
      inten=step(0.0,v);
    }
  }else if(u_effect==23){ // droplets — random ripples popping (rain on water)
    vec2 p=vec2(cx,cy);inten=0.0;
    for(int i=0;i<3;i++){
      float fi=float(i);float epoch=floor(u_t*u_speed*0.5+fi*0.33);
      vec2 dp=vec2(hash(vec3(epoch,fi,u_seed))*u_grid.x,hash(vec3(epoch,fi+7.0,u_seed))*u_grid.y);
      float age=fract(u_t*u_speed*0.5+fi*0.33);float d=distance(p,dp);
      inten+=sin(d*0.5-age*18.0)*smoothstep(1.0,0.0,age)*step(d,age*45.0);
    }
    inten=inten*0.5+0.15;
  }else{ // glitch — datamosh / broken signal: row-blocks tear and jump
    float blockRow=floor(cy/3.0);
    float epoch=floor(u_t*u_speed*5.0);
    float shift=(hash(vec3(blockRow,epoch+5.0,u_seed))-0.5)*u_grid.x*step(0.5,hash(vec3(blockRow,epoch,u_seed)));
    float gx=cx+shift;
    float stripes=0.5+0.5*sin(gx*0.6);
    float speckle=hash(vec3(floor(gx),blockRow,epoch));
    inten=mix(stripes,speckle,0.4);
    inten=max(inten,step(0.9,hash(vec3(blockRow,epoch+11.0,u_seed))));
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

// Codes match the shader's u_effect branches (5 is unused — pulse was removed).
const EFFECT_CODE: Record<EffectName, number> = {
  ripple: 0,
  noise: 1,
  scan: 2,
  plasma: 3,
  rain: 4,
  wave: 6,
  spiral: 7,
  radar: 8,
  tunnel: 9,
  fire: 10,
  bars: 11,
  metaballs: 12,
  rotozoom: 13,
  twister: 14,
  copper: 15,
  voronoi: 16,
  grid: 17,
  kaleidoscope: 18,
  bobs: 19,
  swirl: 20,
  helix: 21,
  checker: 22,
  droplets: 23,
  glitch: 24,
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
