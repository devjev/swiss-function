import { useState } from "react";
import { Explorer } from "./Explorer";
import type { ExplorerNode } from "./types";

const seed: ExplorerNode[] = [
  {
    id: "src",
    name: "src",
    children: [
      { id: "src/index.ts", name: "index.ts" },
      {
        id: "src/components",
        name: "components",
        children: [
          { id: "src/components/Box.tsx", name: "Box.tsx" },
          { id: "src/components/Grid.tsx", name: "Grid.tsx" },
        ],
      },
    ],
  },
  { id: "README.md", name: "README.md" },
  { id: "package.json", name: "package.json" },
];

function cloneTree(nodes: ExplorerNode[]): ExplorerNode[] {
  return nodes.map((n) => ({ ...n, children: n.children ? cloneTree(n.children) : n.children }));
}

function removeNode(
  nodes: ExplorerNode[],
  id: string,
): {
  nodes: ExplorerNode[];
  removed: ExplorerNode | null;
} {
  const out: ExplorerNode[] = [];
  let removed: ExplorerNode | null = null;
  for (const n of nodes) {
    if (n.id === id) {
      removed = n;
      continue;
    }
    if (n.children) {
      const r = removeNode(n.children, id);
      if (r.removed) removed = r.removed;
      out.push({ ...n, children: r.nodes });
    } else {
      out.push(n);
    }
  }
  return { nodes: out, removed };
}

function insertNode(
  nodes: ExplorerNode[],
  newNode: ExplorerNode,
  parentId: string | null,
  beforeId: string | null | undefined,
): ExplorerNode[] {
  if (parentId == null) {
    if (beforeId == null) return [...nodes, newNode];
    const idx = nodes.findIndex((n) => n.id === beforeId);
    if (idx < 0) return [...nodes, newNode];
    return [...nodes.slice(0, idx), newNode, ...nodes.slice(idx)];
  }
  return nodes.map((n) => {
    if (n.id === parentId && n.children) {
      if (beforeId == null) return { ...n, children: [...n.children, newNode] };
      const idx = n.children.findIndex((c) => c.id === beforeId);
      if (idx < 0) return { ...n, children: [...n.children, newNode] };
      return {
        ...n,
        children: [...n.children.slice(0, idx), newNode, ...n.children.slice(idx)],
      };
    }
    if (n.children) return { ...n, children: insertNode(n.children, newNode, parentId, beforeId) };
    return n;
  });
}

function renameNode(nodes: ExplorerNode[], id: string, name: string): ExplorerNode[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, name };
    if (n.children) return { ...n, children: renameNode(n.children, id, name) };
    return n;
  });
}

interface HarnessProps {
  editable?: boolean;
  /** Start with these ids in the expanded set (will be cloned into a Set). */
  expanded?: string[];
  showHeader?: boolean;
}

export function ExplorerHarness({
  editable,
  expanded = ["src", "src/components"],
  showHeader,
}: HarnessProps) {
  const [nodes, setNodes] = useState<ExplorerNode[]>(() => cloneTree(seed));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(expanded));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lastOp, setLastOp] = useState<string>("");

  return (
    <div>
      <Explorer
        nodes={nodes}
        columns={[
          { id: "name", header: "Name" },
          { id: "size", header: "Size", align: "end", width: 80 },
          { id: "kind", header: "Kind", width: 100 },
        ]}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        expandedIds={expandedIds}
        onExpandedChange={setExpandedIds}
        editingId={editingId}
        onEditingChange={setEditingId}
        editable={editable}
        showHeader={showHeader}
        onAdd={(parentId, kind) => {
          const newId = `new-${Math.random().toString(36).slice(2, 7)}`;
          const newNode: ExplorerNode =
            kind === "folder"
              ? { id: newId, name: "Untitled folder", children: [] }
              : { id: newId, name: "Untitled" };
          setNodes((prev) => insertNode(prev, newNode, parentId, null));
          if (parentId) setExpandedIds((prev) => new Set(prev).add(parentId));
          setEditingId(newId);
          setLastOp(`add:${parentId ?? "root"}:${kind}`);
        }}
        onRename={(id, name) => {
          setNodes((prev) => renameNode(prev, id, name));
          setLastOp(`rename:${id}:${name}`);
        }}
        onMove={(id, newParentId, beforeId) => {
          setNodes((prev) => {
            const { nodes: without, removed } = removeNode(prev, id);
            if (!removed) return prev;
            return insertNode(without, removed, newParentId, beforeId);
          });
          setLastOp(`move:${id}:${newParentId ?? "root"}:${beforeId ?? "end"}`);
        }}
        onDelete={(ids) => {
          setNodes((prev) => {
            let next = prev;
            for (const id of ids) next = removeNode(next, id).nodes;
            return next;
          });
          setSelectedIds(new Set());
          setLastOp(`delete:${ids.join(",")}`);
        }}
      />
      <div data-testid="last-op">{lastOp}</div>
    </div>
  );
}
