import { useRender } from "@base-ui/react/use-render";
import type { CSSProperties, HTMLAttributes, Ref } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import { type EffectName, type EffectOptions, useDitheredFill } from "../../lib/effects";
import styles from "./Skeleton.module.css";

export type { EffectName };
export type SkeletonShape = "rect" | "circle" | "pill";

export interface SkeletonProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Visual shape. Default `"rect"` is a sharp-cornered block. `"circle"` and `"pill"` round it. */
  shape?: SkeletonShape;
  /** `number` → multiples of `--sf-unit`; `string` → raw CSS. Default fills container. */
  width?: number | string;
  /** `number` → multiples of `--sf-unit`; `string` → raw CSS. Default = 1 unit (one leading line). */
  height?: number | string;
  /** Shorthand for `width=height=size` — useful for circles and square placeholders. */
  size?: number | string;
  /** Use a NonIdealState-style dithered effect instead of the shimmer sweep.
   *  Omit for the default shimmer. */
  effect?: EffectName;
  /** Effect animation speed multiplier (only with `effect`). */
  speed?: number;
  /** Effect coverage density (only with `effect`). Default 0.6. */
  density?: number;
  /** Shade-block size in px (only with `effect`). */
  cellSize?: number;
  /** Advanced effect tuning (only with `effect`). */
  effectOptions?: EffectOptions;
  /** Base UI render prop. Defaults to `<div />`. */
  render?: useRender.RenderProp<HTMLAttributes<HTMLElement>>;
}

function toSize(value: number | string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "number" ? `calc(var(--sf-unit) * ${value})` : value;
}

const shapeClass: Record<SkeletonShape, string | undefined> = {
  rect: undefined,
  circle: styles.shapeCircle,
  pill: styles.shapePill,
};

export const Skeleton = forwardRef<HTMLElement, SkeletonProps>(function Skeleton(
  {
    shape = "rect",
    width,
    height,
    size,
    effect,
    speed,
    density,
    cellSize,
    effectOptions,
    render,
    className,
    style,
    ...rest
  },
  ref,
) {
  const resolvedWidth = toSize(size ?? width);
  const resolvedHeight = toSize(size ?? height);

  const computedStyle: CSSProperties = {};
  if (resolvedWidth !== undefined) computedStyle.width = resolvedWidth;
  if (resolvedHeight !== undefined) computedStyle.height = resolvedHeight;

  // The effect engine is shared with NonIdealState. It's inert without a canvas
  // (no `effect` ⇒ no canvas ⇒ shimmer only), so the hook can run unconditionally.
  const { rootRef, canvasRef } = useDitheredFill({
    effect: effect ?? "noise",
    speed,
    density,
    cellSize,
    effectOptions,
  });

  const setRefs = (node: HTMLElement | null) => {
    // Only feed the measurement ref when an effect is active.
    if (effect) rootRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as { current: HTMLElement | null }).current = node;
  };

  return useRender({
    render: render ?? <div />,
    props: {
      "aria-hidden": "true",
      ...rest,
      ref: setRefs as Ref<HTMLElement>,
      "data-effect": effect ? "" : undefined,
      className: cx(styles.root, shapeClass[shape], className),
      style: { ...computedStyle, ...style },
      children: effect ? (
        // biome-ignore lint/a11y/noAriaHiddenOnFocusable: decorative fill canvas, no focusable content
        <canvas ref={canvasRef} aria-hidden="true" className={styles.fill} />
      ) : undefined,
    },
  });
});
