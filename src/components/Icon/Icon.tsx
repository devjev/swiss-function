import type { ReactNode, SVGProps } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import styles from "./Icon.module.css";

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /** Size. A **number** is a multiple of `--sf-unit` (on the grid); a string is
   *  any CSS length. Default `"1em"` — the icon tracks the surrounding text, so
   *  it lines up inside a Button or beside a label with no extra sizing. */
  size?: number | string;
  /** Accessible name. Provide it for a **standalone, meaningful** icon (renders
   *  `role="img"` + a `<title>`); omit it for a **decorative** icon beside text
   *  (renders `aria-hidden`, the default — the adjacent text carries meaning). */
  label?: string;
  /** Stroke weight in viewBox units. Default `1.5` (the library's glyph weight). */
  strokeWidth?: number;
  /** Path content for a custom icon. The bundled icons pass this for you. */
  children?: ReactNode;
}

/** The icon primitive (issue #51): a `16×16`, `currentColor`, square-capped line
 *  glyph on the `--sf-unit` grid — the Swiss/monospace posture, no fills, no
 *  colour. Use a bundled icon (`<Check />`, `<ChevronDown />`, …) or pass your
 *  own paths as `children`. */
export const Icon = forwardRef<SVGSVGElement, IconProps>(function Icon(
  { size = "1em", label, strokeWidth = 1.5, className, children, ...rest },
  ref,
) {
  const dimension = typeof size === "number" ? `calc(${size} * var(--sf-unit))` : size;
  return (
    <svg
      {...rest}
      ref={ref}
      className={cx(styles.root, className)}
      width={dimension}
      height={dimension}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      {label ? <title>{label}</title> : null}
      {children}
    </svg>
  );
});

/** Build a tree-shakeable named icon component from its path content. Each
 *  bundled icon is its own export, so a consumer's bundler drops the ones they
 *  don't import. */
export function createIcon(displayName: string, path: ReactNode) {
  const Component = forwardRef<SVGSVGElement, Omit<IconProps, "children">>(
    function IconGlyph(props, ref) {
      return (
        <Icon ref={ref} {...props}>
          {path}
        </Icon>
      );
    },
  );
  Component.displayName = displayName;
  return Component;
}

export type IconComponent = ReturnType<typeof createIcon>;
