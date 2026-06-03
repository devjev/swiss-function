import { useRender } from "@base-ui/react/use-render";
import type { CSSProperties, HTMLAttributes } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import styles from "./Skeleton.module.css";

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
  { shape = "rect", width, height, size, render, className, style, ...rest },
  ref,
) {
  const resolvedWidth = toSize(size ?? width);
  const resolvedHeight = toSize(size ?? height);

  const computedStyle: CSSProperties = {};
  if (resolvedWidth !== undefined) computedStyle.width = resolvedWidth;
  if (resolvedHeight !== undefined) computedStyle.height = resolvedHeight;

  return useRender({
    render: render ?? <div />,
    props: {
      "aria-hidden": "true",
      ...rest,
      ref,
      className: cx(styles.root, shapeClass[shape], className),
      style: { ...computedStyle, ...style },
    },
  });
});
