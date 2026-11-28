/** The completion list of the chat's editor: where a trigger is, and what
 *  accepting an entry does to the text. Pure, so it is tested on its own. */

/** The characters that open the list. `/` is a command and counts only as
 *  the first character of the input (a command is the whole message); `@`
 *  (a file, a person) and `#` (a tag) count at the start of any word. */
export type ChatCompletionTrigger = "/" | "@" | "#";

export interface ChatCompletionMatch {
  trigger: ChatCompletionTrigger;
  /** What has been typed after the trigger, up to the caret. */
  query: string;
  /** Where the query starts (just after the trigger) and where the word the
   *  caret is in ends. Accepting an entry replaces this range. */
  from: number;
  to: number;
}

/** The trigger the caret is in, if any. The caret must be a collapsed
 *  selection; pass its offset. */
export function findChatTrigger(text: string, caret: number): ChatCompletionMatch | null {
  const head = text.slice(0, caret);
  // The rest of the word the caret is in: completing in the middle of a word
  // replaces the whole word.
  const tail = /^\S*/.exec(text.slice(caret))?.[0] ?? "";
  const command = /^\/([^\s/]*)$/.exec(head);
  if (command) {
    return { trigger: "/", query: command[1] as string, from: 1, to: caret + tail.length };
  }
  const word = /(?:^|\s)([@#])([^\s@#]*)$/.exec(head);
  if (word) {
    const query = word[2] as string;
    return {
      trigger: word[1] as ChatCompletionTrigger,
      query,
      from: caret - query.length,
      to: caret + tail.length,
    };
  }
  return null;
}

export interface ChatTextEdit {
  text: string;
  /** Where the caret goes. */
  caret: number;
}

/** Put an accepted entry in place of the query. The trigger stays (`/help`,
 *  `@src/date.ts`) and a space follows, unless the entry is `partial` (a
 *  directory on the way to a file), which leaves the caret against it so the
 *  list asks again for the next step. */
export function applyChatCompletion(
  text: string,
  match: ChatCompletionMatch,
  insert: string,
  partial = false,
): ChatTextEdit {
  const before = text.slice(0, match.from);
  const after = text.slice(match.to);
  if (partial) {
    return { text: before + insert + after, caret: before.length + insert.length };
  }
  const gap = after.startsWith(" ") ? "" : " ";
  return {
    text: before + insert + gap + after,
    caret: before.length + insert.length + 1,
  };
}

/** Take the trigger and the query out of the text, for an entry that does
 *  something instead of writing (`/clear`). `insert`, when given, goes in
 *  their place. */
export function removeChatTrigger(
  text: string,
  match: ChatCompletionMatch,
  insert = "",
): ChatTextEdit {
  const before = text.slice(0, match.from - match.trigger.length);
  let after = text.slice(match.to);
  // No double space where the word was.
  if (insert === "" && (before === "" || before.endsWith(" ")) && after.startsWith(" ")) {
    after = after.slice(1);
  }
  return { text: before + insert + after, caret: before.length + insert.length };
}

/** The first row of a list of `count` rows shown `rows` at a time, so that
 *  `index` is in view and, where the list allows, in the middle. */
export function windowStart(count: number, index: number, rows: number): number {
  if (count <= rows) return 0;
  const half = Math.floor(rows / 2);
  return Math.max(0, Math.min(index - half, count - rows));
}
