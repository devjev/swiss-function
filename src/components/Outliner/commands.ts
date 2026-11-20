/**
 * `/` commands for the block types.
 *
 * A command changes the block it is typed in: it gives the block a type
 * (`/heading`), or, in an otherwise empty block, replaces it with one
 * (`/table`, a registered type's command). The app's own `/` entries, from
 * `completions`, are listed before these.
 */

import { setHeading } from "./blocks";
import type { PastedBlock } from "./clipboard";
import type { OutlinerBlockType } from "./types";

export interface CommandResult {
  text: string;
  /** Where the caret goes; the end of the text when omitted. */
  caret?: number;
  /** Blocks to put under the block, first. */
  children?: PastedBlock[];
}

export interface BlockCommand {
  label: string;
  description: string;
  /** Further words the command answers to. */
  keywords?: string;
  /** Offered only in a block with no other text: the command replaces it. */
  whenEmpty?: boolean;
  /** `text` is the block's text without the `/query`. */
  apply: (text: string) => CommandResult;
}

const leaf = (content: string, children: PastedBlock[] = []): PastedBlock => ({
  content,
  children,
});

const BUILT_IN: BlockCommand[] = [
  ...([1, 2, 3] as const).map(
    (level): BlockCommand => ({
      label: `Heading ${level}`,
      description: `${"#".repeat(level)} `,
      keywords: `h${level}`,
      apply: (text) => ({ text: setHeading(text.replace(/^#{1,3} /, ""), level).text }),
    }),
  ),
  {
    label: "Task",
    description: "[ ] ",
    keywords: "todo checkbox",
    apply: (text) => ({ text: `[ ] ${text}` }),
  },
  {
    label: "Numbered list",
    description: "1. ",
    keywords: "ordered",
    apply: (text) => ({ text: `1. ${text}` }),
  },
  { label: "Quote", description: "> ", apply: (text) => ({ text: `> ${text}` }) },
  {
    label: "Note",
    description: "> [!note]",
    keywords: "callout info",
    apply: (text) => ({ text: `> [!note] ${text}` }),
  },
  {
    label: "Warning",
    description: "> [!warning]",
    keywords: "callout",
    apply: (text) => ({ text: `> [!warning] ${text}` }),
  },
  {
    label: "Code block",
    description: "A fenced block",
    keywords: "fence",
    whenEmpty: true,
    apply: () => ({ text: "```\n\n```", caret: 4 }),
  },
  {
    label: "Divider",
    description: "---",
    keywords: "rule line",
    whenEmpty: true,
    apply: () => ({ text: "---" }),
  },
  {
    label: "Table",
    description: "Rows from the child blocks",
    whenEmpty: true,
    apply: () => ({
      text: "{{table}}",
      children: [leaf("Column 1", [leaf("Column 2")]), leaf("", [leaf("")])],
    }),
  },
  {
    label: "Board",
    description: "Columns and cards from the child blocks",
    keywords: "kanban",
    whenEmpty: true,
    apply: () => ({
      text: "{{kanban}}",
      children: [leaf("To do"), leaf("Doing"), leaf("Done")],
    }),
  },
  {
    label: "Embed",
    description: "Another block, shown here",
    whenEmpty: true,
    // The caret lands between the inner brackets, for the block's id.
    apply: () => ({ text: "{{embed (())}}", caret: 10 }),
  },
];

/** The commands on offer: the built-in ones, then one per registered block
 *  type that declares a command. */
export function blockCommands(types: readonly OutlinerBlockType[] | undefined): BlockCommand[] {
  const custom = (types ?? []).flatMap((type): BlockCommand[] =>
    type.command
      ? [
          {
            label: type.command.label,
            description: type.command.description ?? "",
            keywords: type.name,
            whenEmpty: true,
            apply: () => ({ text: type.command?.insert ?? "" }),
          },
        ]
      : [],
  );
  return [...BUILT_IN, ...custom];
}

/** The commands that answer to `query` in a block whose other text is `rest`:
 *  those with a word (of the label or the keywords) that starts with it. */
export function matchCommands(
  commands: BlockCommand[],
  query: string,
  rest: string,
): BlockCommand[] {
  const q = query.toLowerCase();
  const empty = rest.trim() === "";
  return commands.filter((command) => {
    if (command.whenEmpty && !empty) return false;
    const words = `${command.label} ${command.keywords ?? ""}`.toLowerCase().split(/\s+/);
    return (
      q === "" || command.label.toLowerCase().startsWith(q) || words.some((w) => w.startsWith(q))
    );
  });
}
