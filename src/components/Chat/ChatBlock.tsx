import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef, useContext } from "react";
import { cx } from "../../lib/cx";
import styles from "./ChatBlock.module.css";
import { ChatVariantContext } from "./ChatExpand";

/** How much shell the block brings. `"band"` is a terminal's block: a
 *  full-width band with a bracketed label, no border. `"framed"` is a ruled
 *  panel with a title bar. `"plain"` is a bare block box that imposes no
 *  surface, padding or letterforms, so a custom part can look like itself. */
export type ChatBlockVariant = "band" | "framed" | "plain";

export interface ChatBlockProps extends HTMLAttributes<HTMLDivElement> {
  /** Label above the body: `[title]` on a band, a title bar when framed, one
   *  plain line when plain. Omit it and there is no label at all. */
  title?: string;
  /** Default `"band"`. */
  variant?: ChatBlockVariant;
  children: ReactNode;
}

const ROOT: Record<ChatBlockVariant, string | undefined> = {
  band: styles.band,
  framed: styles.root,
  plain: styles.plain,
};

const TITLE: Record<ChatBlockVariant, string | undefined> = {
  band: styles.bandTitle,
  framed: styles.title,
  plain: styles.plainTitle,
};

/** The shell of a block in a chat transcript. The built-in blocks (choices,
 *  tree) use the band; wrap a custom `renderPart` block in it to match them,
 *  pass `variant="framed"` for a ruled panel, or `variant="plain"` for a block
 *  that brings no look of its own. Inside a `Chat` a band runs the full width
 *  of the transcript, as a terminal's block does. */
export const ChatBlock = forwardRef<HTMLDivElement, ChatBlockProps>(function ChatBlock(
  { title, variant = "band", children, className, ...rest },
  ref,
) {
  // In a chat's log view a band has no surface: the label and the content sit
  // in the reply's column.
  const log = useContext(ChatVariantContext) === "log";
  return (
    <div
      ref={ref}
      {...rest}
      data-variant={variant}
      data-log={log || undefined}
      className={cx(ROOT[variant], className)}
    >
      {title ? (
        <span className={TITLE[variant]}>{variant === "band" ? `[${title}]` : title}</span>
      ) : null}
      {/* Plain and band add no body wrapper: one block box and the consumer's
          own markup. */}
      {variant === "framed" ? <div className={styles.body}>{children}</div> : children}
    </div>
  );
});
