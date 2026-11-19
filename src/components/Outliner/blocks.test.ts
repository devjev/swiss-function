import { describe, expect, it } from "vitest";
import {
  blockProperties,
  codeEnter,
  codeTab,
  cycleTask,
  imageSource,
  nextOrdered,
  parseBlock,
  renumber,
  setDate,
  setHeading,
  setTaskDone,
  tableRows,
  taskProgress,
  toggleQuote,
} from "./blocks";
import { preprocessOutlinerMarkdown } from "./markdown-extensions";
import type { OutlinerValue } from "./types";

const kind = (content: string) => parseBlock(content).kind;

describe("parseBlock", () => {
  it("reads the kind from the text", () => {
    expect(kind("plain")).toBe("text");
    expect(kind("# Title")).toBe("heading");
    expect(kind("#tag first")).toBe("text");
    expect(kind("#### too deep")).toBe("text");
    expect(kind("> said")).toBe("quote");
    expect(kind("> [!warning] careful")).toBe("callout");
    expect(kind("> [!unknown] plain quote")).toBe("quote");
    expect(kind("---")).toBe("divider");
    expect(kind("--")).toBe("text");
    expect(kind("```js\nlet a;\n```")).toBe("code");
    expect(kind("status:: open")).toBe("property");
    expect(kind("see https://example.com")).toBe("text");
    expect(kind("![a cat](https://x.test/cat.png)")).toBe("image");
    expect(kind("text ![a cat](https://x.test/cat.png)")).toBe("text");
    expect(kind("{{table}}")).toBe("table");
    expect(kind("{{kanban}}")).toBe("kanban");
    expect(kind("{{embed ((abc))}}")).toBe("embed");
    expect(kind("{{embed: ((abc))}}")).toBe("embed");
    expect(kind("{{nothing}}")).toBe("text");
  });

  it("gives the body and where it starts", () => {
    expect(parseBlock("## Section")).toMatchObject({ level: 2, body: "Section", bodyStart: 3 });
    expect(parseBlock("owner:: [[Ada]]")).toMatchObject({
      key: "owner",
      body: "[[Ada]]",
      bodyStart: 8,
    });
    expect(parseBlock("empty::")).toMatchObject({ kind: "property", key: "empty", body: "" });
    expect(parseBlock("> [!tip] one\n> two")).toMatchObject({
      tone: "tip",
      body: "one\ntwo",
      bodyStart: 9,
    });
    expect(parseBlock("```js\ncode\n```")).toMatchObject({ bodyStart: 6 });
    expect(parseBlock("{{embed ((abc))}}").ref).toBe("abc");
    expect(parseBlock("![cat|320](c.png)").image).toEqual({ alt: "cat", url: "c.png", width: 320 });
    expect(parseBlock("![cat](c.png)").image?.width).toBeNull();
  });

  it("reads a list number and a task marker, in that order", () => {
    expect(parseBlock("3. third")).toMatchObject({ ordered: true, task: null, body: "third" });
    expect(parseBlock("1. [x] done")).toMatchObject({ ordered: true, task: "done", body: "done" });
    expect(parseBlock("[/] going").task).toBe("doing");
    expect(parseBlock("[-] dropped").task).toBe("cancelled");
    expect(parseBlock("[ ] # not a heading")).toMatchObject({ kind: "text", task: "todo" });
    expect(parseBlock("3.14 is not a list")).toMatchObject({ ordered: false });
  });
});

describe("tasks", () => {
  it("cycles: none, open, done, none; in progress is done next", () => {
    expect(cycleTask("a")).toBe("[ ] a");
    expect(cycleTask("[ ] a")).toBe("[x] a");
    expect(cycleTask("[x] a")).toBe("a");
    expect(cycleTask("[/] a")).toBe("[x] a");
    expect(cycleTask("[-] a")).toBe("a");
  });

  it("keeps the list number in front of the marker", () => {
    expect(cycleTask("2. a")).toBe("2. [ ] a");
    expect(setTaskDone("2. [ ] a", true)).toBe("2. [x] a");
    expect(setTaskDone("[-] a", false)).toBe("[ ] a");
  });

  it("counts the tasks among a block's children", () => {
    expect(
      taskProgress([
        { id: "1", content: "[x] a" },
        { id: "2", content: "[ ] b" },
        { id: "3", content: "[/] c" },
        { id: "4", content: "[-] dropped" },
        { id: "5", content: "a note" },
      ]),
    ).toEqual({ done: 1, total: 3 });
    expect(taskProgress([{ id: "1", content: "a note" }])).toBeNull();
    expect(taskProgress(undefined)).toBeNull();
  });
});

describe("due dates", () => {
  it("become date links, and only where they stand alone", () => {
    expect(preprocessOutlinerMarkdown("[ ] ship @2026-11-25")).toBe(
      "[ ] ship [2026-11-25](date:2026-11-25)",
    );
    expect(preprocessOutlinerMarkdown("mail ada@2026-11-25")).toBe("mail ada@2026-11-25");
    expect(preprocessOutlinerMarkdown("@2026-11-256")).toBe("@2026-11-256");
  });

  it("are replaced in place", () => {
    expect(setDate("ship @2026-11-25 or @2026-12-01", "2026-11-25", "2026-11-30")).toBe(
      "ship @2026-11-30 or @2026-12-01",
    );
  });
});

describe("headings and quotes", () => {
  it("sets, changes and takes off a heading", () => {
    expect(setHeading("Title", 2)).toEqual({ text: "## Title", shift: 3 });
    expect(setHeading("## Title", 1)).toEqual({ text: "# Title", shift: -1 });
    expect(setHeading("# Title", 1)).toEqual({ text: "Title", shift: -2 });
    expect(setHeading("### Title", 0)).toEqual({ text: "Title", shift: -4 });
  });

  it("quotes every line, and takes the quote off again", () => {
    expect(toggleQuote("one\ntwo").text).toBe("> one\n> two");
    expect(toggleQuote("> one\n> two").text).toBe("one\ntwo");
  });
});

describe("code blocks", () => {
  it("Enter on an opening fence closes it and puts the caret inside", () => {
    expect(codeEnter("```js", 5, 5)).toEqual({ text: "```js\n\n```", start: 6, end: 6 });
    // The backtick the pairing left behind is absorbed.
    expect(codeEnter("````", 3, 3)).toEqual({ text: "```\n\n```", start: 4, end: 4 });
  });

  it("Enter inside a fence is a line break that keeps the indentation", () => {
    expect(codeEnter("```\n  a\n```", 7, 7)).toEqual({
      text: "```\n  a\n  \n```",
      start: 10,
      end: 10,
    });
  });

  it("Enter after the closing fence, or outside code, is a split", () => {
    expect(codeEnter("```\na\n```", 9, 9)).toBeNull();
    expect(codeEnter("plain", 2, 2)).toBeNull();
  });

  it("Tab indents the code", () => {
    expect(codeTab("```\na\n```", 4, 4)).toEqual({ text: "```\n  a\n```", start: 6, end: 6 });
  });
});

describe("numbered lists", () => {
  it("continues the list", () => {
    expect(nextOrdered("2. two")).toBe("3. ");
    expect(nextOrdered("two")).toBeNull();
  });

  it("numbers each run of ordered siblings by place", () => {
    const tree: OutlinerValue = [
      { id: "a", content: "5. a" },
      { id: "b", content: "5. b", children: [{ id: "b1", content: "9. nested" }] },
      { id: "c", content: "a break" },
      { id: "d", content: "7. d" },
    ];
    expect(renumber(tree).map((b) => b.content)).toEqual(["1. a", "2. b", "a break", "1. d"]);
    expect(renumber(tree)[1]?.children?.[0]?.content).toBe("1. nested");
  });

  it("keeps what is already right", () => {
    const tree: OutlinerValue = [
      { id: "a", content: "1. a", children: [{ id: "a1", content: "plain" }] },
      { id: "b", content: "2. b" },
    ];
    expect(renumber(tree)).toBe(tree);
    const off: OutlinerValue = [tree[0] as OutlinerValue[number], { id: "b", content: "9. b" }];
    expect(renumber(off)[0]).toBe(tree[0]);
  });
});

describe("properties, tables, images", () => {
  it("reads a block's properties from its children", () => {
    expect(
      blockProperties({
        id: "p",
        content: "Project",
        children: [
          { id: "1", content: "status:: open" },
          { id: "2", content: "owner:: [[Ada]]" },
          { id: "3", content: "a note" },
        ],
      }),
    ).toEqual({ status: "open", owner: "[[Ada]]" });
  });

  it("reads a table's rows: a row's text, then its children", () => {
    const rows = tableRows([
      { id: "h", content: "Name", children: [{ id: "h2", content: "Age" }] },
      { id: "r", content: "Ada", children: [{ id: "r2", content: "36" }] },
    ]);
    expect(rows.map((row) => row.map((cell) => cell.content))).toEqual([
      ["Name", "Age"],
      ["Ada", "36"],
    ]);
    expect(rows[1]?.[1]?.id).toBe("r2");
  });

  it("writes an image's width into its alt text", () => {
    const image = { alt: "cat", url: "c.png", width: null };
    expect(imageSource(image, 320.4)).toBe("![cat|320](c.png)");
    expect(imageSource({ ...image, width: 320 }, null)).toBe("![cat](c.png)");
  });
});
