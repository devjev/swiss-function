import type { HTMLAttributes } from "react";
import { forwardRef, useState } from "react";
import { cx } from "../../lib/cx";
import styles from "./ChatChoices.module.css";

export interface ChatChoice {
  id: string;
  label: string;
  /** Optional secondary line under the label. */
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

/** In-chat choice menu: a vertical list of selectable options. Single-select
 *  submits on click; multi-select accumulates and submits via Confirm. */
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
    <div ref={ref} {...rest} className={cx(styles.root, className)}>
      {prompt ? <p className={styles.prompt}>{prompt}</p> : null}
      <div className={styles.options}>
        {options.map((opt) => {
          const selected = picked.has(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              className={cx(styles.option, selected && styles.optionSelected)}
              aria-pressed={multiple ? selected : undefined}
              onClick={() => toggle(opt.id)}
            >
              <span className={styles.optionLabel}>{opt.label}</span>
              {opt.description ? (
                <span className={styles.optionDescription}>{opt.description}</span>
              ) : null}
            </button>
          );
        })}
      </div>
      {multiple ? (
        <button
          type="button"
          className={styles.confirm}
          disabled={picked.size === 0}
          onClick={() => onSelect([...picked])}
        >
          Confirm
        </button>
      ) : null}
    </div>
  );
});
