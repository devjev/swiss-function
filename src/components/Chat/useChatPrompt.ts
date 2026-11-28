import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChatChoice } from "./ChatChoices";
import type { ChatPrompt } from "./ChatPrompt";

export interface ChatPromptOptions {
  /** Lines under the title. */
  message?: ReactNode;
}

export interface UseChatPrompt {
  /** Pass to `Chat`'s `prompt`. `null` while nothing is asked. */
  prompt: ChatPrompt | null;
  /** Ask for one of `options`; resolves with its id, or `undefined` when
   *  cancelled. */
  select: (
    title: ReactNode,
    options: ChatChoice[],
    opts?: ChatPromptOptions & { rows?: number },
  ) => Promise<string | undefined>;
  /** Ask yes or no; resolves `false` when cancelled. */
  confirm: (
    title: ReactNode,
    opts?: ChatPromptOptions & { yesLabel?: string; noLabel?: string; defaultAnswer?: boolean },
  ) => Promise<boolean>;
  /** Ask for a line of text; resolves with it, or `undefined` when
   *  cancelled. */
  input: (
    title: ReactNode,
    opts?: ChatPromptOptions & { placeholder?: string; defaultValue?: string },
  ) => Promise<string | undefined>;
  /** Show the host's own content in the editor's place; resolves when
   *  `close` is called (with what it was given) or on Escape (`undefined`). */
  custom: <T = unknown>(
    content: (close: (value?: T) => void) => ReactNode,
    opts?: ChatPromptOptions & { title?: ReactNode },
  ) => Promise<T | undefined>;
  /** Withdraw the open prompt, as if cancelled. */
  cancel: () => void;
}

/** Ask the user from code, as an agent's tool does: each call shows a prompt
 *  in the chat's editor slot and resolves with the answer.
 *
 *  ```tsx
 *  const ui = useChatPrompt();
 *  <Chat prompt={ui.prompt} … />
 *  if (await ui.confirm("Delete the branch?")) …
 *  ```
 *
 *  A new question withdraws the open one (it resolves as cancelled), and so
 *  does unmounting. */
export function useChatPrompt(): UseChatPrompt {
  const [prompt, setPrompt] = useState<ChatPrompt | null>(null);
  // The open question's way out: settles its promise as cancelled.
  const pending = useRef<(() => void) | null>(null);
  const serial = useRef(0);

  const open = useCallback(
    <T>(
      build: (answer: (value: T) => void, cancel: () => void, id: string) => ChatPrompt,
      cancelled: T,
    ) =>
      new Promise<T>((resolve) => {
        pending.current?.();
        const id = `chat-prompt-${++serial.current}`;
        let done = false;
        const finish = (value: T) => {
          if (done) return;
          done = true;
          if (pending.current === withdraw) pending.current = null;
          setPrompt((now) => (now?.id === id ? null : now));
          resolve(value);
        };
        const withdraw = () => finish(cancelled);
        pending.current = withdraw;
        setPrompt(build(finish, withdraw, id));
      }),
    [],
  );

  useEffect(() => () => pending.current?.(), []);

  // The chat loads its prompt panel on first use. A host that asks from code
  // will ask: fetch the panel now, so the first question shows at once.
  useEffect(() => {
    void import("./ChatPrompt");
  }, []);

  const select = useCallback<UseChatPrompt["select"]>(
    (title, options, opts) =>
      open<string | undefined>(
        (answer, cancel, id) => ({
          type: "select",
          id,
          title,
          message: opts?.message,
          options,
          rows: opts?.rows,
          onAnswer: answer,
          onCancel: cancel,
        }),
        undefined,
      ),
    [open],
  );

  const confirm = useCallback<UseChatPrompt["confirm"]>(
    (title, opts) =>
      open<boolean>(
        (answer, cancel, id) => ({
          type: "confirm",
          id,
          title,
          message: opts?.message,
          yesLabel: opts?.yesLabel,
          noLabel: opts?.noLabel,
          defaultAnswer: opts?.defaultAnswer,
          onAnswer: answer,
          onCancel: cancel,
        }),
        false,
      ),
    [open],
  );

  const input = useCallback<UseChatPrompt["input"]>(
    (title, opts) =>
      open<string | undefined>(
        (answer, cancel, id) => ({
          type: "input",
          id,
          title,
          message: opts?.message,
          placeholder: opts?.placeholder,
          defaultValue: opts?.defaultValue,
          onAnswer: answer,
          onCancel: cancel,
        }),
        undefined,
      ),
    [open],
  );

  const custom = useCallback(
    <T = unknown>(
      content: (close: (value?: T) => void) => ReactNode,
      opts?: ChatPromptOptions & { title?: ReactNode },
    ) =>
      open<T | undefined>(
        (answer, cancel, id) => ({
          type: "custom",
          id,
          title: opts?.title,
          message: opts?.message,
          content: content((value) => answer(value)),
          onCancel: cancel,
        }),
        undefined,
      ),
    [open],
  ) as UseChatPrompt["custom"];

  const cancel = useCallback(() => pending.current?.(), []);

  return useMemo(
    () => ({ prompt, select, confirm, input, custom, cancel }),
    [prompt, select, confirm, input, custom, cancel],
  );
}
