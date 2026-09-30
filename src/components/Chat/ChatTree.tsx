import type { HTMLAttributes } from "react";
import { forwardRef } from "react";
import { cx } from "../../lib/cx";
import { Glyph } from "../../lib/icons";
import { Button } from "../Button";
import { Check, Circle, X } from "../Icon";
import { Spinner } from "../Spinner";
import { ChatBlock } from "./ChatBlock";
import styles from "./ChatTree.module.css";

/** The mark sits in a monospace row, so it rides the text a touch under 1em. */
const STEP_GLYPH_SIZE = "0.85em";

/** Per-node run state for an orchestration fan-out. */
export type ChatStepStatus = "pending" | "running" | "done" | "error";

export interface ChatTreeNode {
  id: string;
  label: string;
  children?: ChatTreeNode[];
  /** Optional run state — shows a status glyph (live spinner while `running`). */
  status?: ChatStepStatus;
}

export interface ChatTreeProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect" | "title"> {
  /** Top-level nodes (a forest). Each is printed bare; descendants get guides. */
  roots: ChatTreeNode[];
  /** Fired with the clicked node's id. */
  onSelect?: (id: string) => void;
  /** Title-bar label; pass `null` to render bare rows without the ChatBlock frame
   *  (e.g. when nested inside another block). Default `"tree"`. */
  title?: string | null;
}

interface Row {
  id: string;
  label: string;
  /** The monospace guide prefix (`│  `, `├─ `, `└─ `) preceding the label. */
  prefix: string;
  status?: ChatStepStatus;
}

/** Flatten a forest into rows carrying their box-drawing guide prefix —
 *  classic `tree(1)` output. Roots are printed bare; children accumulate the
 *  vertical guides of their ancestors. */
function buildRows(roots: ChatTreeNode[]): Row[] {
  const out: Row[] = [];
  const walk = (node: ChatTreeNode, prefix: string, connector: string) => {
    out.push({ id: node.id, label: node.label, prefix: prefix + connector, status: node.status });
    const children = node.children ?? [];
    const childPrefix = prefix + (connector === "" ? "" : connector === "└─ " ? "   " : "│  ");
    children.forEach((child, i) => {
      walk(child, childPrefix, i === children.length - 1 ? "└─ " : "├─ ");
    });
  };
  for (const root of roots) walk(root, "", "");
  return out;
}

/** Leading status indicator for a step row: a live spinner while running, else a
 *  mark from the icon set, so a consumer's `IconProvider` can swap it for their
 *  own. Omitted entirely for nodes without a status (plain trees). */
function StepStatusGlyph({ status }: { status?: ChatStepStatus }) {
  if (status == null) return null;
  if (status === "running") {
    return <Spinner variant="braille" label="Running" className={styles.statusRunning} />;
  }
  return (
    <span className={cx(styles.status, styles[status])} aria-hidden="true">
      {status === "done" ? (
        <Glyph slot="check" fallback={Check} size={STEP_GLYPH_SIZE} />
      ) : status === "error" ? (
        <Glyph slot="fail" fallback={X} size={STEP_GLYPH_SIZE} />
      ) : (
        <Glyph slot="pending" fallback={Circle} size={STEP_GLYPH_SIZE} />
      )}
    </span>
  );
}

/** A decision / orchestration tree rendered as a terminal directory tree. */
export const ChatTree = forwardRef<HTMLDivElement, ChatTreeProps>(function ChatTree(
  { roots, onSelect, title = "tree", className, ...rest },
  ref,
) {
  const rows = buildRows(roots);
  const body = (
    <div className={styles.rows}>
      {rows.map((row) => (
        <Button
          key={row.id}
          type="button"
          variant="ghost"
          size="sm"
          className={styles.row}
          onClick={() => onSelect?.(row.id)}
        >
          <span className={styles.guide}>{row.prefix}</span>
          <StepStatusGlyph status={row.status} />
          <span className={styles.label}>{row.label}</span>
        </Button>
      ))}
    </div>
  );

  if (title === null) {
    return (
      <div ref={ref} {...rest} className={cx(styles.bare, className)}>
        {body}
      </div>
    );
  }
  return (
    <ChatBlock ref={ref} {...rest} title={title} className={className}>
      {body}
    </ChatBlock>
  );
});
