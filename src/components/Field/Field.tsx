import { Field as BaseField } from "@base-ui/react/field";
import { Tooltip } from "@base-ui/react/tooltip";
import type { ComponentPropsWithoutRef } from "react";
import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useState,
} from "react";
import { cx, mergeClassName } from "../../lib/cx";
import { mergeRefs } from "../../lib/mergeRefs";
import { useCollapse } from "../../lib/useCollapse";
import styles from "./Field.module.css";

export type FieldOrientation = "vertical" | "horizontal";

/** Adaptive-help state shared between the root (which measures its own width)
 *  and the Help part (which switches presentation). Module-private. */
interface FieldHelpContextValue {
  collapsed: boolean;
  register: () => () => void;
}
const FieldHelpContext = createContext<FieldHelpContextValue | null>(null);

interface FieldRootProps extends ComponentPropsWithoutRef<typeof BaseField.Root> {
  /** Stack label above the control (default) or place them side-by-side. */
  orientation?: FieldOrientation;
  /** Show a `*` indicator on the Label. Visual hint only — add `required`
   *  to the control itself if you also want HTML required-validation. */
  required?: boolean;
  /** Width below which a `Field.Help` child collapses from an inline side
   *  column to a "?" tooltip trigger. `number` → `--sf-unit` multiples,
   *  `string` → any CSS length (`useCollapse` semantics). Default `24`.
   *  Inert without a Help child. */
  helpAt?: number | string;
}

const Root = forwardRef<HTMLDivElement, FieldRootProps>(function FieldRoot(
  { orientation = "vertical", required = false, helpAt = 24, className, ...rest },
  ref,
) {
  const [helpCount, setHelpCount] = useState(0);
  const hasHelp = helpCount > 0;
  const { ref: collapseRef, collapsed } = useCollapse<HTMLDivElement>({ collapseAt: helpAt });

  const register = useCallback(() => {
    setHelpCount((count) => {
      if (process.env.NODE_ENV !== "production" && count >= 1) {
        console.warn("Field: multiple Field.Help children; render exactly one.");
      }
      return count + 1;
    });
    return () => setHelpCount((count) => count - 1);
  }, []);

  const help = useMemo(
    () => ({ collapsed: hasHelp && collapsed, register }),
    [hasHelp, collapsed, register],
  );

  // Memoized so the merged callback keeps its identity across renders — the
  // collapse ref (re)installs its ResizeObserver on every identity change.
  const observedRef = useMemo(
    () => mergeRefs<HTMLDivElement>(collapseRef, ref),
    [collapseRef, ref],
  );

  return (
    <FieldHelpContext.Provider value={help}>
      <BaseField.Root
        {...rest}
        // Observe the field's width only while a Help child is registered
        // (the MenuBar idiom) — fields without Help never pay for the
        // ResizeObserver.
        ref={hasHelp ? observedRef : ref}
        data-orientation={orientation}
        data-required={required || undefined}
        data-help={hasHelp ? (collapsed ? "trigger" : "inline") : undefined}
        className={mergeClassName(styles.root, className)}
      />
    </FieldHelpContext.Provider>
  );
});

const Label = forwardRef<HTMLLabelElement, ComponentPropsWithoutRef<typeof BaseField.Label>>(
  function FieldLabel({ className, ...rest }, ref) {
    return (
      <BaseField.Label {...rest} ref={ref} className={mergeClassName(styles.label, className)} />
    );
  },
);

const Description = forwardRef<
  HTMLParagraphElement,
  ComponentPropsWithoutRef<typeof BaseField.Description>
>(function FieldDescription({ className, ...rest }, ref) {
  return (
    <BaseField.Description
      {...rest}
      ref={ref}
      className={mergeClassName(styles.description, className)}
    />
  );
});

const ErrorMessage = forwardRef<HTMLDivElement, ComponentPropsWithoutRef<typeof BaseField.Error>>(
  function FieldError({ className, ...rest }, ref) {
    return (
      <BaseField.Error {...rest} ref={ref} className={mergeClassName(styles.error, className)} />
    );
  },
);

/** "?" in the window-chrome 16px line set (Dialog/WindowArray idiom). */
const HelpIcon = () => (
  // biome-ignore lint/a11y/noSvgWithoutTitle: decorative; the button carries the label.
  <svg
    viewBox="0 0 16 16"
    width={12}
    height={12}
    fill="none"
    stroke="currentColor"
    strokeWidth={1.6}
  >
    <path d="M5.7 6a2.3 2.3 0 1 1 3.2 2.1c-.65.28-.9.66-.9 1.4v.3" strokeLinecap="square" />
    <path d="M8 12.4v.01" strokeLinecap="square" />
  </svg>
);

export interface FieldHelpProps extends ComponentPropsWithoutRef<"div"> {
  /** Accessible label for the collapsed "?" trigger. Default `"Show help"`. */
  triggerLabel?: string;
}

/** Hover-open delay for the collapsed help tooltip. Deliberately shorter than
 *  Base UI's 600ms default: a "?" trigger is an explicit help affordance the
 *  pointer travels to on purpose, not a label that must not flicker in
 *  passing. */
const HELP_HOVER_DELAY_MS = 300;

/** Adaptive help text — write it once, right after the control it explains.
 *  Wide fields render it as a side column; below the root's `helpAt` it
 *  collapses to a "?" trigger with a tooltip. The text is registered as a
 *  Base UI description in BOTH modes, so the control's `aria-describedby`
 *  never breaks; the tooltip popup is a visual-only copy. Phrasing content
 *  only (it renders twice). */
const Help = forwardRef<HTMLDivElement, FieldHelpProps>(function FieldHelp(
  { children, triggerLabel = "Show help", className, ...rest },
  ref,
) {
  const ctx = useContext(FieldHelpContext);
  const register = ctx?.register;
  const collapsed = ctx?.collapsed ?? false;
  // Controlled open is load-bearing for touch: Base UI's trigger only opens
  // on mouse hover (mouseOnly) or keyboard-visible focus — a tap would
  // otherwise do nothing. Hover/focus still route through onOpenChange.
  const [open, setOpen] = useState(false);

  useLayoutEffect(() => register?.(), [register]);

  return (
    <div {...rest} ref={ref} className={cx(styles.help, className)}>
      <BaseField.Description className={cx(styles.helpText, collapsed && styles.srOnly)}>
        {children}
      </BaseField.Description>
      {collapsed ? (
        <Tooltip.Root open={open} onOpenChange={setOpen}>
          <Tooltip.Trigger
            className={styles.helpTrigger}
            aria-label={triggerLabel}
            delay={HELP_HOVER_DELAY_MS}
            closeOnClick={false}
            onClick={() => setOpen(true)}
          >
            <HelpIcon />
          </Tooltip.Trigger>
          <Tooltip.Portal>
            <Tooltip.Positioner side="top" sideOffset={4} className={styles.helpPositioner}>
              <Tooltip.Popup className={styles.helpPopup}>
                <span aria-hidden>{children}</span>
              </Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      ) : null}
    </div>
  );
});

export const Field = Object.assign(Root, { Label, Description, Error: ErrorMessage, Help });
