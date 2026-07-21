import type { CSSProperties } from "react";
import { forwardRef, useCallback, useEffect, useRef } from "react";
import {
  channelsToSrgb,
  clipSrgb,
  inSpectralLocus,
  parse,
  SPECTRAL_LOCUS,
  SRGB_PRIMARIES,
  SRGB_WHITE,
  srgbToHex,
  xyOf,
  xyToDisplaySrgb,
} from "../../lib/color";
import { cx } from "../../lib/cx";
import { mergeRefs } from "../../lib/mergeRefs";
import { usePointerDrag } from "../../lib/usePointerDrag";
import styles from "./ColorPicker.module.css";

export interface ChromaticityDiagramProps {
  /** The colour to mark — any CSS colour string. */
  color?: string;
  /** Pre-computed CIE 1931 xy of the mark (wins over `color` for the position;
   *  ColorPicker passes this so wide-gamut colours plot unclamped). */
  xy?: [number, number] | null;
  /** Explicit dot fill (a displayable CSS colour); defaults from `color`. */
  dotColor?: string;
  /** Draw the sRGB gamut triangle + white point. Default `true`. */
  gamut?: boolean;
  /** Paint the diagram with the chromaticity colours (a canvas fill). `false`
   *  keeps it pure line-art. Default `true`. */
  fill?: boolean;
  /** When set, the diagram is interactive: click/drag reports the CIE xy under
   *  the pointer (`done` is `true` on release). `ColorPicker` maps it to a
   *  colour. Points outside the horseshoe are ignored. */
  onPick?: (xy: [number, number], done: boolean) => void;
  className?: string;
  style?: CSSProperties;
}

// Plot both axes over [0, 0.8] in a padded 100×100 space (aspect-preserved).
const PAD = 7;
const DOM = 0.8;
const S = 100 - 2 * PAD;
const px = (x: number) => PAD + (x / DOM) * S;
const py = (y: number) => 100 - PAD - (y / DOM) * S;
const pt = (p: readonly [number, number]) => `${px(p[0]).toFixed(2)},${py(p[1]).toFixed(2)}`;

const LOCUS = SPECTRAL_LOCUS.map(pt).join(" ");
const TRIANGLE = SRGB_PRIMARIES.map(pt).join(" ");
const WX = px(SRGB_WHITE[0]);
const WY = py(SRGB_WHITE[1]);

// Canvas fill resolution (internal; CSS scales it to fit). The fill never changes
// with the current colour, so it's painted once.
const RES = 240;

function paintFill(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = ctx.createImageData(RES, RES);
  const data = img.data;
  for (let j = 0; j < RES; j++) {
    const y = ((100 - PAD - (j / RES) * 100) / S) * DOM; // inverse of py()
    for (let i = 0; i < RES; i++) {
      const k = (j * RES + i) * 4;
      const x = (((i / RES) * 100 - PAD) / S) * DOM; // inverse of px()
      if (x < 0 || y < 0 || !inSpectralLocus(x, y)) {
        data[k + 3] = 0;
        continue;
      }
      const [r, g, b] = xyToDisplaySrgb(x, y);
      data[k] = Math.round(r * 255);
      data[k + 1] = Math.round(g * 255);
      data[k + 2] = Math.round(b * 255);
      data[k + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}

/**
 * A CIE 1931 chromaticity diagram: the spectral-locus "horseshoe" (optionally
 * filled with the chromaticity colours, Photoshop-style), the sRGB gamut as a
 * triangle, the white point, and a dot at the current colour. A colour outside
 * the triangle is outside sRGB. Give it `color` (a CSS string) standalone, or
 * `xy` + `dotColor` (as `ColorPicker` does).
 */
export const ChromaticityDiagram = forwardRef<HTMLDivElement, ChromaticityDiagramProps>(
  function ChromaticityDiagram(
    { color, xy, dotColor, gamut = true, fill = true, onPick, className, style },
    ref,
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const rootRef = useRef<HTMLDivElement>(null);
    const rectRef = useRef<DOMRect | null>(null);
    const lastXy = useRef<[number, number] | null>(null);
    useEffect(() => {
      if (fill && canvasRef.current) paintFill(canvasRef.current);
    }, [fill]);

    const pickAt = useCallback(
      (clientX: number, clientY: number, done: boolean) => {
        const rect = rectRef.current;
        if (!rect || rect.width === 0 || !onPick) return;
        const x = ((((clientX - rect.left) / rect.width) * 100 - PAD) / S) * DOM; // inverse px()
        const y = ((100 - PAD - ((clientY - rect.top) / rect.height) * 100) / S) * DOM; // inverse py()
        if (x < 0 || y < 0 || !inSpectralLocus(x, y)) {
          if (done && lastXy.current) onPick(lastXy.current, true);
          return;
        }
        lastXy.current = [x, y];
        onPick([x, y], done);
      },
      [onPick],
    );

    const { onPointerDown } = usePointerDrag({
      onStart: (o) => {
        rectRef.current = rootRef.current?.getBoundingClientRect() ?? null;
        pickAt(o.x, o.y, false);
      },
      onMove: (d) => pickAt(d.x, d.y, false),
      onEnd: (d) => pickAt(d.x, d.y, true),
    });

    const parsed = color ? parse(color) : null;
    const pos = xy ?? (parsed ? xyOf(parsed.space, parsed.channels) : null);
    const dot =
      dotColor ??
      (parsed
        ? srgbToHex(clipSrgb(channelsToSrgb(parsed.space, parsed.channels)))
        : "var(--sf-color-fg)");

    return (
      <div
        ref={mergeRefs(rootRef, ref)}
        className={cx(styles.diagram, className)}
        style={style}
        data-filled={fill || undefined}
        data-interactive={onPick ? true : undefined}
        onPointerDown={onPick ? onPointerDown : undefined}
        role="img"
        aria-label="CIE 1931 chromaticity diagram with the current colour marked"
      >
        {fill && (
          <canvas ref={canvasRef} width={RES} height={RES} className={styles.diagramCanvas} />
        )}
        <svg viewBox="0 0 100 100" className={styles.diagramSvg} aria-hidden="true">
          <rect x={PAD} y={PAD} width={S} height={S} className={styles.diagramFrame} />
          <polygon
            points={LOCUS}
            className={cx(styles.diagramLocus, !fill && styles.diagramLocusFaint)}
          />
          {gamut && (
            <>
              <polygon points={TRIANGLE} className={styles.diagramTriangle} />
              <path
                d={`M${WX - 2.2},${WY} h4.4 M${WX},${WY - 2.2} v4.4`}
                className={styles.diagramWhite}
              />
            </>
          )}
          {pos && (
            <>
              <circle cx={px(pos[0])} cy={py(pos[1])} r={3.4} className={styles.diagramDotRing} />
              <circle
                cx={px(pos[0])}
                cy={py(pos[1])}
                r={2.6}
                fill={dot}
                className={styles.diagramDot}
              />
            </>
          )}
        </svg>
      </div>
    );
  },
);
