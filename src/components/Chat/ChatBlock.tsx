import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import styles from "./ChatBlock.module.css";

/** How much shell the block brings. `"framed"` is the TUI panel; `"plain"` is a
 *  bare block box that imposes no frame, surface, padding or letterforms, so a
 *  custom part can look like itself. */
export type ChatBlockVariant = "framed" | "plain";

export interface ChatBlockProps extends HTMLAttributes<HTMLDivElement> {
  /** Label above the body: a title bar with a marker when framed, one dim line
   *  when plain. Omit it and there is no label at all. */
  title?: string;
  /** Default `"framed"`. */
  variant?: ChatBlockVariant;
  children: ReactNode;
}

/** A terminal-style framed panel: hairline border, faint surface, monospace,
 *  sharp corners, a dim title bar. The built-in chat blocks (choices, tree) use
 *  it; wrap custom `renderPart` blocks in it to match the TUI aesthetic, or pass
 *  `variant="plain"` for a block that brings no look of its own. */
export const ChatBlock = forwardRef<HTMLDivElement, ChatBlockProps>(function ChatBlock(
  { title, variant = "framed", children, className, ...rest },
  ref,
) {
  const plain = variant === "plain";
  return (
    <div ref={ref} {...rest} className={cx(plain ? styles.plain : styles.root, className)}>
      {title ? <span className={plain ? styles.plainTitle : styles.title}>{title}</span> : null}
      {/* Plain adds no body wrapper: one block box and the consumer's own markup. */}
      {plain ? children : <div className={styles.body}>{children}</div>}
    </div>
  );
});
