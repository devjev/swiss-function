import { describe, expect, it } from "vitest";
import { applyChatCompletion, findChatTrigger, removeChatTrigger, windowStart } from "./completion";

describe("findChatTrigger", () => {
  it("finds a command only as the first character of the input", () => {
    expect(findChatTrigger("/he", 3)).toEqual({ trigger: "/", query: "he", from: 1, to: 3 });
    expect(findChatTrigger("/", 1)).toEqual({ trigger: "/", query: "", from: 1, to: 1 });
    expect(findChatTrigger("see /etc", 8)).toBeNull();
    expect(findChatTrigger(" /he", 4)).toBeNull();
  });

  it("closes a command at the first space", () => {
    expect(findChatTrigger("/model gpt", 10)).toBeNull();
    expect(findChatTrigger("/model gpt", 6)).toEqual({
      trigger: "/",
      query: "model",
      from: 1,
      to: 6,
    });
  });

  it("finds @ and # at the start of any word", () => {
    expect(findChatTrigger("read @src/da", 12)).toEqual({
      trigger: "@",
      query: "src/da",
      from: 6,
      to: 12,
    });
    expect(findChatTrigger("@", 1)).toEqual({ trigger: "@", query: "", from: 1, to: 1 });
    expect(findChatTrigger("tag #in", 7)).toEqual({ trigger: "#", query: "in", from: 5, to: 7 });
    expect(findChatTrigger("line\n@a", 7)).toEqual({ trigger: "@", query: "a", from: 6, to: 7 });
  });

  it("ignores a trigger inside a word", () => {
    expect(findChatTrigger("mail me@host", 12)).toBeNull();
    expect(findChatTrigger("issue#4", 7)).toBeNull();
  });

  it("covers the rest of the word after the caret", () => {
    // `@sr|c/x` with the caret after `sr`: the whole word is replaced.
    expect(findChatTrigger("@src/x and", 3)).toEqual({ trigger: "@", query: "sr", from: 1, to: 6 });
  });

  it("closes at a space", () => {
    expect(findChatTrigger("@src done", 9)).toBeNull();
  });
});

describe("applyChatCompletion", () => {
  it("keeps the trigger and adds a space", () => {
    const m = findChatTrigger("/he", 3);
    if (!m) throw new Error("no match");
    expect(applyChatCompletion("/he", m, "help")).toEqual({ text: "/help ", caret: 6 });
  });

  it("reuses a space that is already there", () => {
    const m = findChatTrigger("read @sr now", 8);
    if (!m) throw new Error("no match");
    expect(applyChatCompletion("read @sr now", m, "src/date.ts")).toEqual({
      text: "read @src/date.ts now",
      caret: 18,
    });
  });

  it("replaces the whole word the caret is in", () => {
    const m = findChatTrigger("@src/x", 3);
    if (!m) throw new Error("no match");
    expect(applyChatCompletion("@src/x", m, "src/date.ts").text).toBe("@src/date.ts ");
  });

  it("leaves a partial entry open, with no space", () => {
    const m = findChatTrigger("@sr", 3);
    if (!m) throw new Error("no match");
    const edit = applyChatCompletion("@sr", m, "src/", true);
    expect(edit).toEqual({ text: "@src/", caret: 5 });
    // The next query starts after the step.
    expect(findChatTrigger(edit.text, edit.caret)).toEqual({
      trigger: "@",
      query: "src/",
      from: 1,
      to: 5,
    });
  });
});

describe("removeChatTrigger", () => {
  it("takes a command out of the input", () => {
    const m = findChatTrigger("/clear", 6);
    if (!m) throw new Error("no match");
    expect(removeChatTrigger("/clear", m)).toEqual({ text: "", caret: 0 });
  });

  it("leaves no double space", () => {
    const m = findChatTrigger("ask #urgent now", 11);
    if (!m) throw new Error("no match");
    expect(removeChatTrigger("ask #urgent now", m).text).toBe("ask now");
  });

  it("puts the insert in its place", () => {
    const m = findChatTrigger("/date", 5);
    if (!m) throw new Error("no match");
    expect(removeChatTrigger("/date", m, "2026-11-27")).toEqual({ text: "2026-11-27", caret: 10 });
  });
});

describe("windowStart", () => {
  it("starts at 0 when everything fits", () => {
    expect(windowStart(4, 3, 5)).toBe(0);
  });

  it("keeps the index in the middle, and stops at the ends", () => {
    expect(windowStart(20, 0, 5)).toBe(0);
    expect(windowStart(20, 2, 5)).toBe(0);
    expect(windowStart(20, 3, 5)).toBe(1);
    expect(windowStart(20, 10, 5)).toBe(8);
    expect(windowStart(20, 19, 5)).toBe(15);
  });
});
