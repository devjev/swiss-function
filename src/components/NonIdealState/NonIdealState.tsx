import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import { GLYPHS, type NonIdealStateVariant } from "./glyphs";
import styles from "./NonIdealState.module.css";

export type { NonIdealStateVariant };

export interface NonIdealStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Which state this represents. Picks the block-art glyph + a11y semantics.
   *  Default `"empty"`. */
  variant?: NonIdealStateVariant;
  /** Headline — what's missing / what happened. */
  title?: ReactNode;
  /** Secondary line — what to do about it (how to fill it, what to try). */
  description?: ReactNode;
  /** Action slot — typically a `Button`. */
  action?: ReactNode;
  /** Override the block-art glyph. Pass a list of equal-width rows, or any
   *  node, or `null`/`false` to hide it. Defaults to the variant's glyph. */
  glyph?: string[] | ReactNode;
}

const variantClass: Record<NonIdealStateVariant, string | undefined> = {
  empty: undefined,
  "no-results": undefined,
  error: styles.error,
  loading: styles.loading,
};

/** A non-ideal state — empty, no-results, error, or loading — rendered with a
 *  console-style dithered block-art emblem above an informative message. */
export const NonIdealState = forwardRef<HTMLDivElement, NonIdealStateProps>(function NonIdealState(
  { variant = "empty", title, description, action, glyph, className, ...rest },
  ref,
) {
  const resolvedGlyph = glyph === undefined ? GLYPHS[variant] : glyph;
  // Loading announces politely + marks busy; an error is assertive.
  const role = variant === "loading" ? "status" : variant === "error" ? "alert" : undefined;

  return (
    <div
      ref={ref}
      role={role}
      aria-busy={variant === "loading" || undefined}
      className={cx(styles.root, variantClass[variant], className)}
      {...rest}
    >
      {resolvedGlyph ? (
        <pre aria-hidden="true" className={styles.glyph}>
          {Array.isArray(resolvedGlyph) ? resolvedGlyph.join("\n") : resolvedGlyph}
        </pre>
      ) : null}
      {title != null && <p className={styles.title}>{title}</p>}
      {description != null && <p className={styles.description}>{description}</p>}
      {action != null && <div className={styles.action}>{action}</div>}
    </div>
  );
});
