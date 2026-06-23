import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import styles from "./ChatBlock.module.css";

export interface ChatBlockProps extends HTMLAttributes<HTMLDivElement> {
  /** Dim label shown in the panel's title bar (e.g. "select", "tree"). */
  title?: string;
  children: ReactNode;
}

/** A terminal-style framed panel: hairline border, faint surface, monospace,
 *  sharp corners, a dim title bar. The built-in chat blocks (choices, tree) use
 *  it; wrap custom `renderPart` blocks in it to match the TUI aesthetic. */
export const ChatBlock = forwardRef<HTMLDivElement, ChatBlockProps>(function ChatBlock(
  { title, children, className, ...rest },
  ref,
) {
  return (
    <div ref={ref} {...rest} className={cx(styles.root, className)}>
      {title ? <span className={styles.title}>{title}</span> : null}
      <div className={styles.body}>{children}</div>
    </div>
  );
});
