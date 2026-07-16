/** ChatError — the in-chat error "micro-element" (issue #77): a compact
 *  NonIdealState block with the `glitch` effect as its fill, showing a short
 *  error message and an optional Retry. Rendered by Chat for a `ChatErrorPart`.
 */

import type { ReactNode } from "react";
import { cx } from "../../lib/cx";
import { Button } from "../Button";
import { NonIdealState } from "../NonIdealState";
import styles from "./ChatError.module.css";

export interface ChatErrorProps {
  /** Human-readable error message (the app parses its backend payload). */
  message: ReactNode;
  /** Optional request id / detail, shown small under the message. */
  requestId?: string;
  /** Show a Retry affordance. */
  retryable?: boolean;
  /** Fired when Retry is pressed. */
  onRetry?: () => void;
  className?: string;
}

export function ChatError({ message, requestId, retryable, onRetry, className }: ChatErrorProps) {
  return (
    <NonIdealState
      variant="error"
      effect="glitch"
      className={cx(styles.root, className)}
      width="100%"
      density={0.28}
      opacity={0.4}
      cellSize={5}
      title={<span className={styles.message}>{message}</span>}
      description={requestId ? <span className={styles.requestId}>{requestId}</span> : undefined}
      action={
        retryable ? (
          <Button size="sm" variant="secondary" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    />
  );
}
