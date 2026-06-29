import { useEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { Spinner } from "../Spinner";
import { ChatBlock } from "./ChatBlock";
import styles from "./ChatThinking.module.css";
import { type ChatStepStatus, ChatTree, type ChatTreeNode } from "./ChatTree";

export interface ChatThinkingProps {
  /** Run state of the orchestration. */
  status: "running" | "done" | "error";
  /** Header text while running / on error. Default "Thinking…" / "Failed". */
  label?: string;
  /** The fan-out — status-annotated tree nodes. Grows as agents spawn. */
  steps?: ChatTreeNode[];
  /** Collapsed-line text when done. Default `Ran N steps`. */
  summary?: string;
  /** Force the initial expand state (otherwise: expanded unless `done`). */
  defaultExpanded?: boolean;
  /** Fired with a step node's id when clicked. */
  onSelect?: (id: string) => void;
}

function countLeaves(nodes?: ChatTreeNode[]): number {
  if (!nodes?.length) return 0;
  let n = 0;
  for (const node of nodes) {
    n += node.children?.length ? countLeaves(node.children) : 1;
  }
  return n;
}

const openByDefault = (status: ChatStepStatus | ChatThinkingProps["status"]) => status !== "done";

/**
 * The assistant "thinking" block: a spinner header that expands into a live
 * orchestration fan-out (a status tree). Auto-expanded while running; collapses
 * to a one-line summary when done (click the header to re-expand).
 */
export function ChatThinking({
  status,
  label,
  steps,
  summary,
  defaultExpanded,
  onSelect,
}: ChatThinkingProps) {
  const hasSteps = !!steps?.length;
  const [open, setOpen] = useState(defaultExpanded ?? openByDefault(status));
  const overridden = useRef(false);
  const prevStatus = useRef(status);

  // Auto-collapse when the run finishes (unless the user has toggled it or
  // `defaultExpanded` is pinned).
  useEffect(() => {
    if (prevStatus.current === status) return;
    prevStatus.current = status;
    if (!overridden.current && defaultExpanded === undefined) setOpen(openByDefault(status));
  }, [status, defaultExpanded]);

  const toggle = () => {
    overridden.current = true;
    setOpen((o) => !o);
  };

  const headerText =
    status === "done"
      ? (summary ?? `Ran ${countLeaves(steps)} steps`)
      : status === "error"
        ? (label ?? "Failed")
        : (label ?? "Thinking…");

  const indicator =
    status === "running" ? (
      <Spinner variant="blocks" color="var(--sf-color-primary)" label="Thinking" />
    ) : (
      <span
        className={cx(styles.glyph, status === "done" ? styles.done : styles.error)}
        aria-hidden="true"
      >
        {status === "done" ? "✓" : "✗"}
      </span>
    );

  const content = (
    <>
      {hasSteps ? (
        <button
          type="button"
          className={styles.header}
          onClick={toggle}
          aria-expanded={open}
          aria-label={open ? "Collapse steps" : "Expand steps"}
        >
          <span className={styles.chevron} data-open={open || undefined} aria-hidden="true">
            ▸
          </span>
          {indicator}
          <span className={styles.text}>{headerText}</span>
        </button>
      ) : (
        <div className={styles.header} data-static="">
          {indicator}
          <span className={styles.text}>{headerText}</span>
        </div>
      )}
      {hasSteps ? (
        // Always mounted so the height can transition (grid-rows 0fr↔1fr);
        // `inert` keeps the collapsed fan-out out of the tab/accessibility tree.
        <div
          className={styles.bodyWrap}
          data-open={open || undefined}
          inert={open ? undefined : true}
        >
          <div className={styles.body}>
            <div className={styles.bodyInner}>
              <ChatTree title={null} roots={steps ?? []} onSelect={onSelect} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  return <ChatBlock>{content}</ChatBlock>;
}
