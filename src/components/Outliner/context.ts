/**
 * What the special blocks (a table, a board, an embed, an image, a due date)
 * need from the outline they sit in. The rows are memoized and take none of
 * this as props; only the components that use it read it.
 */

import type { ComponentProps, ReactNode } from "react";
import { createContext } from "react";
import type ReactMarkdown from "react-markdown";
import type { TaskState } from "./blocks";
import type { BulletId } from "./types";

type Components = ComponentProps<typeof ReactMarkdown>["components"];

/** Stable for the life of the outline, except when one of the plain values
 *  changes. */
export interface OutlinerActions {
  readOnly: boolean;
  markdownComponents: Components;
  /** Put the caret at the end of a block, unfolding the way to it. */
  jumpTo: (id: BulletId) => void;
  /** Replace a block's text, as one undo step. */
  setContent: (id: BulletId, content: string) => void;
  /** Change a `@date` in a block. */
  setDate: (id: BulletId, old: string, next: string) => void;
  /** Move a block (with its children) under `parentId`, after `afterId`. */
  moveBlock: (id: BulletId, parentId: BulletId, afterId: BulletId | null) => void;
}

export const ActionsContext = createContext<OutlinerActions | null>(null);

/** Renders the block `id`, embedded in the block `host`. Changes with every
 *  change to the tree, so only embeds read it. */
export const EmbedContext = createContext<((id: BulletId, host: BulletId) => ReactNode) | null>(
  null,
);

/** The blocks being embedded around this outline, outermost first: empty for
 *  an outline of its own. An embed of a block already in the chain would
 *  never end. */
export const EmbedChainContext = createContext<readonly BulletId[]>([]);

/** The block a piece of rendered markdown belongs to. */
export const RowContext = createContext<{ id: BulletId; task: TaskState | null } | null>(null);
