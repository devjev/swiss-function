import { describe, expect, it } from "vitest";
import { fenceBody, fenceSource, matchBlockType } from "./blocks";
import { blockCommands, matchCommands } from "./commands";
import type { OutlinerBlockType } from "./types";

const TYPES: OutlinerBlockType[] = [
  { name: "query", render: () => null, command: { label: "Query", insert: "{{query }}" } },
  { name: "csv", aliases: ["json"], match: "fence", render: () => null },
  { name: "math", match: (c) => /^\$\$([\s\S]+)\$\$$/.exec(c)?.[1] ?? null, render: () => null },
];

describe("matchBlockType", () => {
  it("matches a macro by its name and gives the arguments", () => {
    expect(matchBlockType(TYPES, "{{query alpha beta}}")).toMatchObject({
      type: { name: "query" },
      source: "alpha beta",
    });
    expect(matchBlockType(TYPES, "{{query}}")?.source).toBe("");
    expect(matchBlockType(TYPES, "{{query: tasks}}")?.source).toBe("tasks");
    expect(matchBlockType(TYPES, "{{table}}")).toBeNull();
    expect(matchBlockType(TYPES, "see {{query x}}")).toBeNull();
  });

  it("matches a fence by its language, an alias included", () => {
    expect(matchBlockType(TYPES, "```csv\na,b\n1,2\n```")).toMatchObject({
      type: { name: "csv" },
      source: "a,b\n1,2",
    });
    expect(matchBlockType(TYPES, '```json\n[{"a":1}]\n```')?.type.name).toBe("csv");
    expect(matchBlockType(TYPES, "```js\nlet a;\n```")).toBeNull();
    // An open fence is still being typed.
    expect(matchBlockType(TYPES, "```csv\na,b")).toBeNull();
  });

  it("asks a function, and takes the first type that answers", () => {
    expect(matchBlockType(TYPES, "$$x^2$$")?.source).toBe("x^2");
    expect(matchBlockType(TYPES, "plain")).toBeNull();
  });

  it("reads and writes a fence", () => {
    expect(fenceBody("```js\nlet a;\n```")).toEqual({ language: "js", body: "let a;" });
    expect(fenceBody("```\n\n```")).toEqual({ language: "", body: "" });
    expect(fenceBody("```js")).toBeNull();
    expect(fenceSource("js", "let a;")).toBe("```js\nlet a;\n```");
  });
});

describe("block commands", () => {
  const commands = blockCommands(TYPES);
  const labels = (query: string, rest = "") =>
    matchCommands(commands, query, rest).map((c) => c.label);

  it("answers to the start of a word of the label or a keyword", () => {
    expect(labels("h")).toEqual(["Heading 1", "Heading 2", "Heading 3"]);
    expect(labels("h2")).toEqual(["Heading 2"]);
    expect(labels("todo")).toEqual(["Task"]);
    expect(labels("kan")).toEqual(["Board"]);
    expect(labels("que")).toEqual(["Query"]);
  });

  it("offers the commands that replace a block only in an empty one", () => {
    expect(labels("t")).toEqual(["Task", "Table"]);
    expect(labels("t", "some text")).toEqual(["Task"]);
    expect(labels("", "some text")).not.toContain("Divider");
  });

  it("changes the block's text", () => {
    const run = (label: string, text: string) =>
      commands.find((c) => c.label === label)?.apply(text);
    expect(run("Heading 2", "Title")).toEqual({ text: "## Title" });
    expect(run("Heading 1", "### Title")).toEqual({ text: "# Title" });
    expect(run("Task", "do it")).toEqual({ text: "[ ] do it" });
    expect(run("Code block", "")).toEqual({ text: "```\n\n```", caret: 4 });
    expect(run("Table", "")?.children).toHaveLength(2);
    expect(run("Query", "")).toEqual({ text: "{{query }}" });
  });
});
