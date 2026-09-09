import type { HTMLAttributes, ReactNode } from "react";
import { forwardRef, useRef, useState } from "react";
import { cx } from "../../lib/cx";
import { Glyph } from "../../lib/icons";
import { Box, type BoxElevation } from "../Box";
import { Button } from "../Button";
import { DatePicker } from "../DatePicker";
import { Dialog } from "../Dialog";
import { DigitInputMicro } from "../DigitInputMicro";
import { Sliders } from "../Icon";
import { Input } from "../Input";
import { Picker } from "../Picker";
import { Progress } from "../Progress";
import { Switch } from "../Switch";
import styles from "./Widget.module.css";
import {
  formatParamsSummary,
  paramValues,
  sameParamValue,
  type WidgetParam,
  type WidgetParamValue,
  type WidgetParamValues,
} from "./Widget.params";

export type WidgetSize = "sm" | "md";

export interface WidgetProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** The title in the header bar: the widget's identity (drag it by this). */
  title: ReactNode;
  /** The widget's input parameters, each with its current value. Up to
   *  `inlineParams` of them edit right in the header; more go behind a
   *  settings key that opens a table of them in a dialog. */
  params?: WidgetParam[];
  /** Fired with the full values map (id → value) and the ids that changed: one
   *  id from an inline edit, every edited id at once from the dialog's Apply. */
  onParamsChange?: (values: WidgetParamValues, changed: string[]) => void;
  /** How many params still edit inline in the header. Default 2. */
  inlineParams?: number;
  /** The settings key's label and the dialog's title. Default "Parameters". */
  paramsTitle?: string;
  /** Header actions at the trailing end (a remove or pop-out key). */
  actions?: ReactNode;
  /** A thin indeterminate bar under the header while the data is loading. */
  loading?: boolean;
  /** Replaces the body with an error line (`role="alert"`). */
  error?: ReactNode;
  /** `md` (default) for a reply; `sm` for a narrow shelf. */
  size?: WidgetSize;
  /** Surface depth. Default 0 (a hairline frame). */
  elevation?: BoxElevation;
  /** No body padding: for a table or chart that fills the frame. */
  flush?: boolean;
  children?: ReactNode;
}

/** One param's editor: the same control inline in the header and in the
 *  settings table. The label names the control either way (inline it is the
 *  only name; in the table the row header repeats it for sighted readers). */
function ParamControl({
  param,
  value,
  onChange,
}: {
  param: WidgetParam;
  value: WidgetParamValue;
  onChange: (value: WidgetParamValue) => void;
}) {
  const ariaLabel = param.label;
  switch (param.type) {
    case "select":
      return (
        <Picker
          items={param.options}
          value={typeof value === "string" ? value : undefined}
          onChange={onChange}
          size="sm"
          aria-label={ariaLabel}
          className={styles.select}
        />
      );
    case "date":
      return (
        <DatePicker
          value={value instanceof Date ? value : null}
          onChange={onChange}
          precision={param.precision}
          minDate={param.minDate}
          maxDate={param.maxDate}
          size="sm"
          aria-label={ariaLabel}
          className={styles.date}
        />
      );
    case "number":
      return (
        <DigitInputMicro
          value={typeof value === "number" ? value : null}
          onValueChange={onChange}
          min={param.min}
          max={param.max}
          decimals={param.decimals}
          unit={param.unit}
          slots={param.slots}
          size="sm"
          aria-label={ariaLabel}
        />
      );
    case "text":
      return (
        <Input
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={param.placeholder}
          inputSize="sm"
          aria-label={ariaLabel}
          className={styles.text}
        />
      );
    case "boolean":
      return (
        <Switch
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked)}
          aria-label={ariaLabel}
        />
      );
  }
}

/** The shell of a chat widget: a framed card with a title bar that carries the
 *  widget's input parameters. One or two params edit inline in the bar (a month
 *  picker after "Net flows"); more fold behind a settings key that opens a
 *  dialog with a table of them, applied at once. The body is yours (a `Stat`,
 *  a chart, a table); the standard widgets (`KpiWidget`, `ChartWidget`,
 *  `TableWidget`, `ProgressWidget`) fill it for the common cases. `loading`
 *  runs a thin bar under the header; `error` replaces the body. Spread
 *  `draggable` / `onDragStart` on it to make it a drag source. */
export const Widget = forwardRef<HTMLDivElement, WidgetProps>(function Widget(
  {
    title,
    params,
    onParamsChange,
    inlineParams = 2,
    paramsTitle = "Parameters",
    actions,
    loading = false,
    error,
    size = "md",
    elevation = 0,
    flush = false,
    className,
    children,
    ...rest
  },
  ref,
) {
  const list = params ?? [];
  const inline = list.length > 0 && list.length <= inlineParams;
  const behindKey = list.length > inlineParams;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WidgetParamValues>({});
  // Focus lands on the popup itself, not the first field: a focused DatePicker
  // would open its calendar over the table before the reader has seen it.
  const popupRef = useRef<HTMLDivElement>(null);

  const changeOne = (id: string, value: WidgetParamValue) => {
    onParamsChange?.({ ...paramValues(list), [id]: value }, [id]);
  };
  const openDialog = () => {
    setDraft(paramValues(list));
    setOpen(true);
  };
  const apply = () => {
    const current = paramValues(list);
    const next = { ...current, ...draft };
    const changed = list.filter((p) => !sameParamValue(current[p.id] ?? null, next[p.id] ?? null));
    onParamsChange?.(
      next,
      changed.map((p) => p.id),
    );
    setOpen(false);
  };
  const summary = behindKey ? formatParamsSummary(list) : "";

  return (
    <Box
      ref={ref}
      {...rest}
      elevation={elevation}
      padding={0}
      className={cx(styles.root, size === "sm" && styles.sm, className)}
      data-loading={loading || undefined}
    >
      <div className={styles.header}>
        <span className={styles.title}>{title}</span>
        <div className={styles.controls} data-mode={behindKey ? "summary" : "inline"}>
          {inline
            ? list.map((p) => (
                <span key={p.id} className={styles.param} title={p.label}>
                  <ParamControl param={p} value={p.value} onChange={(v) => changeOne(p.id, v)} />
                </span>
              ))
            : null}
          {behindKey ? (
            <>
              {summary ? (
                <span className={styles.summary} data-summary>
                  {summary}
                </span>
              ) : null}
              <Button
                variant="ghost"
                size="sm"
                tight
                aria-label={paramsTitle}
                title={paramsTitle}
                aria-haspopup="dialog"
                aria-expanded={open}
                onClick={openDialog}
              >
                <Glyph slot="sliders" fallback={Sliders} />
              </Button>
            </>
          ) : null}
        </div>
        {actions ? <div className={styles.actions}>{actions}</div> : null}
      </div>
      {loading ? (
        <Progress value={null} size="xs" aria-label="Loading" className={styles.loading} />
      ) : null}
      <div className={cx(styles.body, flush && styles.flush)}>
        {error != null ? (
          <div role="alert" className={styles.error}>
            {error}
          </div>
        ) : (
          children
        )}
      </div>
      {behindKey ? (
        <Dialog.Root open={open} onOpenChange={setOpen}>
          <Dialog.Portal>
            <Dialog.Backdrop />
            <Dialog.Popup ref={popupRef} initialFocus={popupRef} className={styles.dialog}>
              <Dialog.Title>{paramsTitle}</Dialog.Title>
              <table className={styles.table}>
                <tbody>
                  {list.map((p) => (
                    <tr key={p.id}>
                      <th scope="row" className={styles.rowLabel}>
                        {p.label}
                      </th>
                      <td className={styles.rowControl}>
                        <ParamControl
                          param={p}
                          value={p.id in draft ? (draft[p.id] ?? null) : p.value}
                          onChange={(v) => setDraft((d) => ({ ...d, [p.id]: v }))}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className={styles.dialogActions}>
                <Dialog.Close render={<Button variant="secondary">Cancel</Button>} />
                <Button variant="primary" onClick={apply}>
                  Apply
                </Button>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      ) : null}
    </Box>
  );
});
