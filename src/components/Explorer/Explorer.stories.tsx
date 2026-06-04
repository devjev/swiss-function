import type { Story } from "@ladle/react";
import { useState } from "react";
import { CommandBar } from "../CommandBar";
import { Skeleton } from "../Skeleton";
import { Explorer } from "./Explorer";
import type { ExplorerNode } from "./types";

interface FileMeta {
  size?: number;
  modified?: string;
  kind?: "file" | "folder";
}

const seed: ExplorerNode<FileMeta>[] = [
  {
    id: "src",
    name: "src",
    meta: { kind: "folder" },
    children: [
      {
        id: "src/index.ts",
        name: "index.ts",
        meta: { size: 412, modified: "2026-05-22", kind: "file" },
      },
      {
        id: "src/components",
        name: "components",
        meta: { kind: "folder" },
        children: [
          {
            id: "src/components/Box.tsx",
            name: "Box.tsx",
            meta: { size: 1834, modified: "2026-06-01", kind: "file" },
          },
          {
            id: "src/components/Grid.tsx",
            name: "Grid.tsx",
            meta: { size: 921, modified: "2026-05-30", kind: "file" },
          },
          {
            id: "src/components/Explorer.tsx",
            name: "Explorer.tsx",
            meta: { size: 8112, modified: "2026-06-03", kind: "file" },
          },
        ],
      },
      {
        id: "src/tokens",
        name: "tokens",
        meta: { kind: "folder" },
        children: [
          {
            id: "src/tokens/tokens.css",
            name: "tokens.css",
            meta: { size: 4521, modified: "2026-05-15", kind: "file" },
          },
          {
            id: "src/tokens/reset.css",
            name: "reset.css",
            meta: { size: 612, modified: "2026-05-15", kind: "file" },
          },
        ],
      },
    ],
  },
  {
    id: "README.md",
    name: "README.md",
    meta: { size: 1820, modified: "2026-06-02", kind: "file" },
  },
  {
    id: "package.json",
    name: "package.json",
    meta: { size: 2412, modified: "2026-06-03", kind: "file" },
  },
];

function formatSize(n: number | undefined): string {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} kB`;
}

function cloneTree(nodes: ExplorerNode<FileMeta>[]): ExplorerNode<FileMeta>[] {
  return nodes.map((n) => ({
    ...n,
    children: n.children ? cloneTree(n.children) : n.children,
  }));
}

function removeNode(nodes: ExplorerNode<FileMeta>[], id: string) {
  let removed: ExplorerNode<FileMeta> | null = null;
  const walk = (list: ExplorerNode<FileMeta>[]): ExplorerNode<FileMeta>[] => {
    const out: ExplorerNode<FileMeta>[] = [];
    for (const n of list) {
      if (n.id === id) {
        removed = n;
        continue;
      }
      out.push(n.children ? { ...n, children: walk(n.children) } : n);
    }
    return out;
  };
  return { nodes: walk(nodes), removed };
}

function insertNode(
  nodes: ExplorerNode<FileMeta>[],
  newNode: ExplorerNode<FileMeta>,
  parentId: string | null,
  beforeId: string | null | undefined,
): ExplorerNode<FileMeta>[] {
  if (parentId == null) {
    if (beforeId == null) return [...nodes, newNode];
    const idx = nodes.findIndex((n) => n.id === beforeId);
    return idx < 0 ? [...nodes, newNode] : [...nodes.slice(0, idx), newNode, ...nodes.slice(idx)];
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

function renameNode(
  nodes: ExplorerNode<FileMeta>[],
  id: string,
  name: string,
): ExplorerNode<FileMeta>[] {
  return nodes.map((n) => {
    if (n.id === id) return { ...n, name };
    if (n.children) return { ...n, children: renameNode(n.children, id, name) };
    return n;
  });
}

export const ReadOnly: Story = () => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["src", "src/components"]));
  return (
    <div style={{ width: "min(40rem, 100%)" }}>
      <Explorer
        nodes={seed}
        columns={[
          { id: "name", header: "Name" },
          {
            id: "size",
            header: "Size",
            align: "end",
            width: 90,
            render: (n) => formatSize(n.meta?.size),
          },
          {
            id: "modified",
            header: "Modified",
            width: 140,
            render: (n) => n.meta?.modified ?? "—",
          },
        ]}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        expandedIds={expandedIds}
        onExpandedChange={setExpandedIds}
      />
    </div>
  );
};

export const Editable: Story = () => {
  const [nodes, setNodes] = useState(() => cloneTree(seed));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["src"]));
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div style={{ width: "min(40rem, 100%)" }}>
      <Explorer
        nodes={nodes}
        editable
        columns={[
          { id: "name", header: "Name" },
          {
            id: "size",
            header: "Size",
            align: "end",
            width: 90,
            render: (n) => formatSize(n.meta?.size),
          },
          { id: "kind", header: "Kind", width: 90, render: (n) => n.meta?.kind ?? "" },
        ]}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        expandedIds={expandedIds}
        onExpandedChange={setExpandedIds}
        editingId={editingId}
        onEditingChange={setEditingId}
        onRename={(id, name) => setNodes((prev) => renameNode(prev, id, name))}
        onAdd={(parentId, kind) => {
          const id = `new-${Math.random().toString(36).slice(2, 7)}`;
          const node: ExplorerNode<FileMeta> =
            kind === "folder"
              ? { id, name: "Untitled folder", children: [], meta: { kind: "folder" } }
              : { id, name: "Untitled", meta: { kind: "file" } };
          setNodes((prev) => insertNode(prev, node, parentId, null));
          if (parentId) setExpandedIds((prev) => new Set(prev).add(parentId));
          setEditingId(id);
        }}
        onMove={(id, newParentId, beforeId) => {
          setNodes((prev) => {
            const { nodes: without, removed } = removeNode(prev, id);
            return removed ? insertNode(without, removed, newParentId, beforeId) : prev;
          });
        }}
        onDelete={(ids) => {
          setNodes((prev) => {
            let next = prev;
            for (const id of ids) next = removeNode(next, id).nodes;
            return next;
          });
          setSelectedIds(new Set());
        }}
      />
      <p
        style={{
          marginTop: "calc(var(--sf-unit) / 2)",
          color: "var(--sf-color-muted)",
          fontSize: "var(--sf-font-size-sm)",
        }}
      >
        F2 / double-click to rename · right-click for menu · drag rows to move (drop on a folder to
        nest, drop on the top/bottom edge of a row to reorder)
      </p>
    </div>
  );
};

export const WithCommandBar: Story = () => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["src", "src/components"]));
  return (
    <div style={{ width: "min(50rem, 100%)", border: "1px solid var(--sf-color-border-subtle)" }}>
      <CommandBar.Root>
        <CommandBar.Logo>◇ Project</CommandBar.Logo>
        <CommandBar.Menu>
          <CommandBar.Trigger>File</CommandBar.Trigger>
          <CommandBar.Content>
            <CommandBar.Item>New</CommandBar.Item>
          </CommandBar.Content>
        </CommandBar.Menu>
        <CommandBar.Search placeholder="Find file…" />
      </CommandBar.Root>
      <Explorer
        nodes={seed}
        columns={[
          { id: "name", header: "Name" },
          {
            id: "size",
            header: "Size",
            align: "end",
            width: 90,
            render: (n) => formatSize(n.meta?.size),
          },
        ]}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        expandedIds={expandedIds}
        onExpandedChange={setExpandedIds}
        height={320}
      />
    </div>
  );
};

/**
 * Single-column, headerless variant — the file-tree sidebar pattern.
 * Same component, just `columns={[{name}]}` and `showHeader={false}`.
 */
export const FileTree: Story = () => {
  const [nodes, setNodes] = useState(() => cloneTree(seed));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(["src", "src/components"]));
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div style={{ width: "min(18rem, 100%)" }}>
      <Explorer
        nodes={nodes}
        columns={[{ id: "name", header: "" }]}
        showHeader={false}
        editable
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        expandedIds={expandedIds}
        onExpandedChange={setExpandedIds}
        editingId={editingId}
        onEditingChange={setEditingId}
        onRename={(id, name) => setNodes((prev) => renameNode(prev, id, name))}
        onAdd={(parentId, kind) => {
          const id = `new-${Math.random().toString(36).slice(2, 7)}`;
          const node: ExplorerNode<FileMeta> =
            kind === "folder"
              ? { id, name: "Untitled folder", children: [], meta: { kind: "folder" } }
              : { id, name: "Untitled", meta: { kind: "file" } };
          setNodes((prev) => insertNode(prev, node, parentId, null));
          if (parentId) setExpandedIds((prev) => new Set(prev).add(parentId));
          setEditingId(id);
        }}
        onMove={(id, newParentId, beforeId) => {
          setNodes((prev) => {
            const { nodes: without, removed } = removeNode(prev, id);
            return removed ? insertNode(without, removed, newParentId, beforeId) : prev;
          });
        }}
        onDelete={(ids) => {
          setNodes((prev) => {
            let next = prev;
            for (const id of ids) next = removeNode(next, id).nodes;
            return next;
          });
          setSelectedIds(new Set());
        }}
      />
    </div>
  );
};

export const LoadingPlaceholder: Story = () => {
  // A tree of "placeholder" nodes whose names are Skeleton rects via the
  // first column's `render` override. Indent comes from real tree structure.
  const placeholder: ExplorerNode<FileMeta>[] = [
    {
      id: "p1",
      name: "",
      children: [
        { id: "p1a", name: "" },
        { id: "p1b", name: "" },
      ],
    },
    { id: "p2", name: "" },
    { id: "p3", name: "" },
  ];
  return (
    <div style={{ width: "min(40rem, 100%)" }}>
      <Explorer
        nodes={placeholder}
        columns={[
          {
            id: "name",
            header: "Name",
            render: () => <Skeleton width={8} height={0.75} />,
          },
          {
            id: "size",
            header: "Size",
            align: "end",
            width: 90,
            render: () => <Skeleton width={3} height={0.75} />,
          },
        ]}
        expandedIds={new Set(["p1"])}
      />
    </div>
  );
};
