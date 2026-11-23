/**
 * Highlights in a block's text (issue #107): `==text==` in the default
 * colour, `=={green}text==` in a named one, and `^^text^^` (Roam, Logseq)
 * read as the default. A remark transform over the parsed tree, so a
 * highlight holds bold, links, tags and inline spans.
 *
 * - A delimiter is exactly two `=` or two `^`. An opener is followed by a
 *   non-space and a closer is preceded by one: `a == b == c` stays text.
 * - Code spans and blocks are not text nodes, so their delimiters stay.
 * - A highlight opens and closes among one parent's children, as emphasis
 *   does: `==a **b== c**` stays text. Highlights do not nest.
 * - `{name}` right after `==` is read for the six colour names only; any
 *   other `{word}` stays text inside a default highlight.
 * - `\==` is a literal `==`: the preprocess holds an escaped `=` or `^` as a
 *   private use character, which this transform turns back.
 */

/** The highlighter's colours, in the order Mod+Shift+H steps through them.
 *  The first is the default, written without a name. */
export const HIGHLIGHT_COLORS = ["yellow", "green", "blue", "pink", "orange", "purple"] as const;
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number];

const NAMED = new Set<string>(HIGHLIGHT_COLORS);
const COLOR_PREFIX = /^\{([a-z]+)\}/;

// Stand-ins for an escaped `\=` and `\^`, clear of the U+E000 range the
// one-line labels use for inline spans.
const HELD_EQUALS = "";
const HELD_CARET = "";

/** Hold the escaped delimiter characters, so the parser's own unescaping
 *  cannot turn `\==` into a highlight. `\\` stays, so `\\==` still opens. */
export function holdEscapedDelimiters(source: string): string {
  return source.replace(/\\([\\=^])/g, (whole, ch: string) =>
    ch === "=" ? HELD_EQUALS : ch === "^" ? HELD_CARET : whole,
  );
}

/** The colour a `{name}` prefix names, or null. */
export function readColorPrefix(text: string): HighlightColor | null {
  const name = COLOR_PREFIX.exec(text)?.[1];
  return name && NAMED.has(name) ? (name as HighlightColor) : null;
}

// The slice of mdast this transform touches. Local, so the published types
// do not reach for the mdast package.
interface MdNode {
  type: string;
  value?: string;
  children?: MdNode[];
  data?: { hName?: string; hProperties?: Record<string, unknown> };
}

interface Delimiter {
  child: number;
  at: number;
  kind: "=" | "^";
  canOpen: boolean;
  canClose: boolean;
}

/** The character next to a text node's edge, read from its neighbour: a
 *  text's first or last character, any other node counts as a word, and the
 *  edge of the parent as nothing. */
function neighbour(node: MdNode | undefined, side: "first" | "last"): string {
  if (!node) return "";
  if (node.type !== "text") return "x";
  const value = node.value ?? "";
  return (side === "first" ? value[0] : value[value.length - 1]) ?? "";
}

const SPACE = /\s/;
const opensBefore = (ch: string) => ch !== "" && !SPACE.test(ch);

function findDelimiters(children: MdNode[]): Delimiter[] {
  const found: Delimiter[] = [];
  children.forEach((node, child) => {
    if (node.type !== "text" || !node.value) return;
    const value = node.value;
    for (const run of value.matchAll(/=+|\^+/g)) {
      if (run[0].length !== 2) continue;
      const at = run.index;
      const next =
        at + 2 < value.length ? (value[at + 2] as string) : neighbour(children[child + 1], "first");
      const prev = at > 0 ? (value[at - 1] as string) : neighbour(children[child - 1], "last");
      found.push({
        child,
        at,
        kind: run[0][0] as "=" | "^",
        canOpen: opensBefore(next),
        canClose: opensBefore(prev),
      });
    }
  });
  return found;
}

function highlightNode(color: HighlightColor): MdNode {
  return {
    type: "highlight",
    children: [],
    data: { hName: "mark", hProperties: { dataHighlight: color } },
  };
}

/** One parent's children with each matched pair of delimiters turned into a
 *  highlight node around what stands between them. */
function wrapChildren(children: MdNode[]): MdNode[] {
  const delimiters = findDelimiters(children);
  if (delimiters.length < 2) return children;
  // Pair left to right: the first opener, then the first closer of its kind.
  const cuts = new Map<number, { at: number; open: boolean }[]>();
  let open: Delimiter | null = null;
  for (const d of delimiters) {
    if (open) {
      if (d.kind !== open.kind || !d.canClose) continue;
      for (const [cut, isOpen] of [
        [open, true],
        [d, false],
      ] as const) {
        const list = cuts.get(cut.child) ?? [];
        list.push({ at: cut.at, open: isOpen });
        cuts.set(cut.child, list);
      }
      open = null;
    } else if (d.canOpen) {
      open = d;
    }
  }
  if (cuts.size === 0) return children;

  const out: MdNode[] = [];
  let mark: MdNode | null = null;
  const emit = (node: MdNode) => {
    if (mark) mark.children?.push(node);
    else out.push(node);
  };
  children.forEach((node, child) => {
    const here = cuts.get(child);
    if (!here) {
      emit(node);
      return;
    }
    const value = node.value ?? "";
    let from = 0;
    for (const cut of here.sort((a, b) => a.at - b.at)) {
      if (cut.at > from) emit({ type: "text", value: value.slice(from, cut.at) });
      from = cut.at + 2;
      if (cut.open) {
        const named = value[cut.at] === "=" ? readColorPrefix(value.slice(from)) : null;
        if (named) from += named.length + 2;
        mark = highlightNode(named ?? HIGHLIGHT_COLORS[0]);
        out.push(mark);
      } else {
        mark = null;
      }
    }
    if (from < value.length) emit({ type: "text", value: value.slice(from) });
  });
  return out;
}

function wrapTree(node: MdNode): void {
  if (!node.children) return;
  node.children = wrapChildren(node.children);
  // Highlights do not nest: what stands inside one is not scanned again.
  for (const child of node.children) if (child.type !== "highlight") wrapTree(child);
}

function restoreHeld(node: MdNode): void {
  if (typeof node.value === "string" && /[]/.test(node.value)) {
    // In text the escape was spent by the parser; code keeps its backslash.
    const code = node.type !== "text";
    node.value = node.value
      .replaceAll(HELD_EQUALS, code ? "\\=" : "=")
      .replaceAll(HELD_CARET, code ? "\\^" : "^");
  }
  node.children?.forEach(restoreHeld);
}

/** The remark plugin: wraps highlights, then gives back the held escapes. */
export function remarkHighlight() {
  return (tree: MdNode) => {
    wrapTree(tree);
    restoreHeld(tree);
  };
}

/** The remark plugins an outline's markdown renders with: a stable array, so
 *  `Markdown` can skip re-parsing an unchanged block. */
export const OUTLINER_REMARK_PLUGINS = [remarkHighlight];

// ----------------------------------------------------------------------------
// The same reading over raw text, for editing (Mod+Shift+H)
// ----------------------------------------------------------------------------

/** A highlight in one line of a block's source: from its opener to past its
 *  closer, with the opener's length (`==`, `=={green}`, `^^`). */
export interface HighlightSpan {
  from: number;
  to: number;
  opener: number;
  kind: "=" | "^";
  color: HighlightColor;
}

/** The highlights in one line of source, by the transform's rules: exactly
 *  two delimiter characters, a word on the inside, code spans and escapes
 *  skipped, the first closer of the opener's kind. */
export function findHighlights(line: string): HighlightSpan[] {
  const delimiters: { at: number; kind: "=" | "^"; canOpen: boolean; canClose: boolean }[] = [];
  let at = 0;
  while (at < line.length) {
    const ch = line[at] as string;
    if (ch === "\\") {
      at += 2;
      continue;
    }
    let run = 1;
    while (line[at + run] === ch) run++;
    if (ch === "`") {
      const close = line.indexOf("`".repeat(run), at + run);
      at = close === -1 ? at + run : close + run;
      continue;
    }
    if ((ch === "=" || ch === "^") && run === 2) {
      delimiters.push({
        at,
        kind: ch,
        canOpen: opensBefore(line[at + 2] ?? ""),
        canClose: opensBefore(line[at - 1] ?? ""),
      });
    }
    at += run;
  }
  const spans: HighlightSpan[] = [];
  let open: (typeof delimiters)[number] | null = null;
  for (const d of delimiters) {
    if (open) {
      if (d.kind !== open.kind || !d.canClose) continue;
      const named = open.kind === "=" ? readColorPrefix(line.slice(open.at + 2)) : null;
      spans.push({
        from: open.at,
        to: d.at + 2,
        opener: 2 + (named ? named.length + 2 : 0),
        kind: open.kind,
        color: named ?? HIGHLIGHT_COLORS[0],
      });
      open = null;
    } else if (d.canOpen) {
      open = d;
    }
  }
  return spans;
}

/** The opener that writes `color`: the default goes without a name. */
export function highlightOpener(color: HighlightColor): string {
  return color === HIGHLIGHT_COLORS[0] ? "==" : `=={${color}}`;
}
