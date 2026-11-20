import { describe, expect, it } from "vitest";
import {
  applyCompletion,
  cycleTask,
  findTrigger,
  insertLink,
  pairInput,
  setTaskDone,
  spanPairs,
  type TextEdit,
  taskBody,
  taskState,
  toggleWrap,
  unpairBackspace,
} from "./assist";

/** Read "ab|cd" (a caret) or "a<bc>d" (a selection) into text and offsets. */
function read(marked: string): [string, number, number] {
  const caret = marked.indexOf("|");
  if (caret >= 0) return [marked.replace("|", ""), caret, caret];
  const start = marked.indexOf("<");
  const end = marked.indexOf(">") - 1;
  return [marked.replace("<", "").replace(">", ""), start, end];
}

/** The same notation for a result. */
function show(edit: TextEdit | null): string | null {
  if (!edit) return null;
  const { text, start, end } = edit;
  if (start === end) return `${text.slice(0, start)}|${text.slice(start)}`;
  return `${text.slice(0, start)}<${text.slice(start, end)}>${text.slice(end)}`;
}

describe("pairInput", () => {
  const type = (marked: string, key: string) => show(pairInput(...read(marked), key));

  it("closes an opener", () => {
    expect(type("see |", "[")).toBe("see [|]");
    expect(type("see [|]", "[")).toBe("see [[|]]");
    expect(type("|", "(")).toBe("(|)");
    expect(type("(|)", "(")).toBe("((|))");
    expect(type("a |", "`")).toBe("a `|`");
    expect(type("a |", "{")).toBe("a {|}");
  });

  it("leaves a parenthesis inside a word alone", () => {
    expect(type("word|", "(")).toBeNull();
  });

  it("steps over a closer that is already there", () => {
    expect(type("[[Page|]]", "]")).toBe("[[Page]|]");
    expect(type("`code|`", "`")).toBe("`code`|");
    expect(type("plain|", "]")).toBeNull();
  });

  it("wraps a selection, which stays selected", () => {
    expect(type("a <word> b", "[")).toBe("a [<word>] b");
    expect(type("a <word> b", "*")).toBe("a *<word>* b");
    expect(type("a *<word>* b", "*")).toBe("a **<word>** b");
    expect(type("a <word> b", "x")).toBeNull();
  });

  it("does nothing special for other keys", () => {
    expect(type("a|", "*")).toBeNull();
    expect(type("a|", "b")).toBeNull();
  });
});

describe("pairInput with a span's delimiter", () => {
  const math = spanPairs([{ open: "$" }, { open: "\\(", close: "\\)" }]);
  const type = (marked: string, key: string) => show(pairInput(...read(marked), key, math));

  it("takes the one-character delimiters as pairs", () => {
    expect(math).toEqual({ $: "$" });
    expect(type("a|", "$")).toBe(show(pairInput(...read("a|"), "$", { $: "$" })));
    expect(pairInput(...read("so |"), "$")).toBeNull();
  });

  it("closes an opener, steps over the closer, wraps a selection", () => {
    expect(type("so |", "$")).toBe("so $|$");
    expect(type("so $x|$", "$")).toBe("so $x$|");
    expect(type("so <x^2> holds", "$")).toBe("so $<x^2>$ holds");
  });

  it("leaves a second one on the line to close the first", () => {
    expect(type("so $x|", "$")).toBeNull();
    expect(type("$a$ and |", "$")).toBe("$a$ and $|$");
    // The line above does not count.
    expect(type("$5\nso |", "$")).toBe("$5\nso $|$");
  });

  it("does not pair inside or in front of a word, or after a backslash", () => {
    expect(type("US|", "$")).toBeNull();
    expect(type("|x", "$")).toBeNull();
    expect(type("\\|", "$")).toBeNull();
  });

  it("takes a digit right after the opener for a price", () => {
    expect(type("for $|$", "5")).toBe("for $5|");
    expect(type("for $|$", "x")).toBeNull();
    // Between two pairs the digit is plain.
    expect(type("$$|$$", "5")).toBeNull();
  });

  it("unpairs with Backspace", () => {
    expect(show(unpairBackspace(...read("a $|$ b"), math))).toBe("a | b");
    expect(unpairBackspace(...read("a $|$ b"))).toBeNull();
  });
});

describe("unpairBackspace", () => {
  it("removes both halves of an empty pair", () => {
    expect(show(unpairBackspace(...read("a [|] b")))).toBe("a | b");
    expect(show(unpairBackspace(...read("[[|]]")))).toBe("[|]");
  });

  it("is plain otherwise", () => {
    expect(unpairBackspace(...read("a [x|] b"))).toBeNull();
    expect(unpairBackspace(...read("|[]"))).toBeNull();
    expect(unpairBackspace(...read("a <[]> b"))).toBeNull();
  });
});

describe("toggleWrap", () => {
  const bold = (marked: string) => show(toggleWrap(...read(marked), "**"));
  const italic = (marked: string) => show(toggleWrap(...read(marked), "*"));

  it("wraps the selection and takes the wrap off again", () => {
    expect(bold("a <word> b")).toBe("a **<word>** b");
    expect(bold("a **<word>** b")).toBe("a <word> b");
    expect(bold("a <**word**> b")).toBe("a <word> b");
  });

  it("puts the pair around the caret", () => {
    expect(bold("a | b")).toBe("a **|** b");
    expect(bold("a **|** b")).toBe("a | b");
  });

  it("tells italic from bold", () => {
    expect(italic("a **<word>** b")).toBe("a ***<word>*** b");
    expect(italic("a ***<word>*** b")).toBe("a **<word>** b");
    expect(bold("a *<word>* b")).toBe("a ***<word>*** b");
    expect(italic("a *<word>* b")).toBe("a <word> b");
  });
});

describe("insertLink", () => {
  it("links the selection with the caret in the target", () => {
    expect(show(insertLink(...read("see <docs> now")))).toBe("see [docs](|) now");
  });

  it("starts an empty link with the caret in the label", () => {
    expect(show(insertLink(...read("see |")))).toBe("see [|]()");
  });
});

describe("tasks", () => {
  it("reads the marker", () => {
    expect(taskState("[ ] buy milk")).toBe("todo");
    expect(taskState("[x] buy milk")).toBe("done");
    expect(taskState("[X] buy milk")).toBe("done");
    expect(taskState("buy milk")).toBeNull();
    expect(taskState("[link](x)")).toBeNull();
    expect(taskBody("[x] buy milk")).toBe("buy milk");
  });

  it("cycles none, open, done, none", () => {
    expect(cycleTask("buy milk")).toBe("[ ] buy milk");
    expect(cycleTask("[ ] buy milk")).toBe("[x] buy milk");
    expect(cycleTask("[x] buy milk")).toBe("buy milk");
  });

  it("ticks and unticks", () => {
    expect(setTaskDone("[ ] a", true)).toBe("[x] a");
    expect(setTaskDone("[x] a", false)).toBe("[ ] a");
  });
});

describe("findTrigger", () => {
  const find = (marked: string) => {
    const [text, caret] = read(marked);
    const m = findTrigger(text, caret);
    return m ? `${m.trigger}:${m.query}` : null;
  };

  it("finds an open page or block reference", () => {
    expect(find("see [[Pro|]]")).toBe("[[:Pro");
    expect(find("see [[Project Al|")).toBe("[[:Project Al");
    expect(find("see [[|]]")).toBe("[[:");
    expect(find("as in ((abc|))")).toBe("((:abc");
  });

  it("ignores a reference that is closed before the caret", () => {
    expect(find("see [[Page]] and|")).toBeNull();
    expect(find("see [[Page]] and [[Ot|")).toBe("[[:Ot");
  });

  it("finds a tag or a command that starts a word", () => {
    expect(find("note #pro|")).toBe("#:pro");
    expect(find("#|")).toBe("#:");
    expect(find("/to|")).toBe("/:to");
    expect(find("then /|")).toBe("/:");
  });

  it("does not take a hash or slash inside a word, or one already left", () => {
    expect(find("C#|")).toBeNull();
    expect(find("and/or|")).toBeNull();
    expect(find("#tag then|")).toBeNull();
    expect(find("https://x|")).toBeNull();
  });

  it("looks at the caret's line only", () => {
    expect(find("[[open\nnext|")).toBeNull();
  });

  it("takes the trigger nearest to the caret", () => {
    expect(find("[[Page #ta|")).toBe("#:ta");
  });
});

describe("applyCompletion", () => {
  const apply = (marked: string, insert: string) => {
    const [text, caret] = read(marked);
    const match = findTrigger(text, caret);
    return match ? show(applyCompletion(text, match, insert)) : null;
  };

  it("closes a reference, reusing the brackets the pairing left", () => {
    expect(apply("see [[Pro|]] now", "Project Alpha")).toBe("see [[Project Alpha]]| now");
    expect(apply("see [[Pro|", "Project Alpha")).toBe("see [[Project Alpha]]|");
    expect(apply("as ((ab|))", "block-7")).toBe("as ((block-7))|");
  });

  it("writes a tag, bracketed when it has a space", () => {
    expect(apply("note #pr|", "project")).toBe("note #project |");
    expect(apply("note #pr| rest", "project")).toBe("note #project |rest");
    expect(apply("note #pr|", "Project Alpha")).toBe("note #[[Project Alpha]] |");
  });

  it("replaces a command with its text", () => {
    expect(apply("so /da|", "2026-11-19")).toBe("so 2026-11-19|");
  });
});
