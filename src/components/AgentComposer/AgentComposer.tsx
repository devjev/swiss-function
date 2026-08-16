import type { HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { forwardRef, lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import styles from "./AgentComposer.module.css";
import type { AgentComposerExternalDrop } from "./AgentComposerTree";
import {
  type AgentComposerAgent,
  type AgentComposerNode,
  agentUseCounts,
  descendantAgentIds,
  findPathById,
  indentNode,
  moveSibling,
  nodeAtPath,
  outdentNode,
  removeNode,
  reorderSiblings,
} from "./composer";
import {
  type AgentComposerPart,
  type NodeCtx,
  paramCount,
  renderNode,
  rowIdOf,
} from "./renderNode";

export type { AgentComposerExternalDrop } from "./AgentComposerTree";
export type {
  AgentComposerAgent,
  AgentComposerNode,
  AgentComposerParams,
  AgentComposerTool,
  AgentComposerToolKind,
} from "./composer";
export type { AgentComposerPart } from "./renderNode";

// dnd-kit is pulled in only when the tree is editable (drag-to-reorder). Lazy so
// it lands in its own chunk and a read-only composer never loads it.
const AgentComposerTree = lazy(() => import("./AgentComposerTree"));

export interface AgentComposerProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "onChange" | "defaultValue"> {
  /** The root agent instance (controlled). Pair with `onChange`. */
  value?: AgentComposerAgent;
  /** Initial tree (uncontrolled). */
  defaultValue?: AgentComposerAgent;
  /** Called with the next tree after a structural edit. */
  onChange?: (next: AgentComposerAgent) => void;
  /** Collapsed agent ids (controlled). */
  collapsed?: string[];
  /** Initially collapsed agent ids (uncontrolled). */
  defaultCollapsed?: string[];
  onCollapsedChange?: (ids: string[]) => void;
  /** A parameter row (MDL/HPR/CTX) pressed: open your editor for that part. */
  onRequestEdit?: (nodeId: string, part: AgentComposerPart) => void;
  /** Fires when a foreign element (dragged from the host under a shared
   *  `SfDndProvider`) is dropped onto a node. Only meaningful inside a provider
   *  and when not `readOnly`. */
  onExternalDrop?: (drop: AgentComposerExternalDrop) => void;
  /** Static viewer: no structure edits, no drag. */
  readOnly?: boolean;
  /** Short uppercase tag per kind. Default agent → AGT, fn → FNC, mcp → MCP. */
  kindLabel?: (kind: string) => string;
}

const DEFAULT_KIND_LABEL: Record<string, string> = {
  agent: "AGT",
  fn: "FNC",
  mcp: "MCP",
};

export const AgentComposer = forwardRef<HTMLDivElement, AgentComposerProps>(function AgentComposer(
  {
    value,
    defaultValue,
    onChange,
    collapsed,
    defaultCollapsed,
    onCollapsedChange,
    onRequestEdit,
    onExternalDrop,
    readOnly = false,
    kindLabel,
    className,
    ...rest
  },
  ref,
) {
  const [internal, setInternal] = useState<AgentComposerAgent | undefined>(defaultValue);
  const isControlled = value !== undefined;
  const root = isControlled ? value : internal;
  const setRoot = (next: AgentComposerAgent) => {
    if (!isControlled) setInternal(next);
    onChange?.(next);
  };

  // Agents default expanded: `collapsed` holds the ones the user closed.
  const [internalCollapsed, setInternalCollapsed] = useState<string[]>(defaultCollapsed ?? []);
  const collapsedIds = collapsed ?? internalCollapsed;
  const collapsedSet = useMemo(() => new Set(collapsedIds), [collapsedIds]);
  const setCollapsed = (ids: string[]) => {
    if (collapsed === undefined) setInternalCollapsed(ids);
    onCollapsedChange?.(ids);
  };
  // Collapsing an agent cascades: it and every descendant agent close together,
  // so re-expanding it reveals its children as one-line boxes.
  const toggleAgentCollapsed = (id: string) => {
    if (collapsedSet.has(id)) {
      setCollapsed(collapsedIds.filter((c) => c !== id));
      return;
    }
    const cascade = root ? descendantAgentIds(root, id) : [];
    const add = [id, ...cascade].filter((c) => !collapsedSet.has(c));
    setCollapsed([...collapsedIds, ...add]);
  };

  // Tools default collapsed (a one-line box); this holds the ones opened to
  // edit their HPR/CTX. Ephemeral, not part of the public collapse state.
  const [toolOpen, setToolOpen] = useState<Set<string>>(new Set());
  const toggleToolOpen = (id: string) =>
    setToolOpen((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const [active, setActive] = useState<string | null>(null);
  const [hoveredType, setHoveredType] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const pendingFocus = useRef<string | null>(null);

  // Re-focus after a structural edit remounts the active row elsewhere.
  useEffect(() => {
    if (pendingFocus.current) {
      rowRefs.current.get(pendingFocus.current)?.focus();
      pendingFocus.current = null;
    }
  });

  const useCounts = useMemo(() => (root ? agentUseCounts(root) : null), [root]);
  const label = (kind: string) =>
    kindLabel?.(kind) ?? DEFAULT_KIND_LABEL[kind] ?? kind.slice(0, 3).toUpperCase();

  const editable = !readOnly && !!onRequestEdit;
  const showModel = (node: AgentComposerNode) =>
    node.kind === "agent" && (node.model !== undefined || editable);
  const showHyper = (node: AgentComposerNode) => paramCount(node.hyperparams) > 0 || editable;
  const showContext = (node: AgentComposerNode) => !!node.context || editable;

  // An agent is always a container; a tool is expandable only when it has parts
  // to reveal. A non-expandable node is a permanent box (no chevron).
  const expandable = (node: AgentComposerNode) =>
    node.kind === "agent" || showHyper(node) || showContext(node);
  const isCollapsed = (node: AgentComposerNode) => {
    if (!expandable(node)) return true;
    return node.kind === "agent" ? collapsedSet.has(node.id) : !toolOpen.has(node.id);
  };
  const toggle = (node: AgentComposerNode) => {
    if (node.kind === "agent") toggleAgentCollapsed(node.id);
    else toggleToolOpen(node.id);
  };

  /** Visible focusable rows, in document order (drives the roving focus).
   *  Recomputed per render: the tree is small and this avoids memo deps on the
   *  render-scoped `show*`/`isCollapsed` closures. */
  const rowOrder: string[] = [];
  if (root) {
    const walk = (node: AgentComposerNode) => {
      rowOrder.push(node.id);
      if (isCollapsed(node)) return;
      if (showModel(node)) rowOrder.push(rowIdOf(node.id, "model"));
      if (showHyper(node)) rowOrder.push(rowIdOf(node.id, "hyperparams"));
      if (showContext(node)) rowOrder.push(rowIdOf(node.id, "context"));
      if (node.kind === "agent") for (const child of node.children) walk(child);
    };
    walk(root);
  }

  // The single tab stop. A stale active id (its row deleted or collapsed away)
  // falls back to the root header so the tree never leaves the tab order.
  const activeRow = active && rowOrder.includes(active) ? active : root?.id;
  const rowTabIndex = (rowKey: string) => (rowKey === activeRow ? 0 : -1);

  const focusRow = (rowKey: string) => {
    setActive(rowKey);
    rowRefs.current.get(rowKey)?.focus();
  };
  const focusStep = (rowKey: string, delta: number) => {
    const idx = rowOrder.indexOf(rowKey);
    const next = rowOrder[idx + delta];
    if (next) focusRow(next);
  };

  const edit = (root_: AgentComposerAgent, rowKey: string, next: AgentComposerAgent) => {
    if (next === root_) return;
    pendingFocus.current = rowKey;
    setActive(rowKey);
    setRoot(next);
  };

  const onRowKeyDown = (e: KeyboardEvent, nodeId: string, part?: AgentComposerPart) => {
    if (!root) return;
    const rowKey = rowIdOf(nodeId, part);
    const isNodeRow = part === undefined;
    const key = e.key;

    if (key === "ArrowDown" || key === "ArrowUp") {
      if (e.altKey) {
        if (readOnly) return;
        e.preventDefault();
        if (isNodeRow && nodeId !== root.id) {
          edit(root, rowKey, moveSibling(root, nodeId, key === "ArrowDown" ? 1 : -1));
        }
        return;
      }
      e.preventDefault();
      focusStep(rowKey, key === "ArrowDown" ? 1 : -1);
      return;
    }
    if (key === "ArrowLeft" || key === "ArrowRight") {
      if (e.altKey) {
        // Unconditional preventDefault: Alt+Left is history-Back on
        // Windows/Linux and must never fire while composing.
        if (readOnly) return;
        e.preventDefault();
        if (isNodeRow && nodeId !== root.id) {
          if (key === "ArrowLeft") {
            edit(root, rowKey, outdentNode(root, nodeId));
          } else {
            const next = indentNode(root, nodeId);
            if (next !== root) {
              const path = findPathById(next, nodeId);
              const parent = path ? nodeAtPath(next, path.slice(0, -1)) : null;
              if (parent && collapsedSet.has(parent.id)) toggleAgentCollapsed(parent.id);
              edit(root, rowKey, next);
            }
          }
        }
        return;
      }
      e.preventDefault();
      const path = findPathById(root, nodeId);
      const node = path !== null ? nodeAtPath(root, path) : null;
      const canExpand = !!node && isNodeRow && expandable(node);
      if (key === "ArrowLeft") {
        if (canExpand && !isCollapsed(node)) {
          toggle(node);
        } else {
          const owner = part
            ? nodeId
            : path?.length
              ? (nodeAtPath(root, path.slice(0, -1))?.id ?? null)
              : null;
          if (owner) focusRow(owner);
        }
      } else {
        if (canExpand && isCollapsed(node)) toggle(node);
        else focusStep(rowKey, 1);
      }
      return;
    }
    if (key === "Home" || key === "End") {
      e.preventDefault();
      const next = rowOrder[key === "Home" ? 0 : rowOrder.length - 1];
      if (next) focusRow(next);
      return;
    }
    if (key === "Delete" || key === "Backspace") {
      if (!readOnly && isNodeRow && nodeId !== root.id) {
        e.preventDefault();
        const idx = rowOrder.indexOf(rowKey);
        const fallback = rowOrder[idx - 1] ?? root.id;
        edit(root, fallback, removeNode(root, nodeId));
      }
      return;
    }
    if (key === "Enter" || key === " ") {
      // Part rows are real buttons; native activation clicks them.
      if (!isNodeRow) return;
      e.preventDefault();
      const path = findPathById(root, nodeId);
      const node = path !== null ? nodeAtPath(root, path) : null;
      if (node && expandable(node)) toggle(node);
    }
  };

  /** Drag drop: reorder within the shared parent, focus the moved node. */
  const onReorder = (activeId: string, overId: string) => {
    if (!root) return;
    edit(root, activeId, reorderSiblings(root, activeId, overId));
  };

  const ctx: NodeCtx = {
    readOnly,
    label,
    useCounts,
    hoveredType,
    setHoveredType,
    showModel,
    showHyper,
    showContext,
    expandable,
    isCollapsed,
    toggle,
    rowTabIndex,
    setActive,
    registerRow: (rowKey, el) => {
      if (el) rowRefs.current.set(rowKey, el);
      else rowRefs.current.delete(rowKey);
    },
    onRowKeyDown,
    focusRow,
    onRequestEdit,
  };

  const identity = (_ids: string[], children: ReactNode) => children;
  const staticNode = (node: AgentComposerNode, depth: number, isLast: boolean): ReactNode =>
    renderNode(
      ctx,
      node,
      depth,
      isLast,
      (child, _i, last) => staticNode(child, depth + 1, last),
      identity,
    );

  let body: ReactNode;
  if (!root) {
    body = <div className={styles.empty}>no composition</div>;
  } else if (readOnly || !onChange) {
    body = staticNode(root, 0, true);
  } else {
    body = (
      <Suspense fallback={staticNode(root, 0, true)}>
        <AgentComposerTree
          ctx={ctx}
          root={root}
          onReorder={onReorder}
          onExternalDrop={onExternalDrop}
        />
      </Suspense>
    );
  }

  return (
    <div
      {...rest}
      ref={ref}
      role="tree"
      aria-label="Agent composer"
      className={cx(styles.root, className)}
    >
      {body}
    </div>
  );
});
