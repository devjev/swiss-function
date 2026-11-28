import type { HTMLAttributes } from "react";
import { forwardRef, useState } from "react";
import { cx } from "../../lib/cx";
import { hitArea } from "../../lib/hitArea";
import { ChatBlock } from "./ChatBlock";
import styles from "./ChatChoices.module.css";

export interface ChatChoice {
  id: string;
  label: string;
  /** Optional dim `# comment` shown after the label. */
  description?: string;
  /** Arbitrary payload a consumer may carry alongside the choice. */
  value?: unknown;
}

export interface ChatChoicesProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Optional question shown above the options. */
  prompt?: string;
  options: ChatChoice[];
  /** Allow picking several options; a Confirm button submits the set. Default
   *  single-select: clicking an option submits immediately. */
  multiple?: boolean;
  /** Fired with the picked choice id (single) or array of ids (multiple). */
  onSelect: (value: string | string[]) => void;
}

/** In-chat choice menu, set as a terminal's selection list: one option per
 *  line, an arrow (`→`) and the accent on the focused or hovered one
 *  (single-select), or `[x]`/`[ ]` toggles for multi-select with a `[Confirm]`
 *  key under them. */
export const ChatChoices = forwardRef<HTMLDivElement, ChatChoicesProps>(function ChatChoices(
  { prompt, options, multiple = false, onSelect, className, ...rest },
  ref,
) {
  const [picked, setPicked] = useState<Set<string>>(() => new Set());

  const toggle = (id: string) => {
    if (!multiple) {
      onSelect(id);
      return;
    }
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <ChatBlock ref={ref} {...rest} className={className}>
      {prompt ? (
        <p className={styles.prompt}>
          <span className={styles.sigil}>?</span> {prompt}
        </p>
      ) : null}
      <div className={styles.options}>
        {options.map((opt) => {
          const selected = picked.has(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              className={cx(styles.choice, selected && styles.choiceSelected)}
              aria-pressed={multiple ? selected : undefined}
              onClick={() => toggle(opt.id)}
            >
              {multiple ? (
                <span className={cx(styles.box, selected && styles.boxOn)}>
                  {selected ? "[x]" : "[ ]"}
                </span>
              ) : (
                <span className={styles.caret}>→</span>
              )}
              <span className={styles.label}>{opt.label}</span>
              {opt.description ? <span className={styles.comment}># {opt.description}</span> : null}
            </button>
          );
        })}
      </div>
      {multiple ? (
        <button
          type="button"
          className={cx(styles.confirm, hitArea.block)}
          disabled={picked.size === 0}
          onClick={() => onSelect([...picked])}
        >
          [<span className={styles.confirmLabel}>Confirm</span>]
        </button>
      ) : null}
    </ChatBlock>
  );
});
