/**
 * Block types.
 *
 * A block's type is read from its markdown, the way a task is: nothing but
 * `content` says what a block is, so a type can be typed into existence and a
 * copied outline carries it as text.
 *
 * A block may lead with a list number (`1. `) and a task marker (`[ ] `), in
 * that order. Without either, its text decides the kind: a heading, a quote, a
 * callout, a divider, a code block, a property, an image, or one of the
 * `{{...}}` blocks that render their children (a table, a board) or another
 * block (an embed).
 */

import type { Bullet, BulletId, OutlinerBlockType, OutlinerValue } from "./types";

export type TaskState = "todo" | "doing" | "done" | "cancelled";
export type CalloutTone = "note" | "tip" | "warning" | "danger";
export type BlockKind =
  | "text"
  | "heading"
  | "quote"
  | "callout"
  | "divider"
  | "code"
  | "property"
  | "image"
  | "table"
  | "kanban"
  | "embed";

export interface BlockImage {
  alt: string;
  url: string;
  /** Display width in px, from `![alt|320](url)`; null for the natural width. */
  width: number | null;
}

export interface BlockInfo {
  kind: BlockKind;
  /** The block leads with a list number. */
  ordered: boolean;
  task: TaskState | null;
  /** The markdown the row renders, and where it starts in the source. */
  body: string;
  bodyStart: number;
  /** Heading level. */
  level?: 1 | 2 | 3;
  /** Callout tone. */
  tone?: CalloutTone;
  /** Property name. */
  key?: string;
  /** Embedded block id. */
  ref?: BulletId;
  image?: BlockImage;
}

const ORDERED = /^\d+\. /;
const TASK = /^\[([ xX/-])\] /;
const HEADING = /^(#{1,3}) /;
const CALLOUT = /^> \[!([a-zA-Z]+)\][ \t]*\n?/;
const DIVIDER = /^(?:-{3,}|\*{3,}|_{3,})$/;
const PROPERTY = /^([^\s:`[\]{}()][^:\n`]*)::(?: (.*)|)$/;
const IMAGE = /^!\[([^\]\n]*)\]\(([^)\s]+)\)$/;
const EMBED = /^\{\{embed:?\s*\(\(([^)\s]+)\)\)\s*\}\}$/;
const MACRO = /^\{\{(table|kanban)\}\}$/;

const TASK_STATE: Record<string, TaskState> = {
  " ": "todo",
  x: "done",
  X: "done",
  "/": "doing",
  "-": "cancelled",
};
const TASK_MARK: Record<TaskState, string> = {
  todo: "[ ] ",
  doing: "[/] ",
  done: "[x] ",
  cancelled: "[-] ",
};

const TONES: Record<string, CalloutTone> = {
  note: "note",
  info: "note",
  tip: "tip",
  success: "tip",
  important: "warning",
  warning: "warning",
  caution: "danger",
  danger: "danger",
  error: "danger",
};

export const CALLOUT_LABEL: Record<CalloutTone, string> = {
  note: "Note",
  tip: "Tip",
  warning: "Warning",
  danger: "Danger",
};

export function isOrdered(content: string): boolean {
  const code = content.charCodeAt(0);
  return code >= 48 && code <= 57 && ORDERED.test(content);
}

export function parseBlock(content: string): BlockInfo {
  let at = 0;
  const ordered = isOrdered(content);
  if (ordered) at = content.indexOf(" ") + 1;
  const mark = TASK.exec(content.slice(at));
  const task = mark ? (TASK_STATE[mark[1] as string] ?? null) : null;
  if (mark) at += mark[0].length;
  const text = { ordered, task, body: content.slice(at), bodyStart: at };
  if (at > 0) return { kind: "text", ...text };

  const trimmed = content.trim();
  if (DIVIDER.test(trimmed)) return { kind: "divider", ...text, body: "" };
  if (content.startsWith("```")) {
    const line = content.indexOf("\n");
    return { kind: "code", ...text, bodyStart: line < 0 ? content.length : line + 1 };
  }
  const heading = HEADING.exec(content);
  if (heading) {
    const marks = (heading[1] as string).length;
    return {
      kind: "heading",
      ...text,
      level: marks as 1 | 2 | 3,
      body: content.slice(marks + 1),
      bodyStart: marks + 1,
    };
  }
  const callout = CALLOUT.exec(content);
  const tone = callout ? TONES[(callout[1] as string).toLowerCase()] : undefined;
  if (callout && tone) {
    const start = callout[0].length;
    return {
      kind: "callout",
      ...text,
      tone,
      // The further lines of the quote lose their `> `.
      body: content.slice(start).replace(/^> ?/gm, ""),
      bodyStart: start,
    };
  }
  if (content.startsWith("> ")) return { kind: "quote", ...text };
  const macro = MACRO.exec(trimmed);
  if (macro) return { kind: macro[1] as "table" | "kanban", ...text, body: "" };
  const embed = EMBED.exec(trimmed);
  if (embed) return { kind: "embed", ...text, body: "", ref: embed[1] as string };
  const image = IMAGE.exec(trimmed);
  if (image) {
    const [alt = "", size] = (image[1] as string).split("|");
    const width = size && /^\d+$/.test(size.trim()) ? Number(size) : null;
    return {
      kind: "image",
      ...text,
      body: "",
      image: { alt: alt.trim(), url: image[2] as string, width },
    };
  }
  const property = PROPERTY.exec(content);
  if (property) {
    const value = property[2] ?? "";
    return {
      kind: "property",
      ...text,
      key: (property[1] as string).trim(),
      body: value,
      bodyStart: content.length - value.length,
    };
  }
  return { kind: "text", ...text };
}

// ----------------------------------------------------------------------------
// Tasks
// ----------------------------------------------------------------------------

export function taskState(content: string): TaskState | null {
  return parseBlock(content).task;
}

/** The text after the list number and the task marker. */
export function taskBody(content: string): string {
  return parseBlock(content).body;
}

function withTask(content: string, state: TaskState | null): string {
  const info = parseBlock(content);
  const lead = info.ordered ? content.slice(0, content.indexOf(" ") + 1) : "";
  const body = info.ordered || info.task ? info.body : content;
  return `${lead}${state ? TASK_MARK[state] : ""}${body}`;
}

/** Mod+Enter: no marker, open, done, no marker. A task in progress is done
 *  next; a cancelled one loses its marker. */
export function cycleTask(content: string): string {
  const state = taskState(content);
  if (state === null) return withTask(content, "todo");
  return withTask(content, state === "todo" || state === "doing" ? "done" : null);
}

/** The checkbox: open and done, either way. */
export function setTaskDone(content: string, done: boolean): string {
  return withTask(content, done ? "done" : "todo");
}

/** How many of a block's direct children are tasks, and how many of those are
 *  done. Cancelled tasks count for neither. Null when no child is a task. */
export function taskProgress(
  children: Bullet[] | undefined,
): { done: number; total: number } | null {
  let done = 0;
  let total = 0;
  for (const child of children ?? []) {
    const state = taskState(child.content);
    if (state === null || state === "cancelled") continue;
    total++;
    if (state === "done") done++;
  }
  return total > 0 ? { done, total } : null;
}

// ----------------------------------------------------------------------------
// Due dates: `@2026-11-25` anywhere in a block
// ----------------------------------------------------------------------------

export const DATE_RE = /(?<![\w@/.])@(\d{4}-\d{2}-\d{2})(?![\w-])/g;

/** Replace the first `@old` in a block with `@next`. */
export function setDate(content: string, old: string, next: string): string {
  return content.replace(`@${old}`, `@${next}`);
}

export function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// ----------------------------------------------------------------------------
// Headings and quotes (the toggle chords)
// ----------------------------------------------------------------------------

/** Make the block a heading of `level`; 0, or the level it already has, makes
 *  it plain text again. Returns the new text and how far its start moved. */
export function setHeading(content: string, level: 0 | 1 | 2 | 3): { text: string; shift: number } {
  const info = parseBlock(content);
  const plain = info.kind === "heading" ? info.body : content;
  const next = level === 0 || info.level === level ? plain : `${"#".repeat(level)} ${plain}`;
  return { text: next, shift: next.length - content.length };
}

/** Put `> ` before every line, or take it off when every line has it. */
export function toggleQuote(content: string): { text: string; shift: number } {
  const lines = content.split("\n");
  const quoted = lines.every((line) => line.startsWith("> ") || line === ">");
  const next = quoted
    ? lines.map((line) => line.replace(/^> ?/, "")).join("\n")
    : lines.map((line) => `> ${line}`).join("\n");
  return { text: next, shift: quoted ? -2 : 2 };
}

// ----------------------------------------------------------------------------
// Code blocks
// ----------------------------------------------------------------------------

export interface CodeEdit {
  text: string;
  start: number;
  end: number;
}

/** Enter in a block that is, or is about to be, a code block.
 *
 *  - On an opening fence alone (three backticks and a language, with nothing
 *    after the caret but the backtick the pairing left): the fence is closed
 *    and the caret goes on the empty line between.
 *  - Inside a fence: a line break that keeps the line's indentation.
 *
 *  Null when Enter is an ordinary split: outside a code block, or after its
 *  closing fence. */
export function codeEnter(content: string, start: number, end: number): CodeEdit | null {
  if (!content.startsWith("```")) return null;
  const before = content.slice(0, start);
  const after = content.slice(end);
  if (/^```[\w+-]*$/.test(before) && /^`*$/.test(after)) {
    return { text: `${before}\n\n\`\`\``, start: before.length + 1, end: before.length + 1 };
  }
  const closed = /\n```\s*$/.test(content);
  if (closed && end === content.length) return null;
  const lineStart = before.lastIndexOf("\n") + 1;
  const indent = lineStart === 0 ? "" : (/^[ \t]*/.exec(before.slice(lineStart))?.[0] ?? "");
  const at = start + 1 + indent.length;
  return { text: `${before}\n${indent}${after}`, start: at, end: at };
}

/** Tab in a code block: two spaces at the caret. */
export function codeTab(content: string, start: number, end: number): CodeEdit {
  return {
    text: `${content.slice(0, start)}  ${content.slice(end)}`,
    start: start + 2,
    end: start + 2,
  };
}

// ----------------------------------------------------------------------------
// Numbered lists
// ----------------------------------------------------------------------------

/** The list number a new block takes after an ordered one. */
export function nextOrdered(content: string): string | null {
  if (!isOrdered(content)) return null;
  return `${Number.parseInt(content, 10) + 1}. `;
}

/** Number every run of ordered siblings 1, 2, 3. Bullets whose number is
 *  already right keep their identity, and so does a tree with nothing to fix. */
export function renumber(bullets: OutlinerValue): OutlinerValue {
  let changed = false;
  let run = 0;
  const next = bullets.map((bullet) => {
    let content = bullet.content;
    if (isOrdered(content)) {
      run++;
      const space = content.indexOf(" ");
      if (content.slice(0, space) !== `${run}.`) content = `${run}. ${content.slice(space + 1)}`;
    } else {
      run = 0;
    }
    const children = bullet.children ? renumber(bullet.children) : undefined;
    if (content === bullet.content && children === bullet.children) return bullet;
    changed = true;
    return { ...bullet, content, ...(children ? { children } : null) };
  });
  return changed ? next : bullets;
}

// ----------------------------------------------------------------------------
// Properties, tables, images
// ----------------------------------------------------------------------------

/** A block's properties: its direct children written `key:: value`. */
export function blockProperties(bullet: Bullet): Record<string, string> {
  const out: Record<string, string> = {};
  for (const child of bullet.children ?? []) {
    const info = parseBlock(child.content);
    if (info.kind === "property" && info.key) out[info.key] = info.body;
  }
  return out;
}

export interface TableCell {
  /** The block the cell shows. */
  id: BulletId;
  content: string;
}

/** A table block's children as rows of cells: a row's own text is its first
 *  cell, its children the others. The first row is the header. */
export function tableRows(children: Bullet[] | undefined): TableCell[][] {
  return (children ?? []).map((row) => [
    { id: row.id, content: row.content },
    ...(row.children ?? []).map((cell) => ({ id: cell.id, content: cell.content })),
  ]);
}

/** An image block's markdown with a display width (null takes it off). */
export function imageSource(image: BlockImage, width: number | null): string {
  const alt = width === null ? image.alt : `${image.alt}|${Math.round(width)}`;
  return `![${alt}](${image.url})`;
}

// ----------------------------------------------------------------------------
// Registered block types
// ----------------------------------------------------------------------------

const MACRO_CALL = /^\{\{([\w-]+)(?::?\s+([\s\S]*?))?\s*\}\}$/;
const FENCE = /^```([\w+-]*)[^\n]*\n([\s\S]*?)\n?```\s*$/;

/** The body of a fenced block and its language; null when the text is not one
 *  closed fence. */
export function fenceBody(content: string): { language: string; body: string } | null {
  const fence = FENCE.exec(content);
  return fence ? { language: fence[1] ?? "", body: fence[2] ?? "" } : null;
}

/** A fenced block's markdown. */
export function fenceSource(language: string, body: string): string {
  return `\`\`\`${language}\n${body}\n\`\`\``;
}

/** The registered type a block is, with what it matched; null for none. */
export function matchBlockType(
  types: readonly OutlinerBlockType[],
  content: string,
): { type: OutlinerBlockType; source: string } | null {
  const trimmed = content.trim();
  const macro = MACRO_CALL.exec(trimmed);
  const fence = fenceBody(content);
  for (const type of types) {
    const named = (name: string | undefined) =>
      name !== undefined && (name === type.name || (type.aliases?.includes(name) ?? false));
    const how = type.match ?? "macro";
    if (how === "macro") {
      if (macro && named(macro[1])) return { type, source: macro[2] ?? "" };
    } else if (how === "fence") {
      if (fence && named(fence.language)) return { type, source: fence.body };
    } else {
      const source = how(content);
      if (source !== null) return { type, source };
    }
  }
  return null;
}
