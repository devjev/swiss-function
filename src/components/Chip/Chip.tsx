import type { HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import styles from "./Chip.module.css";

/** Neutral is the resting default; the semantic tones tint the chip only when
 *  the colour carries meaning (status, priority) — not for decoration. */
export type ChipTone = "neutral" | "primary" | "success" | "warning" | "danger";
export type ChipSize = "sm" | "md";

export interface ChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** Semantic colour. Default `"neutral"`. Reach for a tone only when the colour
   *  itself is information (a `danger` status, a `success` state) — a wall of
   *  differently-coloured chips with no meaning is the anti-pattern. */
  tone?: ChipTone;
  /** `"md"` (default, 1.25u tall) or `"sm"` (1u — aligns with a small Button). */
  size?: ChipSize;
  /** Pill form (`radius-full`) instead of the sharp 2px default. Sanctioned for
   *  the tag/badge reading; leave off for filter/token chips in dense UI. */
  round?: boolean;
  /** Show a leading status marker tinted to the tone — a small square, or a dot
   *  when `round`. Use for status/state chips. */
  dot?: boolean;
  /** When set, renders a keyboard-reachable ✕ button. Fires on click/Enter and
   *  stops propagation, so it won't also trigger the chip's own `onClick`. */
  onRemove?: () => void;
  /** Accessible label for the remove button. Default `"Remove"`. */
  removeLabel?: string;
  /** Dims the chip and blocks interaction (both `onClick` and remove). */
  disabled?: boolean;
  children?: ReactNode;
}

const sizeClass: Record<ChipSize, string> = {
  sm: styles.sizeSm ?? "",
  md: "",
};

/** A compact token — tag, filter, status marker, or removable selection. Sharp
 *  by default; neutral unless a `tone` gives the colour meaning. Renders a
 *  `<span>`; pass `onClick` to make it an accessible button-like filter chip,
 *  and/or `onRemove` for a dismissable selection. */
export const Chip = forwardRef<HTMLSpanElement, ChipProps>(function Chip(
  {
    tone = "neutral",
    size = "md",
    round,
    dot,
    onRemove,
    removeLabel = "Remove",
    disabled,
    onClick,
    onKeyDown,
    className,
    children,
    ...rest
  },
  ref,
) {
  const interactive = onClick != null && !disabled;

  function handleKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    onKeyDown?.(event);
    // Make a clickable chip respond to Enter/Space like a button would.
    if (interactive && !event.defaultPrevented && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.currentTarget.click();
    }
  }

  function handleRemove(event: MouseEvent<HTMLButtonElement>) {
    // Don't let a remove click bubble to an interactive chip's onClick.
    event.stopPropagation();
    onRemove?.();
  }

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the span is only interactive when `onClick` is passed, and in exactly that case it gets role="button", tabIndex, and Enter/Space handling below. A plain display chip carries no click behavior.
    <span
      {...rest}
      ref={ref}
      className={cx(styles.root, sizeClass[size], className)}
      data-tone={tone === "neutral" ? undefined : tone}
      data-round={round || undefined}
      data-interactive={interactive || undefined}
      data-disabled={disabled || undefined}
      onClick={disabled ? undefined : onClick}
      onKeyDown={handleKeyDown}
      role={interactive ? "button" : rest.role}
      tabIndex={interactive ? (rest.tabIndex ?? 0) : rest.tabIndex}
      aria-disabled={disabled || undefined}
    >
      {dot ? <span className={styles.dot} aria-hidden="true" /> : null}
      <span className={styles.label}>{children}</span>
      {onRemove ? (
        <button
          type="button"
          className={styles.remove}
          onClick={handleRemove}
          disabled={disabled}
          aria-label={removeLabel}
        >
          <svg viewBox="0 0 12 12" aria-hidden="true" focusable="false">
            <path
              d="M3 3 9 9 M9 3 3 9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="square"
              fill="none"
            />
          </svg>
        </button>
      ) : null}
    </span>
  );
});
