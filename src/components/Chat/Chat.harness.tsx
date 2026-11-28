import { useState } from "react";
import { Chat, type ChatCompletion, type ChatProps } from "./Chat";
import { useChatPrompt } from "./useChatPrompt";

/** A table part whose column prints its own values. A harness because the
 *  formatter is a function nested in the message data, which a spec cannot
 *  pass across the test boundary. */
export function TableHarness() {
  return (
    <Chat
      messages={[
        {
          id: "a1",
          role: "assistant",
          parts: [
            {
              type: "table",
              caption: "Net flows",
              columns: [
                { key: "name", label: "Class" },
                { key: "net", label: "Net" },
                { key: "share", label: "Share", format: (v) => `${v}%`, align: "end" },
              ],
              rows: [
                { name: "CH A acc", net: 1284500, share: 41 },
                { name: "CH I dist", net: -190400.5, share: 26 },
              ],
            },
          ],
        },
      ]}
      onSubmit={() => {}}
    />
  );
}

const COMMANDS = ["help", "model", "rename", "clear", "compact", "export", "settings"];

const FILES: Record<string, string[]> = {
  "": ["src/", "README.md"],
  "src/": ["src/date.ts", "src/format.ts"],
};

/** A chat with completions for `/` (commands; `clear` is an action), `@`
 *  (files, answered after a delay, directories partial) and `#` (nothing).
 *  What happens is written to a log beside it. */
export function CompletionHarness({ width, working }: { width?: number; working?: boolean }) {
  const [log, setLog] = useState<string[]>([]);
  const note = (line: string) => setLog((prev) => [...prev, line]);
  const completions: ChatProps["completions"] = ({ trigger, query }) => {
    note(`ask:${trigger}${query}`);
    if (trigger === "/") {
      return COMMANDS.filter((c) => c.startsWith(query)).map(
        (c): ChatCompletion => ({
          label: c,
          description: `the ${c} command`,
          onSelect: c === "clear" ? () => note("action:clear") : undefined,
        }),
      );
    }
    if (trigger === "@") {
      const dir = query.slice(0, query.lastIndexOf("/") + 1);
      const entries = (FILES[dir] ?? []).filter((f) => f.startsWith(query));
      return new Promise((resolve) =>
        window.setTimeout(
          () =>
            resolve(
              entries.map((f) => ({
                label: f.slice(dir.length),
                insert: f,
                partial: f.endsWith("/"),
              })),
            ),
          30,
        ),
      );
    }
    return [];
  };
  return (
    <div style={{ width: width ?? 640 }}>
      <Chat
        messages={[]}
        onSubmit={(text) => note(`submit:${text}`)}
        completions={completions}
        working={working}
        onInterrupt={() => note("interrupt")}
        height={420}
      />
      <output data-testid="log">{log.join("\n")}</output>
    </div>
  );
}

const OPTIONS = Array.from({ length: 14 }, (_, i) => ({
  id: `o${i + 1}`,
  label: `Option ${i + 1}`,
  description: i === 0 ? "the first" : undefined,
}));

/** A chat whose host asks through `useChatPrompt`; keys above it start each
 *  kind of question and the answer is written beside it. */
export function PromptHarness({ working, short }: { working?: boolean; short?: boolean }) {
  const ui = useChatPrompt();
  const [answers, setAnswers] = useState<string[]>([]);
  const put = (line: string) => setAnswers((prev) => [...prev, line]);
  return (
    <div style={{ width: 640 }}>
      <div>
        <button
          type="button"
          onClick={async () => put(`select:${await ui.select("Pick", OPTIONS)}`)}
        >
          ask select
        </button>
        <button
          type="button"
          onClick={async () =>
            put(`long:${await ui.select("Pick one of many", OPTIONS, { rows: 5 })}`)
          }
        >
          ask long
        </button>
        <button
          type="button"
          onClick={async () =>
            put(`confirm:${await ui.confirm("Delete?", { message: "It cannot be undone." })}`)
          }
        >
          ask confirm
        </button>
        <button
          type="button"
          onClick={async () => put(`input:${await ui.input("Name", { defaultValue: "draft" })}`)}
        >
          ask input
        </button>
        <button
          type="button"
          onClick={async () =>
            put(
              `custom:${await ui.custom<string>((close) => (
                <button type="button" onClick={() => close("done")}>
                  finish
                </button>
              ))}`,
            )
          }
        >
          ask custom
        </button>
        <button
          type="button"
          onClick={() => {
            ui.select("First", OPTIONS).then((v) => put(`first:${v}`));
            ui.confirm("Second").then((v) => put(`second:${v}`));
          }}
        >
          ask twice
        </button>
      </div>
      <Chat
        messages={[]}
        onSubmit={(text) => put(`submit:${text}`)}
        prompt={ui.prompt}
        working={working}
        onInterrupt={() => put("interrupt")}
        height={short ? 240 : 480}
      />
      <output data-testid="answers">{answers.join("\n")}</output>
    </div>
  );
}
