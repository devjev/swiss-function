import { createContext } from "react";

/** The transcript-wide expand state a `Chat` publishes to its tool blocks.
 *  Ctrl+O flips `expanded` and bumps `version`; a block that was toggled on
 *  its own follows the transcript again from the next version on. `version` 0
 *  means the key has not been used, so each block starts from its own
 *  `defaultExpanded`. `null` (no provider): the block is not inside a `Chat`. */
export interface ChatExpandState {
  expanded: boolean;
  version: number;
}

export const ChatExpandContext = createContext<ChatExpandState | null>(null);

/** How a `Chat` sets its transcript (see `ChatProps.variant`). Published so
 *  the blocks inside it (a tool call, a band) take the same reading, the
 *  host's own included. `null` outside a `Chat`. */
export type ChatVariant = "terminal" | "log";

export const ChatVariantContext = createContext<ChatVariant | null>(null);
