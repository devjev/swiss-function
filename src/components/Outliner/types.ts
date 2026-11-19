import type { HTMLAttributes, ReactNode, Ref } from "react";

export type BulletId = string;

export interface Bullet {
  id: BulletId;
  /** Markdown source. */
  content: string;
  /** When true, children are hidden. */
  collapsed?: boolean;
  children?: Bullet[];
}

export type OutlinerValue = Bullet[];

/** Path through the tree, expressed as indices from root to bullet. */
export type BulletPath = number[];

/** Flattened entry produced by `flatVisible`. */
export interface FlatBullet {
  id: BulletId;
  bullet: Bullet;
  depth: number;
  hasChildren: boolean;
  path: BulletPath;
  /** Position among its siblings (0-based), and how many siblings there are. */
  index: number;
  siblings: number;
  /** The number an ordered block (`1. `) shows: its place in the run of
   *  ordered siblings it is in. Null for any other block. */
  ordinal: number | null;
}

/** What opened a completion: a page reference, a block reference, a tag, or a
 *  command. */
export type OutlinerCompletionTrigger = "[[" | "((" | "#" | "/";

export interface OutlinerCompletionRequest {
  trigger: OutlinerCompletionTrigger;
  /** The text typed after the trigger. */
  query: string;
  /** The block being edited. */
  blockId: BulletId;
}

export interface OutlinerCompletion {
  /** Shown in the list. */
  label: string;
  /** A second line of detail: a path, a block's page, what a command does. */
  description?: string;
  /** Written into the block in place of the query; `label` when omitted. For
   *  `((` this is the block id, for `/` the text the command stands for. */
  insert?: string;
}

/** What is selected in the outline, as `apiRef.getSelection()` reports it. */
export interface OutlinerSelection {
  /** The selected blocks: the roots of the selection, top to bottom (a block
   *  stands for its children). Empty while the caret is in a block's text. */
  blocks: BulletId[];
  /** The block that holds the caret, with the selection in its markdown
   *  source; null when no block is being edited. */
  editing: { id: BulletId; start: number; end: number } | null;
}

/** Imperative controls exposed through `apiRef`, for a host that drives the
 *  outline from outside (a search result, a toolbar, a central hotkey layer). */
export interface OutlinerHandle {
  /** Move the keyboard into the outline: onto the block it was last on, else
   *  the first one. */
  focus: () => void;
  /** Select one block (`null` clears the selection). Unfolds its ancestors,
   *  and zooms out when the block is outside the zoomed one. */
  select: (id: BulletId | null) => void;
  /** Put the caret in a block's text at `offset` of its markdown source (the
   *  end when omitted). Reveals the block as `select` does. A no-op in
   *  read-only mode. */
  edit: (id: BulletId, offset?: number) => void;
  getSelection: () => OutlinerSelection;
  undo: () => void;
  redo: () => void;
}

export interface OutlinerProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  value: OutlinerValue;
  /** Every change to the tree: a keystroke in a block, a split, a merge, an
   *  indent, a move, a fold. Text is live, like any controlled input. */
  onChange: (next: OutlinerValue) => void;
  /** Read-only mode (no edit, no tree ops). Default false. */
  readOnly?: boolean;
  /** Mint a new bullet id when the user creates a bullet.
   *  Default: `crypto.randomUUID()`. */
  generateId?: () => BulletId;
  /** Called when user clicks a [[wiki link]]. Receives the link name. */
  onWikiLinkClick?: (name: string) => void;
  /** Resolve a ((block-id)) to its bullet content (markdown).
   *  Return null to render a "missing reference" placeholder. */
  resolveBlockRef?: (id: BulletId) => string | null;
  /** Suggestions while typing `[[`, `((`, `#` or `/` in a block: return the
   *  entries for the query (an empty list shows nothing), now or as a promise.
   *  The outline knows no pages or commands of its own; without this prop
   *  nothing pops up. */
  completions?: (
    request: OutlinerCompletionRequest,
  ) => OutlinerCompletion[] | Promise<OutlinerCompletion[]>;
  /** Files pasted or dropped into the outline: store them and return one URL
   *  per file (now or as a promise). An image becomes an image block, any
   *  other file a link. Without this prop files are ignored. */
  onUpload?: (files: File[]) => string[] | Promise<string[]>;
  /** Shown in place of the first block while the outline is empty; clicking
   *  it (or Enter on it) starts the first block. */
  placeholder?: ReactNode;
  /** The zoomed block: the outline shows it as a title and its children as
   *  the top level, under a breadcrumb of its ancestors. `null` shows the
   *  whole outline. Controlled; leave it out (or use `defaultRoot`) to let the
   *  component hold it. An id that is not in the tree shows the whole outline. */
  root?: BulletId | null;
  defaultRoot?: BulletId | null;
  /** The user zoomed: a bullet click, the zoom keys, a breadcrumb click. */
  onRootChange?: (root: BulletId | null) => void;
  /** Let the user zoom (a click on a bullet, Mod+. / Mod+, and Alt+Right /
   *  Alt+Left). Default true. `root` applies either way. */
  zoomable?: boolean;
  /** The breadcrumb's first entry, which zooms back out to the whole outline.
   *  Default "Outline". */
  rootLabel?: ReactNode;
  /** Drag a block (or the selected blocks) by its bullet to another place and
   *  depth. Default true; off in read-only mode. dnd-kit loads on demand, and
   *  the outline joins an `SfDndProvider` when one wraps it. */
  reorderable?: boolean;
  /** Render only the rows on screen, for outlines of thousands of blocks. The
   *  outline then scrolls inside itself: give it (or its parent) a height. */
  virtualized?: boolean;
  /** The border and background around the outline. Default true; `false`
   *  drops them (and the padding) when the outline sits inside a framed
   *  region or on a page of its own. */
  frame?: boolean;
  /** Imperative controls: focus, select, edit, read the selection, undo. */
  apiRef?: Ref<OutlinerHandle>;
}
