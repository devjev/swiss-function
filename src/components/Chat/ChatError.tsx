/** ChatError: a backend error in the transcript, as a terminal prints one. One
 *  line, `Error: message`, in the danger colour behind the library's status
 *  mark (a 3px leading rule), the request id under it, and a retry key.
 *  Rendered by Chat for a `ChatErrorPart`. */

import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { hitArea } from "../../lib/hitArea";
import styles from "./ChatError.module.css";

export interface ChatErrorProps {
  /** Human-readable error message (the app parses its backend payload). */
  message: ReactNode;
  /** Optional request id / detail, shown under the message. */
  requestId?: string;
  /** Show a Retry key. */
  retryable?: boolean;
  /** Fired when Retry is pressed. */
  onRetry?: () => void;
  className?: string;
}

export function ChatError({ message, requestId, retryable, onRetry, className }: ChatErrorProps) {
  return (
    <div className={cx(styles.root, className)} role="alert">
      <div className={styles.message}>Error: {message}</div>
      {requestId ? <div className={styles.requestId}>{requestId}</div> : null}
      {retryable ? (
        <button type="button" className={cx(styles.retry, hitArea.block)} onClick={onRetry}>
          [<span className={styles.retryLabel}>Retry</span>]
        </button>
      ) : null}
    </div>
  );
}
