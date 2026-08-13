import type { ComponentType } from "react";
import type { IconRenderer, IconRenderProps } from "../../lib/icons";

/** The prop surface an external icon (Feather, Lucide, Tabler, ...) accepts.
 *  All of these libraries render an `<svg>` from `React.SVGProps`, so `width` /
 *  `height` / `strokeWidth` / `className` and the a11y attributes below all
 *  apply. Kept deliberately narrow (and with the exact literal types we pass) so
 *  a real library component is assignable without a cast. */
interface ExternalIconProps {
  width?: number | string;
  height?: number | string;
  strokeWidth?: number | string;
  className?: string;
  role?: "img";
  "aria-label"?: string;
  "aria-hidden"?: true;
}

type ExternalIcon = ComponentType<ExternalIconProps>;

/**
 * Wrap an external-library icon so it satisfies the library's icon contract and
 * can be handed to `IconProvider` for any slot.
 *
 * Size is normalized to the `--sf-unit` grid exactly as `Icon.tsx` does (a
 * number becomes `calc(n * var(--sf-unit))`, a string passes through, default
 * `"1em"`), forcing `width` / `height` onto the external `24×24` svg so it
 * occupies the same box as a bespoke glyph. Accessibility matches the primitive:
 * a `label` gives `role="img"` + `aria-label`, its absence gives `aria-hidden`.
 * Caps and stroke weight stay the external library's own; that is the point of
 * swapping.
 */
export function iconAdapter(External: ExternalIcon): IconRenderer {
  return function AdaptedIcon({ size = "1em", label, strokeWidth, className }: IconRenderProps) {
    const dimension = typeof size === "number" ? `calc(${size} * var(--sf-unit))` : size;
    return (
      <External
        width={dimension}
        height={dimension}
        strokeWidth={strokeWidth}
        className={className}
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
      />
    );
  };
}
