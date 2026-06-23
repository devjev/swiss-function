import type { HTMLAttributes } from "react";
import { forwardRef } from "react";
import { Button } from "../Button";
import { ChatBlock } from "./ChatBlock";
import styles from "./ChatTree.module.css";

export interface ChatTreeNode {
  id: string;
  label: string;
  children?: ChatTreeNode[];
}

export interface ChatTreeProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Top-level nodes (a forest). Each is printed bare; descendants get guides. */
  roots: ChatTreeNode[];
  /** Fired with the clicked node's id. */
  onSelect?: (id: string) => void;
}

interface Row {
  id: string;
  label: string;
  /** The monospace guide prefix (`│  `, `├─ `, `└─ `) preceding the label. */
  prefix: string;
}

/** Flatten a forest into rows carrying their box-drawing guide prefix —
 *  classic `tree(1)` output. Roots are printed bare; children accumulate the
 *  vertical guides of their ancestors. */
function buildRows(roots: ChatTreeNode[]): Row[] {
  const out: Row[] = [];
  const walk = (node: ChatTreeNode, prefix: string, connector: string) => {
    out.push({ id: node.id, label: node.label, prefix: prefix + connector });
    const children = node.children ?? [];
    const childPrefix = prefix + (connector === "" ? "" : connector === "└─ " ? "   " : "│  ");
    children.forEach((child, i) => {
      walk(child, childPrefix, i === children.length - 1 ? "└─ " : "├─ ");
    });
  };
  for (const root of roots) walk(root, "", "");
  return out;
}

/** A decision / orchestration tree rendered as a terminal directory tree. */
export const ChatTree = forwardRef<HTMLDivElement, ChatTreeProps>(function ChatTree(
  { roots, onSelect, className, ...rest },
  ref,
) {
  const rows = buildRows(roots);
  return (
    <ChatBlock ref={ref} {...rest} title="tree" className={className}>
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
            <span className={styles.label}>{row.label}</span>
          </Button>
        ))}
      </div>
    </ChatBlock>
  );
});
