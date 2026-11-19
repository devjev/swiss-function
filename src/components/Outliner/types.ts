import type { HTMLAttributes, ReactNode } from "react";

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
  /** Shown in place of the first block while the outline is empty; clicking
   *  it (or Enter on it) starts the first block. */
  placeholder?: ReactNode;
}
