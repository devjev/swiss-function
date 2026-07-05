import { Field as BaseField } from "@base-ui/react/field";
import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";
import { mergeClassName } from "../../lib/cx";
import { Kbd } from "../Kbd";
import styles from "./Field.module.css";

export type FieldOrientation = "vertical" | "horizontal";

interface FieldRootProps extends ComponentPropsWithoutRef<typeof BaseField.Root> {
  /** Stack label above the control (default) or place them side-by-side. */
  orientation?: FieldOrientation;
  /** Show a `*` indicator on the Label. Visual hint only — add `required`
   *  to the control itself if you also want HTML required-validation. */
  required?: boolean;
  /** Advertise a "jump to this field" shortcut (issue #32): renders a `Kbd`
   *  badge in the corner and tags the field with `data-hotkey`. The component
   *  binds no key itself — the consumer's central hotkey system handles the
   *  press and calls `focusFieldHotkey(combo)` (or focuses the control itself).
   *  Uses the `Kbd` combo syntax (e.g. `"mod+k"`, `"g u"`). */
  hotkey?: string;
}

const Root = forwardRef<HTMLDivElement, FieldRootProps>(function FieldRoot(
  { orientation = "vertical", required = false, hotkey, className, children, ...rest },
  ref,
) {
  return (
    <BaseField.Root
      {...rest}
      ref={ref}
      data-orientation={orientation}
      data-required={required || undefined}
      data-hotkey={hotkey || undefined}
      className={mergeClassName(styles.root, className)}
    >
      {hotkey ? (
        <span className={styles.hotkey} aria-hidden="true">
          <Kbd combo={hotkey} />
        </span>
      ) : null}
      {children}
    </BaseField.Root>
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

export const Field = Object.assign(Root, { Label, Description, Error: ErrorMessage });
