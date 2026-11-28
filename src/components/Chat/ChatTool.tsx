import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef, useContext, useMemo, useState } from "react";
import { cx } from "../../lib/cx";
import { Glyph } from "../../lib/icons";
import { Check, X } from "../Icon";
import { Spinner } from "../Spinner";
import { ChatExpandContext, ChatVariantContext } from "./ChatExpand";
import styles from "./ChatTool.module.css";

export type ChatToolStatus = "running" | "done" | "error";

export interface ChatToolProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** The call's name, printed bold: `read`, `grep`, `$` for a shell command. */
  name: ReactNode;
  /** The rest of the call line: a path, a command, the arguments. */
  args?: ReactNode;
  /** `running` shows the spinner, `error` the failure mark. Default `"done"`. */
  status?: ChatToolStatus;
  /** The tool's text output. Cut to `lines` while collapsed. */
  output?: string;
  /** Which end of a long output stays in view while collapsed: `"tail"` (the
   *  last lines, as for a command's log; the default) or `"head"`. */
  truncate?: "tail" | "head";
  /** Lines shown while collapsed. Default 5 for a tail, 10 for a head. In a
   *  chat's log view a collapsed output is always one line. */
  lines?: number;
  /** A closing line under the output: `Took 2.9s`, `exit 1`. */
  note?: ReactNode;
  /** The failure message, printed as `Error: …` in the danger colour. */
  error?: ReactNode;
  /** Start expanded. Inside a `Chat`, Ctrl+O then drives every block. */
  defaultExpanded?: boolean;
  /** A body of the host's own under the output (a diff, a table). */
  children?: ReactNode;
}

const plural = (n: number) => (n === 1 ? "line" : "lines");

/** A tool call in a chat transcript, as a terminal agent prints one: a band
 *  with the call on its first line, the output under it cut to its last lines,
 *  and a closing note. The band is neutral; only a failure takes a colour (a
 *  leading rule and the message in the danger tone). A long output expands on
 *  its marker line, and inside a `Chat` Ctrl+O expands every block at once. */
export const ChatTool = forwardRef<HTMLDivElement, ChatToolProps>(function ChatTool(
  {
    name,
    args,
    status = "done",
    output,
    truncate = "tail",
    lines,
    note,
    error,
    defaultExpanded = false,
    children,
    className,
    ...rest
  },
  ref,
) {
  const shared = useContext(ChatExpandContext);
  const log = useContext(ChatVariantContext) === "log";
  const version = shared?.version ?? 0;
  // A press on this block's own marker, valid until the transcript-wide key is
  // used again.
  const [own, setOwn] = useState<{ version: number; open: boolean } | null>(null);
  const open =
    own && own.version === version
      ? own.open
      : version > 0 && shared
        ? shared.expanded
        : defaultExpanded;

  const limit = log ? 1 : Math.max(1, lines ?? (truncate === "tail" ? 5 : 10));
  const all = useMemo(() => (output ? output.replace(/\n+$/, "").split("\n") : []), [output]);
  const hidden = Math.max(0, all.length - limit);
  const shown =
    open || hidden === 0 ? all : truncate === "tail" ? all.slice(-limit) : all.slice(0, limit);

  if (log) {
    // The log view: the call on one line with its status at the end, the
    // output folded to one line under an elbow, expanding in place.
    const keyHint = shared ? <span className={styles.keyHint}> · ctrl+o</span> : null;
    return (
      <div
        ref={ref}
        {...rest}
        className={cx(styles.log, className)}
        data-status={status}
        data-expanded={hidden > 0 ? open : undefined}
      >
        <div className={styles.logCall}>
          <span className={styles.call}>
            <span className={styles.name}>{name}</span>
            {args != null && args !== "" ? <span className={styles.args}> {args}</span> : null}
          </span>
          <span className={styles.logStatus}>
            {status === "running" ? (
              <Spinner variant="braille" label="Running" className={styles.spinner} />
            ) : (
              <span className={styles.logMark} data-mark={status} aria-hidden="true">
                {status === "error" ? (
                  <Glyph slot="fail" fallback={X} size="0.85em" />
                ) : (
                  <Glyph slot="check" fallback={Check} size="0.85em" />
                )}
              </span>
            )}
            {note != null && note !== "" ? <span className={styles.note}>{note}</span> : null}
          </span>
        </div>
        {shown.length > 0 ? (
          <div className={styles.logOutput}>
            <span className={styles.elbow} aria-hidden="true">
              └
            </span>
            <pre className={styles.logLines} data-folded={hidden > 0 && !open ? "" : undefined}>
              {/* Folded, the one line stands alone: its indent in the source
                  would only push it off the elbow. */}
              {hidden > 0 && !open ? (shown[0] ?? "").trim() : shown.join("\n")}
            </pre>
            {hidden > 0 ? (
              <button
                type="button"
                className={styles.more}
                aria-expanded={open}
                aria-label={open ? "Fold the output" : `Show ${hidden} more ${plural(hidden)}`}
                onClick={() => setOwn({ version, open: !open })}
              >
                {open ? "fold" : `+${hidden} ${plural(hidden)}`}
                {keyHint}
              </button>
            ) : null}
          </div>
        ) : null}
        {error != null && error !== "" ? (
          <div className={styles.logOutput}>
            <span className={styles.elbow} aria-hidden="true">
              └
            </span>
            <span className={styles.error}>Error: {error}</span>
          </div>
        ) : null}
        {children != null ? <div className={styles.logBody}>{children}</div> : null}
      </div>
    );
  }

  const marker =
    hidden > 0 ? (
      <button
        type="button"
        className={styles.more}
        aria-expanded={open}
        onClick={() => setOwn({ version, open: !open })}
      >
        {open
          ? `... (${all.length} ${plural(all.length)}`
          : `... (${hidden} ${truncate === "tail" ? "earlier" : "more"} ${plural(hidden)}`}
        {/* The key belongs to the transcript, and to a keyboard. */}
        {shared ? (
          <span className={styles.keyHint}>, ctrl+o to {open ? "collapse" : "expand"}</span>
        ) : null}
        {")"}
      </button>
    ) : null;

  return (
    <div
      ref={ref}
      {...rest}
      className={cx(styles.root, className)}
      data-status={status}
      data-expanded={hidden > 0 ? open : undefined}
    >
      <div className={styles.call}>
        {status === "running" ? (
          <Spinner variant="braille" label="Running" className={styles.spinner} />
        ) : null}
        <span className={styles.name}>{name}</span>
        {args != null && args !== "" ? <span className={styles.args}> {args}</span> : null}
      </div>
      {truncate === "tail" ? marker : null}
      {shown.length > 0 ? <pre className={styles.output}>{shown.join("\n")}</pre> : null}
      {truncate === "head" ? marker : null}
      {children}
      {error != null && error !== "" ? <div className={styles.error}>Error: {error}</div> : null}
      {note != null && note !== "" ? <div className={styles.note}>{note}</div> : null}
    </div>
  );
});
