import { Slider as BaseSlider } from "@base-ui/react/slider";
import type {
  CSSProperties,
  HTMLAttributes,
  ReactNode,
  PointerEvent as ReactPointerEvent,
} from "react";
import { forwardRef, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { cx, mergeClassName } from "../../lib/cx";
import type { ControlSurface } from "../../lib/surface";
import { curveStyle, surfaceClass } from "../../lib/surface";
import type { BoxElevation } from "../Box";
import { resolveMarks, type SliderMarks } from "../Slider/Slider.math";
import {
  angleToValue,
  arcPath,
  DEFAULT_SWEEP,
  pointerAngle,
  polar,
  snapToStep,
  valueToAngle,
} from "./Knob.math";
import styles from "./Knob.module.css";

/** Semantic accent colour of the arc, mirroring `Slider`/`Progress`/`Chip`. */
export type KnobTone = "neutral" | "primary" | "success" | "warning" | "danger";

/** How the value arc is painted. `"none"` hides it, leaving the pointer alone. */
export type KnobFill = "color" | "dither" | "none";

/** The pointer model: the value follows the pointer's angle around the dial
 *  (`"rotate"`, the physical grip), or a vertical drag turns it (`"vertical"`,
 *  the mixing-console convention: up raises, Shift for fine adjustment). */
export type KnobDrag = "rotate" | "vertical";

/** The machined finish of the cylinder: a knurled grip on the side wall and a
 *  spun face, or a plain turned surface. */
export type KnobFinish = "knurled" | "plain";

export interface KnobProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "color" | "defaultValue" | "onChange"> {
  /** Controlled value. */
  value?: number;
  /** Uncontrolled initial value. Defaults to `min`. */
  defaultValue?: number;
  /** Fired live as the value changes (drag, keyboard, wheel). */
  onValueChange?: (value: number) => void;
  /** Fired once at the end of a drag, and after a keyboard change. */
  onValueCommitted?: (value: number) => void;
  /** Range floor. Default `0`. */
  min?: number;
  /** Range ceiling. Default `100`. */
  max?: number;
  /** Step increment. Default `1`. */
  step?: number;
  /** Step for PageUp/PageDown, Shift+Arrow and Shift+wheel. Default `10`. */
  largeStep?: number;
  /** Ignore user interaction. */
  disabled?: boolean;
  /** Form field name (submits the value). */
  name?: string;
  /** Id of the form the knob belongs to. */
  form?: string;
  /** Intl formatting for the readout / aria text. */
  format?: Intl.NumberFormatOptions;
  /** Locale for `format`. Defaults to the runtime locale. */
  locale?: Intl.LocalesArgument;
  /** Cap diameter on the `--sf-unit` grid: `sm` 1.5u, `md` 2u, `lg` 3u.
   *  Default `"md"`. */
  size?: "sm" | "md" | "lg";
  /** Explicit cap diameter in `--sf-unit` multiples; wins over `size`. */
  diameter?: number;
  /** Angular travel in degrees, centred on 12 o'clock. Default `270` (stops at
   *  7 and 5 o'clock). */
  sweep?: number;
  /** Semantic accent colour of the value arc. Default `"primary"`. */
  tone?: KnobTone;
  /** Explicit accent colour (any CSS colour / `--sf-*` token); wins over `tone`. */
  color?: string;
  /** How the value arc is painted: a solid colour, the house halftone dither,
   *  or `"none"`. Default `"color"`. */
  fill?: KnobFill;
  /** Where the arc grows from: the left stop (`"start"`, a level) or 12 o'clock
   *  (`"center"`, a bipolar control such as balance or pan). Default `"start"`. */
  fillOrigin?: "start" | "center";
  /** Resting depth of the knob on the `--sf-elevation-N` scale (as Box/Slider).
   *  Default `2`. */
  elevation?: BoxElevation;
  /** The face of the cap: `"dome"` (default, a turned cap crowned toward the
   *  light), `"dish"` a scooped top, `"flat"` a plain top. */
  surface?: ControlSurface;
  /** Amplitude of the face ramp as a multiple of the system `--sf-curve`. A knob
   *  is a taller object than a key, so it reads at `1.5` by default. */
  curve?: number;
  /** The machined finish. Default `"knurled"`. */
  finish?: KnobFinish;
  /** Ticks around the dial: `true` for one per step (capped), or an array of
   *  values / `{ value, label }`. Labels sit outside the ticks. */
  marks?: SliderMarks;
  /** The mono value readout under the dial. `"hover"` reveals it on hover,
   *  drag and keyboard focus (default), `"always"` pins it, `"off"` hides it. */
  valueLabel?: "hover" | "always" | "off";
  /** Formats the readout and tick labels. Default: the raw number (or `format`). */
  formatValue?: (value: number) => ReactNode;
  /** The pointer model. Default `"rotate"`. */
  drag?: KnobDrag;
  /** Turn the knob with the mouse wheel over the dial (opt-in: it captures the
   *  wheel from the page). Default `false`. */
  wheel?: boolean;
}

/* --- Geometry, in --sf-unit multiples around the cap's edge --- */
const CAP_UNITS: Record<NonNullable<KnobProps["size"]>, number> = { sm: 1.5, md: 2, lg: 3 };
/** The cylinder's visible height (the side wall below the cap), in px. */
const HEIGHT_PX: Record<NonNullable<KnobProps["size"]>, number> = { sm: 2, md: 3, lg: 4 };
const WELL_GAP = 0.1;
const WELL_WIDTH = 0.3;
const TICK_IN = 0.5;
const TICK_LENGTH = 0.2;
const LABEL_RADIUS = 1.05;
const RING_PLAIN = 0.75;
const RING_LABELS = 1.35;
/** Vertical drag: the pixels of travel that cover the whole range. */
const VERTICAL_TRAVEL_PX = 160;

interface DragState {
  pointerId: number;
  lastY: number;
  /** The unsnapped running value of a vertical drag, so fine steps accumulate. */
  acc: number;
}

/**
 * A rotary control: the round sibling of `Slider`, a volume knob on a hi-fi
 * front panel. A machined cylinder (a domed cap over a knurled side wall, lit
 * by the material layer's one light) turns in a recessed sector well that holds
 * the accent value arc; ticks and labels are printed on the panel around it.
 * Wraps Base UI Slider for accessibility (`role="slider"`, the aria value
 * attributes, keyboard control, `Field` labelling, form submission) and adds
 * its own angular pointer model.
 *
 * Drops into `Field` for a labelled control. For a dragged value along a track
 * reach for `Slider`; for a typed number, `DigitInput` / `DigitInputMicro`.
 */
export const Knob = forwardRef<HTMLDivElement, KnobProps>(function Knob(
  {
    value,
    defaultValue,
    onValueChange,
    onValueCommitted,
    min = 0,
    max = 100,
    step = 1,
    largeStep = 10,
    disabled,
    name,
    form,
    format,
    locale,
    size = "md",
    diameter,
    sweep = DEFAULT_SWEEP,
    tone = "primary",
    color,
    fill = "color",
    fillOrigin = "start",
    elevation,
    surface = "dome",
    curve,
    finish = "knurled",
    marks,
    valueLabel = "hover",
    formatValue,
    drag = "rotate",
    wheel = false,
    "aria-label": ariaLabel,
    className,
    style,
    ...rest
  },
  ref,
) {
  const isControlled = value !== undefined;
  const [inner, setInner] = useState(() => snapToStep(defaultValue ?? min, min, max, step));
  const current = isControlled ? value : inner;

  // The latest value for pointer handlers, which outlive a render.
  const latestRef = useRef(current);
  latestRef.current = current;
  const onValueChangeRef = useRef(onValueChange);
  onValueChangeRef.current = onValueChange;

  const commit = (next: number) => {
    if (next === latestRef.current) return;
    latestRef.current = next;
    if (!isControlled) setInner(next);
    onValueChangeRef.current?.(next);
  };

  /* --- Measure the dial so the SVG scale draws in px (1px ticks, a 4px dither). --- */
  const dialRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [box, setBox] = useState(0);
  useLayoutEffect(() => {
    const el = dialRef.current;
    if (!el) return;
    setBox(el.getBoundingClientRect().width);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry) setBox(entry.contentRect.width);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* --- Pointer model --- */
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);

  const applyRotate = (e: ReactPointerEvent) => {
    const el = dialRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const angle = pointerAngle(
      e.clientX - (rect.left + rect.width / 2),
      e.clientY - (rect.top + rect.height / 2),
    );
    commit(angleToValue(angle, min, max, sweep, step));
  };

  const applyVertical = (e: ReactPointerEvent, d: DragState) => {
    const fine = e.shiftKey ? 0.25 : 1;
    d.acc -= ((e.clientY - d.lastY) / VERTICAL_TRAVEL_PX) * (max - min) * fine;
    d.acc = Math.min(max, Math.max(min, d.acc));
    d.lastY = e.clientY;
    commit(snapToStep(d.acc, min, max, step));
  };

  const endDrag = (e: ReactPointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    const el = dialRef.current;
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    onValueCommitted?.(latestRef.current);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (disabled || e.button !== 0 || dragRef.current) return;
    const el = dialRef.current;
    if (!el) return;
    // Keep the browser from selecting text / focusing the dial itself; the
    // range input takes focus so the keyboard carries on where the drag ends.
    e.preventDefault();
    inputRef.current?.focus({ preventScroll: true });
    el.setPointerCapture(e.pointerId);
    dragRef.current = { pointerId: e.pointerId, lastY: e.clientY, acc: latestRef.current };
    setDragging(true);
    if (drag === "rotate") applyRotate(e);
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    // A pointerup swallowed elsewhere leaves `buttons` at 0: end the drag.
    if (e.buttons === 0) {
      endDrag(e);
      return;
    }
    if (drag === "rotate") applyRotate(e);
    else applyVertical(e, d);
  };

  /* --- Wheel (opt-in): a native non-passive listener, so it can take the wheel
     from the page; React's own wheel handler is passive. --- */
  useEffect(() => {
    const el = dialRef.current;
    if (!wheel || !el) return;
    const onWheel = (e: WheelEvent) => {
      if (disabled || e.deltaY === 0) return;
      e.preventDefault();
      const direction = e.deltaY < 0 ? 1 : -1;
      const increment = e.shiftKey ? largeStep : step;
      commit(snapToStep(latestRef.current + direction * increment, min, max, step));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
    // `commit` reads refs, so the handler only depends on the range props.
    // biome-ignore lint/correctness/useExhaustiveDependencies: commit is stable through refs
  }, [wheel, disabled, min, max, step, largeStep, isControlled]);

  /* --- Geometry --- */
  const capUnits = diameter ?? CAP_UNITS[size];
  const heightPx = diameter ? Math.max(2, Math.round(diameter * 1.5)) : HEIGHT_PX[size];
  const ticks = resolveMarks(marks, min, max, step);
  const hasLabels = ticks.some((t) => t.label != null);
  const ringUnits = hasLabels ? RING_LABELS : RING_PLAIN;
  const unitPx = box > 0 ? box / (capUnits + 2 * ringUnits) : 0;
  const centre = box / 2;
  const capRadius = (capUnits / 2) * unitPx;
  const arcRadius = capRadius + (WELL_GAP + WELL_WIDTH / 2) * unitPx;
  const arcWidth = (capUnits / 16) * unitPx;
  const start = -sweep / 2;
  const angle = valueToAngle(current, min, max, sweep);
  const arcFrom = fillOrigin === "center" ? 0 : start;
  const fillPath =
    box > 0 && fill !== "none"
      ? arcPath(centre, centre, arcRadius, Math.min(arcFrom, angle), Math.max(arcFrom, angle))
      : "";
  const patternId = `${useId()}-dither`;

  const rootStyle = curveStyle(curve, {
    ...style,
    "--knob-accent": color,
    "--knob-cap": `calc(var(--sf-unit) * ${capUnits})`,
    "--knob-ring": `calc(var(--sf-unit) * ${ringUnits})`,
    "--knob-h": `${heightPx}px`,
    "--knob-angle": `${angle}deg`,
    "--knob-start": `${start}deg`,
    "--knob-sweep": `${sweep}deg`,
  } as CSSProperties);

  return (
    <BaseSlider.Root
      {...rest}
      ref={ref}
      value={current}
      onValueChange={(v) => commit(Array.isArray(v) ? (v[0] ?? min) : v)}
      onValueCommitted={(v) => onValueCommitted?.(Array.isArray(v) ? (v[0] ?? min) : v)}
      min={min}
      max={max}
      step={step}
      largeStep={largeStep}
      disabled={disabled}
      name={name}
      form={form}
      format={format}
      locale={locale}
      data-tone={tone === "neutral" ? undefined : tone}
      data-fill={fill}
      data-finish={finish}
      data-value-label={valueLabel}
      data-elevation={elevation}
      data-dragging={dragging || undefined}
      className={mergeClassName(styles.root, className)}
      style={rootStyle}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: the dial is the pointer surface of the slider input inside it */}
      <div
        ref={dialRef}
        className={styles.dial}
        data-drag={drag}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <div className={styles.well} />
        <svg
          className={styles.scale}
          width={box || undefined}
          height={box || undefined}
          aria-hidden="true"
        >
          {fill === "dither" && (
            <defs>
              <pattern id={patternId} patternUnits="userSpaceOnUse" width="4" height="4">
                <rect width="1" height="1" className={styles.ditherDot} />
                <rect x="2" y="2" width="1" height="1" className={styles.ditherDot} />
              </pattern>
            </defs>
          )}
          {box > 0 &&
            ticks.map((t) => {
              const a = start + t.position * sweep;
              const p0 = polar(centre, centre, capRadius + TICK_IN * unitPx, a);
              const p1 = polar(centre, centre, capRadius + (TICK_IN + TICK_LENGTH) * unitPx, a);
              return (
                <line
                  key={t.value}
                  className={styles.tick}
                  x1={p0.x}
                  y1={p0.y}
                  x2={p1.x}
                  y2={p1.y}
                />
              );
            })}
          {fillPath && fill === "dither" && (
            <path className={styles.fillWash} d={fillPath} strokeWidth={arcWidth} />
          )}
          {fillPath && (
            <path
              className={styles.fill}
              d={fillPath}
              strokeWidth={arcWidth}
              stroke={fill === "dither" ? `url(#${patternId})` : undefined}
            />
          )}
        </svg>
        <div className={styles.body} />
        <div className={cx(styles.cap, surfaceClass[surface])}>
          <div className={styles.hand}>
            <span className={styles.mark} />
          </div>
          {/* The slot is a point at the cap's centre; Base UI positions the thumb
              within it by percentage (of zero), so it stays centred. */}
          <div className={styles.thumbSlot}>
            <BaseSlider.Thumb
              index={0}
              className={styles.thumb}
              inputRef={inputRef}
              aria-label={ariaLabel}
            />
          </div>
        </div>
        {box > 0 &&
          hasLabels &&
          ticks.map((t) => {
            if (t.label == null) return null;
            const p = polar(
              centre,
              centre,
              capRadius + LABEL_RADIUS * unitPx,
              start + t.position * sweep,
            );
            return (
              <span
                key={t.value}
                className={styles.tickLabel}
                style={{ left: p.x, top: p.y }}
                aria-hidden="true"
              >
                {t.label}
              </span>
            );
          })}
      </div>
      {valueLabel !== "off" && (
        <BaseSlider.Value className={styles.readout}>
          {(formatted, values) => {
            const v = values[0];
            return formatValue && v != null ? formatValue(v) : formatted[0];
          }}
        </BaseSlider.Value>
      )}
    </BaseSlider.Root>
  );
});
