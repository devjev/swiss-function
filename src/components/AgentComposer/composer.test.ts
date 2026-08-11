import { describe, expect, it } from "vitest";
import {
  type AgentComposerAgent,
  agentUseCounts,
  composerStats,
  descendantAgentIds,
  findPathById,
  indentNode,
  insertChild,
  moveSibling,
  nodeAtPath,
  outdentNode,
  removeNode,
  reorderSiblings,
} from "./composer";

const tree = (): AgentComposerAgent => ({
  id: "root",
  kind: "agent",
  agent: "triage",
  children: [
    { id: "faq", kind: "fn", tool: "handbook_faq" },
    {
      id: "researcher",
      kind: "agent",
      agent: "researcher",
      children: [
        { id: "web", kind: "fn", tool: "web_search" },
        { id: "sum-1", kind: "agent", agent: "summarizer", children: [] },
      ],
    },
    { id: "sum-2", kind: "agent", agent: "summarizer", children: [] },
  ],
});

describe("findPathById / nodeAtPath", () => {
  it("finds the root at the empty path", () => {
    expect(findPathById(tree(), "root")).toEqual([]);
  });
  it("finds nested nodes", () => {
    const t = tree();
    expect(findPathById(t, "sum-1")).toEqual([1, 1]);
    expect(nodeAtPath(t, [1, 1])?.id).toBe("sum-1");
  });
  it("returns null for unknown ids", () => {
    expect(findPathById(tree(), "nope")).toBeNull();
  });
});

describe("removeNode", () => {
  it("removes a nested node", () => {
    const next = removeNode(tree(), "sum-1");
    expect(findPathById(next, "sum-1")).toBeNull();
  });
  it("never removes the root", () => {
    const t = tree();
    expect(removeNode(t, "root")).toBe(t);
  });
});

describe("moveSibling", () => {
  it("swaps with the next sibling", () => {
    const next = moveSibling(tree(), "faq", 1);
    expect(next.children.map((c) => c.id)).toEqual(["researcher", "faq", "sum-2"]);
  });
  it("is a no-op at the edge", () => {
    const next = moveSibling(tree(), "faq", -1);
    expect(next.children.map((c) => c.id)).toEqual(["faq", "researcher", "sum-2"]);
  });
});

describe("indentNode / outdentNode", () => {
  it("indents into the previous agent sibling", () => {
    const next = indentNode(tree(), "sum-2");
    const researcher = nodeAtPath(next, [1]);
    expect(researcher?.kind).toBe("agent");
    expect((researcher as AgentComposerAgent).children.map((c) => c.id)).toEqual([
      "web",
      "sum-1",
      "sum-2",
    ]);
  });
  it("refuses to indent into a tool", () => {
    const t = tree();
    expect(indentNode(t, "researcher")).toBe(t);
  });
  it("outdents to just after the old parent", () => {
    const next = outdentNode(tree(), "sum-1");
    expect(next.children.map((c) => c.id)).toEqual(["faq", "researcher", "sum-1", "sum-2"]);
  });
  it("keeps direct children of the root put", () => {
    const t = tree();
    expect(outdentNode(t, "faq")).toBe(t);
  });
});

describe("reorderSiblings", () => {
  it("moves a child to a later sibling's position within the same parent", () => {
    // root children: [faq, researcher, sum-2] → move faq to sum-2's slot
    const next = reorderSiblings(tree(), "faq", "sum-2");
    expect(next.children.map((c) => c.id)).toEqual(["researcher", "sum-2", "faq"]);
  });
  it("moves earlier too (researcher before faq)", () => {
    const next = reorderSiblings(tree(), "researcher", "faq");
    expect(next.children.map((c) => c.id)).toEqual(["researcher", "faq", "sum-2"]);
  });
  it("is a no-op across different parents (identity)", () => {
    const t = tree();
    // web/sum-1 live under researcher; faq lives under root
    expect(reorderSiblings(t, "web", "faq")).toBe(t);
  });
  it("is a no-op onto itself", () => {
    const t = tree();
    expect(reorderSiblings(t, "faq", "faq")).toBe(t);
  });
});

describe("insertChild", () => {
  it("appends to the addressed agent", () => {
    const next = insertChild(tree(), "researcher", { id: "x", kind: "mcp", tool: "tavily" });
    const researcher = nodeAtPath(next, [1]) as AgentComposerAgent;
    expect(researcher.children.at(-1)?.id).toBe("x");
  });
  it("refuses a tool as parent", () => {
    const t = tree();
    expect(insertChild(t, "faq", { id: "x", kind: "fn", tool: "t" })).toBe(t);
  });
});

describe("descendantAgentIds", () => {
  it("collects nested agent ids, excluding the node itself and tools", () => {
    expect(descendantAgentIds(tree(), "root")).toEqual(["researcher", "sum-1", "sum-2"]);
    expect(descendantAgentIds(tree(), "researcher")).toEqual(["sum-1"]);
  });
  it("is empty for leaves and unknown ids", () => {
    expect(descendantAgentIds(tree(), "sum-1")).toEqual([]);
    expect(descendantAgentIds(tree(), "faq")).toEqual([]);
    expect(descendantAgentIds(tree(), "nope")).toEqual([]);
  });
});

describe("stats and use counts", () => {
  it("counts instances, tools, depth", () => {
    expect(composerStats(tree())).toEqual({ instances: 4, tools: 2, depth: 2 });
  });
  it("counts catalog-agent uses across the tree", () => {
    const counts = agentUseCounts(tree());
    expect(counts.get("summarizer")).toBe(2);
    expect(counts.get("triage")).toBe(1);
  });
});
