/**
 * Typing assistance inside a block's text, as pure functions over the text and
 * the selection: bracket pairing, the formatting chords, the task marker, and
 * finding and applying a completion (`[[page`, `((block`, `#tag`, `/command`).
 */

/** A change to a block's text, with the selection that follows it. */
export interface TextEdit {
  text: string;
  start: number;
  end: number;
}

// ----------------------------------------------------------------------------
// Pairs
// ----------------------------------------------------------------------------

const PAIRS: Record<string, string> = { "[": "]", "(": ")", "{": "}", "`": "`" };
/** With text selected, these wrap it instead of replacing it. */
const WRAPS: Record<string, string> = { ...PAIRS, "*": "*", _: "_", "~": "~", "^": "^", "=": "=" };
const CLOSERS = new Set(Object.values(PAIRS));

/** The one-character delimiters of the registered inline spans (`$` for
 *  math), as further pairs: opener to closer. */
export function spanPairs(
  spans: readonly { open: string; close?: string }[],
): Record<string, string> {
  const pairs: Record<string, string> = {};
  for (const { open, close = open } of spans) {
    if (open.length === 1 && close.length === 1) pairs[open] = close;
  }
  return pairs;
}

const WORD = /[\p{L}\p{N}_]/u;

/** How often `mark` stands unescaped on the caret's line before the caret. */
function countBefore(text: string, caret: number, mark: string): number {
  let count = 0;
  for (let at = text.lastIndexOf("\n", caret - 1) + 1; at < caret; at++) {
    if (text[at] === "\\") at++;
    else if (text[at] === mark) count++;
  }
  return count;
}

/** Typing in a span's delimiter (`$`), which also stands for itself in prose
 *  (a price), so it pairs with more care than a bracket. */
function pairSpan(
  text: string,
  start: number,
  typed: string,
  spans: Record<string, string>,
): TextEdit | null {
  const before = text[start - 1] ?? "";
  const after = text[start] ?? "";
  // A digit right after an opener that was just paired is a price: the closer
  // goes. (A formula that starts with a digit is closed by hand.)
  if (/\d/.test(typed) && spans[before] === after && before !== "") {
    if (countBefore(text, start, before) % 2 === 1) {
      return {
        text: text.slice(0, start) + typed + text.slice(start + 1),
        start: start + 1,
        end: start + 1,
      };
    }
    return null;
  }
  const close = spans[typed];
  if (close === undefined) return null;
  if (after === close) return { text, start: start + 1, end: start + 1 };
  // Not after a backslash or inside a word, and not in front of one.
  if (before === "\\" || WORD.test(before) || WORD.test(after)) return null;
  // With one open on the line already, this one closes it.
  if (close === typed && countBefore(text, start, typed) % 2 === 1) return null;
  return {
    text: text.slice(0, start) + typed + close + text.slice(start),
    start: start + 1,
    end: start + 1,
  };
}

/** What typing `typed` does beyond inserting it, or null when it is plain
 *  input: an opener gets its closer, a closer that is already there is stepped
 *  over, and a selection is wrapped. `spans` adds the delimiters of the
 *  registered inline spans (see `spanPairs`). */
export function pairInput(
  text: string,
  start: number,
  end: number,
  typed: string,
  spans: Record<string, string> = {},
): TextEdit | null {
  if (start !== end) {
    const close = WRAPS[typed] ?? spans[typed];
    if (close === undefined) return null;
    return {
      text: text.slice(0, start) + typed + text.slice(start, end) + close + text.slice(end),
      start: start + 1,
      end: end + 1,
    };
  }
  if (CLOSERS.has(typed) && text[start] === typed) {
    return { text, start: start + 1, end: start + 1 };
  }
  const close = PAIRS[typed];
  if (close === undefined) return pairSpan(text, start, typed, spans);
  // A parenthesis inside a word is prose ("word(s)"), not a pair.
  if (typed === "(" && start > 0 && !/[\s[\](]/.test(text[start - 1] as string)) return null;
  return {
    text: text.slice(0, start) + typed + close + text.slice(start),
    start: start + 1,
    end: start + 1,
  };
}

/** Backspace between an empty pair removes both halves. */
export function unpairBackspace(
  text: string,
  start: number,
  end: number,
  spans: Record<string, string> = {},
): TextEdit | null {
  if (start !== end || start === 0) return null;
  const open = text[start - 1] as string;
  const close = PAIRS[open] ?? spans[open];
  if (close === undefined || text[start] !== close) return null;
  return {
    text: text.slice(0, start - 1) + text.slice(start + 1),
    start: start - 1,
    end: start - 1,
  };
}

// ----------------------------------------------------------------------------
// Formatting
// ----------------------------------------------------------------------------

/** Length of the run of `ch` ending at `index` (exclusive) or starting there. */
function run(text: string, index: number, ch: string, direction: -1 | 1): number {
  let n = 0;
  for (let i = direction === -1 ? index - 1 : index; text[i] === ch; i += direction) n++;
  return n;
}

/** Whether a run of `count` marker characters carries `marker`: one or three
 *  asterisks carry the single one (italic), two or three the double (bold). */
function carries(count: number, marker: string): boolean {
  return marker.length === 1 ? count % 2 === 1 : count >= marker.length;
}

/** Wrap the selection in `marker` (`**`, `*`, `~~`), or take the marker off
 *  when it is already there. With nothing selected the pair goes in around
 *  the caret. */
export function toggleWrap(text: string, start: number, end: number, marker: string): TextEdit {
  const m = marker.length;
  const ch = marker[0] as string;
  const selected = text.slice(start, end);
  if (
    selected.length >= 2 * m &&
    carries(run(selected, 0, ch, 1), marker) &&
    carries(run(selected, selected.length, ch, -1), marker)
  ) {
    return {
      text: text.slice(0, start) + selected.slice(m, -m) + text.slice(end),
      start,
      end: end - 2 * m,
    };
  }
  if (carries(run(text, start, ch, -1), marker) && carries(run(text, end, ch, 1), marker)) {
    return {
      text: text.slice(0, start - m) + selected + text.slice(end + m),
      start: start - m,
      end: end - m,
    };
  }
  return {
    text: text.slice(0, start) + marker + selected + marker + text.slice(end),
    start: start + m,
    end: end + m,
  };
}

/** A markdown link around the selection, the caret in its target. With nothing
 *  selected the caret goes in the label. */
export function insertLink(text: string, start: number, end: number): TextEdit {
  const label = text.slice(start, end);
  const next = `${text.slice(0, start)}[${label}]()${text.slice(end)}`;
  const at = label === "" ? start + 1 : end + 3;
  return { text: next, start: at, end: at };
}

// ----------------------------------------------------------------------------
// Tasks (see blocks.ts, where every block type is read from the text)
// ----------------------------------------------------------------------------

export { cycleTask, setTaskDone, type TaskState, taskBody, taskState } from "./blocks";

// ----------------------------------------------------------------------------
// Completion
// ----------------------------------------------------------------------------

export type CompletionTrigger = "[[" | "((" | "#" | "/";

export interface CompletionMatch {
  trigger: CompletionTrigger;
  /** What has been typed after the trigger. */
  query: string;
  /** Where the query starts and ends (the caret) in the text. */
  from: number;
  to: number;
}

/** The completion the caret is in, if any: an unclosed `[[` or `((` on the
 *  caret's line, or a `#` or `/` that starts a word. The trigger nearest to the
 *  caret wins. */
export function findTrigger(text: string, caret: number): CompletionMatch | null {
  const lineStart = text.lastIndexOf("\n", caret - 1) + 1;
  const line = text.slice(lineStart, caret);
  let best: CompletionMatch | null = null;
  const offer = (trigger: CompletionTrigger, at: number) => {
    const from = lineStart + at;
    if (!best || from > best.from) {
      best = { trigger, query: text.slice(from, caret), from, to: caret };
    }
  };

  const page = line.lastIndexOf("[[");
  if (page >= 0 && !line.slice(page + 2).includes("]]")) offer("[[", page + 2);
  const block = line.lastIndexOf("((");
  if (block >= 0 && !line.slice(block + 2).includes("))")) offer("((", block + 2);
  const tag = /(?:^|\s)#([^\s#[\]()]*)$/.exec(line);
  if (tag) offer("#", line.length - (tag[1] as string).length);
  const command = /(?:^|\s)\/([^\s/]*)$/.exec(line);
  if (command) offer("/", line.length - (command[1] as string).length);
  return best;
}

/** Put the chosen completion in place of the query. A page or block reference
 *  is closed (the brackets the pairing left behind are reused), a tag with a
 *  space in it is written `#[[like this]]`, and a command replaces its slash. */
export function applyCompletion(text: string, match: CompletionMatch, insert: string): TextEdit {
  const before = text.slice(0, match.from);
  const after = text.slice(match.to);
  if (match.trigger === "[[" || match.trigger === "((") {
    const close = match.trigger === "[[" ? "]]" : "))";
    const rest = after.startsWith(close) ? after.slice(close.length) : after;
    const at = before.length + insert.length + close.length;
    return { text: before + insert + close + rest, start: at, end: at };
  }
  if (match.trigger === "#") {
    const tag = /^[\p{L}\p{N}_/-]+$/u.test(insert) ? insert : `[[${insert}]]`;
    const gap = after.startsWith(" ") ? "" : " ";
    const at = before.length + tag.length + 1;
    return { text: before + tag + gap + after, start: at, end: at };
  }
  const head = before.slice(0, -1);
  const at = head.length + insert.length;
  return { text: head + insert + after, start: at, end: at };
}
