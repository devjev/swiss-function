import type { HTMLAttributes } from "react";
import { forwardRef, useState } from "react";
import { cx } from "../../lib/cx";
import { Button } from "../Button";
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

/** In-chat choice menu, styled as a terminal selection list: a caret (`›`)
 *  points at the focused option (single-select), or `[x]`/`[ ]` toggles
 *  accumulate for multi-select. Built on the `Button` component (monospace). */
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
    <ChatBlock ref={ref} {...rest} title="select" className={className}>
      {prompt ? (
        <p className={styles.prompt}>
          <span className={styles.sigil}>?</span> {prompt}
        </p>
      ) : null}
      <div className={styles.options}>
        {options.map((opt) => {
          const selected = picked.has(opt.id);
          return (
            <Button
              key={opt.id}
              type="button"
              variant="ghost"
              size="sm"
              className={cx(styles.choice, selected && styles.choiceSelected)}
              aria-pressed={multiple ? selected : undefined}
              onClick={() => toggle(opt.id)}
            >
              {multiple ? (
                <span className={cx(styles.box, selected && styles.boxOn)}>
                  {selected ? "[x]" : "[ ]"}
                </span>
              ) : (
                <span className={styles.caret}>›</span>
              )}
              <span className={styles.label}>{opt.label}</span>
              {opt.description ? <span className={styles.comment}># {opt.description}</span> : null}
            </Button>
          );
        })}
      </div>
      {multiple ? (
        <Button
          type="button"
          variant="primary"
          size="sm"
          className={styles.confirm}
          disabled={picked.size === 0}
          onClick={() => onSelect([...picked])}
        >
          Confirm
        </Button>
      ) : null}
    </ChatBlock>
  );
});
