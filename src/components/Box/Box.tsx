import { useRender } from "@base-ui/react/use-render";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import styles from "./Box.module.css";

export type BoxElevation = 0 | 1 | 2 | 3 | 4 | 5;

export interface BoxProps extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Shadow depth, 0 (flat) to 5 (very far). Default 0. */
  elevation?: BoxElevation;
  /** Subtle monochrome noise overlay (mix-blend-mode: multiply, very low
   *  opacity). Default false. */
  texture?: boolean;
  /** Padding in --sf-unit multiples. Number → `calc(unit × N)`; string → raw.
   *  Default 1 unit. */
  padding?: number | string;
  /** Base UI render prop. Defaults to `<div />`. */
  render?: useRender.RenderProp<HTMLAttributes<HTMLElement>>;
  children?: ReactNode;
}

function toPadding(value: number | string): string {
  return typeof value === "number" ? `calc(var(--sf-unit) * ${value})` : value;
}

export const Box = forwardRef<HTMLElement, BoxProps>(function Box(props, ref) {
  const { elevation = 0, texture = false, padding = 1, render, className, style, ...rest } = props;

  const computedStyle: CSSProperties = { padding: toPadding(padding), ...style };

  return useRender({
    render: render ?? <div />,
    props: {
      ...rest,
      ref,
      className: cx(styles.root, className),
      style: computedStyle,
      "data-elevation": elevation,
      "data-texture": texture || undefined,
    },
  });
});
