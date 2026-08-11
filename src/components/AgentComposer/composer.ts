/* Pure tree operations for AgentComposer. The value is one rooted tree of
   agent instances and tool leaves; there are no id references between nodes,
   so cycles are unrepresentable. Every operation returns a new tree. */

export type AgentComposerToolKind = "fn" | "mcp";

/** Hyperparameters for one use, shown as `key value` pairs on the HPR row. */
export type AgentComposerParams = Record<string, string | number | boolean>;

/** A tool leaf: a plain function tool (`fn`) or an MCP-served tool (`mcp`).
 *  Like an agent it is one instance and carries its own hyperparameters and
 *  context; it has no model and no children. */
export interface AgentComposerTool {
  /** Stable identity; used as the React key and the focus row id. */
  id: string;
  kind: AgentComposerToolKind;
  /** Instance name (the primary label). Falls back to `tool` when unset. */
  name?: string;
  /** Tool this instance uses: the catalog type, shown next to the name. */
  tool: string;
  /** Hyperparameters for this use (the HPR row). */
  hyperparams?: AgentComposerParams;
  /** Context for this use (the CTX row): description / usage notes. */
  context?: string;
}

/** One instance of a catalog agent at one site: the agent it instantiates,
 *  the model / hyperparameters / context for this use, and its children. */
export interface AgentComposerAgent {
  id: string;
  kind: "agent";
  /** Instance name (the primary label). Falls back to `agent` when unset. */
  name?: string;
  /** Catalog agent this instance uses: the type, shown next to the name. */
  agent: string;
  /** Model tier for this use (the MDL row). */
  model?: string;
  /** Hyperparameters for this use (the HPR row): max_turns, temperature… */
  hyperparams?: AgentComposerParams;
  /** Context for this use (the CTX row): system prompt / memory / docs. */
  context?: string;
  children: AgentComposerNode[];
}

export type AgentComposerNode = AgentComposerAgent | AgentComposerTool;

/** Child indices from the root's children downward; `[]` is the root itself. */
export type ComposerPath = number[];

export function findPathById(root: AgentComposerAgent, id: string): ComposerPath | null {
  if (root.id === id) return [];
  const walk = (list: AgentComposerNode[], base: ComposerPath): ComposerPath | null => {
    for (let i = 0; i < list.length; i++) {
      const node = list[i];
      if (!node) continue;
      const path = [...base, i];
      if (node.id === id) return path;
      if (node.kind === "agent") {
        const found = walk(node.children, path);
        if (found) return found;
      }
    }
    return null;
  };
  return walk(root.children, []);
}

export function nodeAtPath(root: AgentComposerAgent, path: ComposerPath): AgentComposerNode | null {
  let cur: AgentComposerNode = root;
  for (const i of path) {
    if (cur.kind !== "agent") return null;
    const next: AgentComposerNode | undefined = cur.children[i];
    if (!next) return null;
    cur = next;
  }
  return cur;
}

/** Replace the children of the agent at `parentPath` (every step of a valid
 *  path passes through agent nodes, so intermediate casts hold). */
function withChildrenAt(
  root: AgentComposerAgent,
  parentPath: ComposerPath,
  mut: (children: AgentComposerNode[]) => AgentComposerNode[],
): AgentComposerAgent {
  const rec = (agent: AgentComposerAgent, path: ComposerPath): AgentComposerAgent => {
    if (path.length === 0) return { ...agent, children: mut(agent.children) };
    const [head, ...rest] = path;
    return {
      ...agent,
      children: agent.children.map((c, i) => (i === head && c.kind === "agent" ? rec(c, rest) : c)),
    };
  };
  return rec(root, parentPath);
}

/** Remove the node with `id`. The root is never removed. */
export function removeNode(root: AgentComposerAgent, id: string): AgentComposerAgent {
  const path = findPathById(root, id);
  if (!path || path.length === 0) return root;
  const index = path[path.length - 1] as number;
  return withChildrenAt(root, path.slice(0, -1), (cs) => cs.filter((_, i) => i !== index));
}

/** Swap the node with its neighbour among its siblings. Out-of-range returns
 *  the SAME root (identity), so callers can skip emitting a no-op change. */
export function moveSibling(
  root: AgentComposerAgent,
  id: string,
  delta: -1 | 1,
): AgentComposerAgent {
  const path = findPathById(root, id);
  if (!path || path.length === 0) return root;
  const index = path[path.length - 1] as number;
  const parent = nodeAtPath(root, path.slice(0, -1));
  if (!parent || parent.kind !== "agent") return root;
  const target = index + delta;
  if (target < 0 || target >= parent.children.length) return root;
  return withChildrenAt(root, path.slice(0, -1), (cs) => {
    const out = [...cs];
    const a = out[index] as AgentComposerNode;
    out[index] = out[target] as AgentComposerNode;
    out[target] = a;
    return out;
  });
}

/** Move the node out of its parent, to just after the parent among the
 *  grandparent's children. Direct children of the root stay put. */
export function outdentNode(root: AgentComposerAgent, id: string): AgentComposerAgent {
  const path = findPathById(root, id);
  if (!path || path.length < 2) return root;
  const node = nodeAtPath(root, path);
  if (!node) return root;
  const index = path[path.length - 1] as number;
  const parentPath = path.slice(0, -1);
  const parentIndex = parentPath[parentPath.length - 1] as number;
  const removed = withChildrenAt(root, parentPath, (cs) => cs.filter((_, i) => i !== index));
  return withChildrenAt(removed, parentPath.slice(0, -1), (cs) => {
    const out = [...cs];
    out.splice(parentIndex + 1, 0, node);
    return out;
  });
}

/** Move the node into its previous sibling, appended to its children. Only an
 *  agent sibling can receive it; anything else is a no-op. */
export function indentNode(root: AgentComposerAgent, id: string): AgentComposerAgent {
  const path = findPathById(root, id);
  if (!path || path.length === 0) return root;
  const index = path[path.length - 1] as number;
  if (index === 0) return root;
  const parentPath = path.slice(0, -1);
  const parent = nodeAtPath(root, parentPath);
  if (!parent || parent.kind !== "agent") return root;
  const node = parent.children[index];
  const prev = parent.children[index - 1];
  if (!node || !prev || prev.kind !== "agent") return root;
  const removed = withChildrenAt(root, parentPath, (cs) => cs.filter((_, i) => i !== index));
  // `prev` keeps its index after removing the later sibling.
  return withChildrenAt(removed, [...parentPath, index - 1], (cs) => [...cs, node]);
}

/** The ids of every child of `id`'s parent (siblings of `id`, `id` included).
 *  Empty for the root or an unknown id. Used to constrain drag drop targets to
 *  siblings so reordering stays within one parent. */
export function siblingIds(root: AgentComposerAgent, id: string): string[] {
  const path = findPathById(root, id);
  if (!path || path.length === 0) return [];
  const parent = nodeAtPath(root, path.slice(0, -1));
  if (!parent || parent.kind !== "agent") return [];
  return parent.children.map((c) => c.id);
}

/** Reorder within a parent: move `activeId` to `overId`'s position among their
 *  shared siblings. Returns the SAME root (identity) when they are not siblings
 *  of one common parent, so a cross-parent drop is a no-op the caller can skip. */
export function reorderSiblings(
  root: AgentComposerAgent,
  activeId: string,
  overId: string,
): AgentComposerAgent {
  if (activeId === overId) return root;
  const ap = findPathById(root, activeId);
  const op = findPathById(root, overId);
  if (!ap || !op || ap.length === 0 || op.length === 0) return root;
  const aParent = ap.slice(0, -1);
  const oParent = op.slice(0, -1);
  if (aParent.length !== oParent.length || aParent.some((v, i) => v !== oParent[i])) return root;
  const from = ap[ap.length - 1] as number;
  const to = op[op.length - 1] as number;
  return withChildrenAt(root, aParent, (cs) => {
    const next = [...cs];
    const [moved] = next.splice(from, 1);
    if (moved) next.splice(to, 0, moved);
    return next;
  });
}

/** Append a child to the agent with `parentId`. */
export function insertChild(
  root: AgentComposerAgent,
  parentId: string,
  node: AgentComposerNode,
): AgentComposerAgent {
  const path = findPathById(root, parentId);
  if (path === null) return root;
  const parent = nodeAtPath(root, path);
  if (!parent || parent.kind !== "agent") return root;
  return withChildrenAt(root, path, (cs) => [...cs, node]);
}

/** Ids of every agent in the subtree under `id`, the node itself excluded. */
export function descendantAgentIds(root: AgentComposerAgent, id: string): string[] {
  const path = findPathById(root, id);
  const node = path !== null ? nodeAtPath(root, path) : null;
  if (!node || node.kind !== "agent") return [];
  const out: string[] = [];
  const walk = (a: AgentComposerAgent) => {
    for (const child of a.children) {
      if (child.kind === "agent") {
        out.push(child.id);
        walk(child);
      }
    }
  };
  walk(node);
  return out;
}

export interface ComposerStats {
  /** Agent instances, the root included. */
  instances: number;
  /** Tool leaves. */
  tools: number;
  /** Deepest agent nesting; the root sits at 0. */
  depth: number;
}

export function composerStats(root: AgentComposerAgent): ComposerStats {
  let instances = 0;
  let tools = 0;
  let depth = 0;
  const walk = (agent: AgentComposerAgent, level: number) => {
    instances += 1;
    depth = Math.max(depth, level);
    for (const child of agent.children) {
      if (child.kind === "agent") walk(child, level + 1);
      else tools += 1;
    }
  };
  walk(root, 0);
  return { instances, tools, depth };
}

/** How often each catalog agent is instantiated across the tree. */
export function agentUseCounts(root: AgentComposerAgent): Map<string, number> {
  const counts = new Map<string, number>();
  const walk = (agent: AgentComposerAgent) => {
    counts.set(agent.agent, (counts.get(agent.agent) ?? 0) + 1);
    for (const child of agent.children) {
      if (child.kind === "agent") walk(child);
    }
  };
  walk(root);
  return counts;
}
