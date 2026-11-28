import type { KeyboardEvent, ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { hitArea } from "../../lib/hitArea";
import { TextEdit } from "../TextEdit";
import styles from "./Chat.module.css";
import type { ChatChoice } from "./ChatChoices";
import { windowStart } from "./completion";

interface ChatPromptCommon {
  /** A new id starts the prompt afresh (its cursor, its text). Two prompts of
   *  one type in a row need different ids. */
  id?: string;
  /** The question, bold, on the first line. */
  title?: ReactNode;
  /** Lines under the title. */
  message?: ReactNode;
  /** Escape and the `[Cancel]` key. Without it a select or an input waits for
   *  an answer, and Escape is left to the chat (it interrupts a run). */
  onCancel?: () => void;
}

/** Pick one of a list: one option per line, `→` and the accent on the one
 *  under the cursor. */
export interface ChatSelectPrompt extends ChatPromptCommon {
  type: "select";
  options: ChatChoice[];
  /** Called with the chosen option's id. */
  onAnswer: (id: string) => void;
  /** Options shown at a time; a longer list scrolls with the cursor and shows
   *  its position (`(3/14)`). Default 10. */
  rows?: number;
}

/** Yes or no. Escape answers no when there is no `onCancel`. */
export interface ChatConfirmPrompt extends ChatPromptCommon {
  type: "confirm";
  onAnswer: (yes: boolean) => void;
  /** Default "Yes". */
  yesLabel?: string;
  /** Default "No". */
  noLabel?: string;
  /** Where the cursor starts. Default `false`: an Enter meant for the field,
   *  pressed as the prompt appears, does not confirm. */
  defaultAnswer?: boolean;
}

/** One line of text. */
export interface ChatInputPrompt extends ChatPromptCommon {
  type: "input";
  /** Called with the text as typed, on Enter. */
  onAnswer: (text: string) => void;
  placeholder?: string;
  defaultValue?: string;
}

/** The host's own content in the editor's place (a model picker, a form). */
export interface ChatCustomPrompt extends ChatPromptCommon {
  type: "custom";
  content: ReactNode;
}

export type ChatPrompt = ChatSelectPrompt | ChatConfirmPrompt | ChatInputPrompt | ChatCustomPrompt;

/** The prompt's controls, in the editor's place between its two rules. */
export function ChatPromptPanel({ prompt }: { prompt: ChatPrompt }) {
  const rootRef = useRef<HTMLFieldSetElement>(null);
  const cancel =
    prompt.onCancel ?? (prompt.type === "confirm" ? () => prompt.onAnswer(false) : undefined);
  const hasHead = prompt.title != null || prompt.message != null;

  const handleKey = (e: KeyboardEvent<HTMLFieldSetElement>) => {
    if (e.key !== "Escape" || !cancel) return;
    // Stopped here, so the chat does not also interrupt the run.
    e.preventDefault();
    e.stopPropagation();
    cancel();
  };

  // The host's own content gets the focus on the panel, so Escape reaches it.
  useEffect(() => {
    if (prompt.type === "custom") rootRef.current?.focus();
  }, [prompt.type]);

  const hints =
    prompt.type === "select" || prompt.type === "confirm"
      ? ["↑↓ choose", "enter accept"]
      : prompt.type === "input"
        ? ["enter accept"]
        : [];
  if (cancel) hints.push(`esc ${prompt.type === "confirm" && !prompt.onCancel ? "no" : "cancel"}`);
  // A confirm's No is its cancel; a key for it would say the same twice.
  const cancelKey = prompt.onCancel && prompt.type !== "confirm" ? prompt.onCancel : undefined;

  return (
    <fieldset
      ref={rootRef}
      className={styles.promptPanel}
      aria-label={typeof prompt.title === "string" ? prompt.title : "Prompt"}
      tabIndex={prompt.type === "custom" ? -1 : undefined}
      onKeyDown={handleKey}
      data-type={prompt.type}
    >
      {hasHead ? (
        <div className={styles.promptHead}>
          {prompt.title != null ? <div className={styles.promptTitle}>{prompt.title}</div> : null}
          {prompt.message != null ? (
            <div className={styles.promptMessage}>{prompt.message}</div>
          ) : null}
        </div>
      ) : null}
      <div className={styles.promptBody} data-head={hasHead || undefined}>
        {prompt.type === "select" ? (
          <PromptList
            options={prompt.options}
            initial={0}
            rows={prompt.rows ?? 10}
            onAnswer={prompt.onAnswer}
          />
        ) : prompt.type === "confirm" ? (
          <PromptList
            options={[
              { id: "yes", label: prompt.yesLabel ?? "Yes" },
              { id: "no", label: prompt.noLabel ?? "No" },
            ]}
            initial={prompt.defaultAnswer ? 0 : 1}
            rows={2}
            onAnswer={(id) => prompt.onAnswer(id === "yes")}
          />
        ) : prompt.type === "input" ? (
          <PromptInput prompt={prompt} />
        ) : (
          prompt.content
        )}
      </div>
      {hints.length > 0 || cancelKey ? (
        <div className={styles.promptKeys} data-cancel={cancelKey ? "" : undefined}>
          {cancelKey ? (
            <button
              type="button"
              className={cx(styles.promptCancel, hitArea.block)}
              onClick={cancelKey}
            >
              [<span className={styles.promptCancelLabel}>Cancel</span>]
            </button>
          ) : null}
          {hints.length > 0 ? (
            <span className={styles.promptHints}>
              {hints.map((hint, i) => (
                // A line breaks between hints, never inside one.
                <span key={hint} className={styles.promptHint}>
                  {i > 0 ? "· " : ""}
                  {hint}
                </span>
              ))}
            </span>
          ) : null}
        </div>
      ) : null}
    </fieldset>
  );
}

function PromptList({
  options,
  initial,
  rows,
  onAnswer,
}: {
  options: ChatChoice[];
  initial: number;
  rows: number;
  onAnswer: (id: string) => void;
}) {
  const count = options.length;
  const [index, setIndex] = useState(() => Math.min(initial, Math.max(0, count - 1)));
  const at = Math.min(index, Math.max(0, count - 1));
  const shown = Math.max(1, rows);
  const start = windowStart(count, at, shown);
  const buttons = useRef(new Map<number, HTMLButtonElement>());

  // The cursor is the focus: it lands on the current option when the prompt
  // appears and follows the arrows.
  useEffect(() => {
    buttons.current.get(at)?.focus();
  }, [at]);

  const handleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (count === 0) return;
    const step =
      e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowUp"
          ? -1
          : e.key === "PageDown"
            ? shown
            : e.key === "PageUp"
              ? -shown
              : 0;
    if (step !== 0) {
      e.preventDefault();
      // The arrows wrap around; the page keys stop at the ends.
      const next =
        Math.abs(step) === 1
          ? (at + step + count) % count
          : Math.max(0, Math.min(count - 1, at + step));
      setIndex(next);
    } else if (e.key === "Home" || e.key === "End") {
      e.preventDefault();
      setIndex(e.key === "Home" ? 0 : count - 1);
    }
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the arrows move the focus between the option buttons inside.
    <div className={styles.promptOptions} onKeyDown={handleKey}>
      {options.slice(start, start + shown).map((opt, i) => {
        const n = start + i;
        return (
          <button
            key={opt.id}
            ref={(el) => {
              if (el) buttons.current.set(n, el);
              else buttons.current.delete(n);
            }}
            type="button"
            className={styles.promptOption}
            tabIndex={n === at ? 0 : -1}
            data-current={n === at || undefined}
            onFocus={() => setIndex(n)}
            onClick={() => onAnswer(opt.id)}
          >
            <span className={styles.promptMarker} aria-hidden="true">
              →
            </span>
            <span className={styles.promptLabel}>{opt.label}</span>
            {opt.description ? (
              <span className={styles.promptDescription}># {opt.description}</span>
            ) : null}
          </button>
        );
      })}
      {count > shown ? (
        <div className={styles.promptCount}>
          ({at + 1}/{count})
        </div>
      ) : null}
    </div>
  );
}

function PromptInput({ prompt }: { prompt: ChatInputPrompt }) {
  const [value, setValue] = useState(prompt.defaultValue ?? "");
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }, []);
  return (
    <div className={styles.inputRow} data-send="false">
      <TextEdit
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\n/g, " "))}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            prompt.onAnswer(value);
          }
        }}
        placeholder={prompt.placeholder}
        aria-label={typeof prompt.title === "string" ? prompt.title : "Answer"}
        rows={1}
        className={styles.input}
      />
      <span className={styles.prompt} aria-hidden="true">
        &gt;
      </span>
    </div>
  );
}
