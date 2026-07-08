import { Form as BaseForm } from "@base-ui/react/form";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { createContext, forwardRef, useContext, useMemo, useState } from "react";
import { cx, mergeClassName } from "../../lib/cx";
import { Field, type FieldOrientation } from "../Field";
import styles from "./Form.module.css";

/** Errors keyed by the field `name` — each surfaces in that field's error slot. */
export type FormFieldErrors = Record<string, string | string[]>;

/** What a {@link FormResolver} returns. `fields` are per-field messages keyed by
 *  `name`; `form` is a single form-level message (surfaced by `FormError`). A
 *  valid form returns `null`, `undefined`, or an empty object. */
export interface FormValidationResult {
  fields?: FormFieldErrors;
  form?: ReactNode;
}

/** Bring-your-own validation. Runs on submit (after per-field `validate` has
 *  passed) with the collected values. Return errors to block the submit, or a
 *  falsy value to let it through. Synchronous or async — the library stays
 *  headless about Zod / Valibot / react-hook-form; adapt any of them into this
 *  shape. */
export type FormResolver<Values extends Record<string, unknown> = Record<string, unknown>> = (
  values: Values,
) => FormValidationResult | null | undefined | Promise<FormValidationResult | null | undefined>;

// --- Form-level error context ----------------------------------------------

interface FormErrorContextValue {
  error: ReactNode;
}
const FormErrorContext = createContext<FormErrorContextValue>({ error: null });

// --- Root -------------------------------------------------------------------

type BaseFormProps<Values extends Record<string, unknown>> = ComponentPropsWithoutRef<
  typeof BaseForm<Values>
>;

export interface FormProps<Values extends Record<string, unknown> = Record<string, unknown>>
  extends Omit<BaseFormProps<Values>, "onSubmit" | "onFormSubmit" | "errors"> {
  /** Called with the collected values when the form passes both per-field
   *  validation and the `resolver` (if any). Return a promise to keep the
   *  submit pending. */
  onSubmit?: (values: Values) => void | Promise<void>;
  /** Whole-form / cross-field validation. See {@link FormResolver}. */
  resolver?: FormResolver<Values>;
  /** Per-field errors supplied from outside (e.g. a server response), keyed by
   *  field `name`. Merged with any errors the `resolver` produces; each clears
   *  when its field changes. */
  errors?: FormFieldErrors;
  /** A controlled form-level message (e.g. "Invalid credentials"). Surfaced by
   *  `FormError`; takes precedence over a message from the `resolver`. */
  error?: ReactNode;
  /** Ref to the underlying `<form>` element. */
  ref?: React.Ref<HTMLFormElement>;
}

/** Higher-level form built on Base UI's Form + our Field (issue #49). Manages
 *  submit, consolidated per-field errors, a bring-your-own `resolver`, and a
 *  form-level message — while staying headless about the validation library.
 *  Lay fields out by stacking `FormField`s or by wrapping them in `FieldLayout`
 *  for justified multi-column rows. Renders a `<form>`. */
export function Form<Values extends Record<string, unknown> = Record<string, unknown>>({
  onSubmit,
  resolver,
  errors: controlledErrors,
  error,
  ref,
  className,
  children,
  ...rest
}: FormProps<Values>) {
  // Field errors we push into Base UI's Form (server errors + resolver output).
  // Base UI mirrors this prop into its own state and clears a field's entry
  // when that field changes, so we only ever *set* the full map here.
  const [errors, setErrors] = useState<FormFieldErrors | undefined>(controlledErrors);
  const [resolverFormError, setResolverFormError] = useState<ReactNode>(null);

  async function handleSubmit(values: Values) {
    // A fresh attempt clears the previous form-level message.
    setResolverFormError(null);
    if (resolver) {
      const result = await resolver(values);
      const fieldErrors = result?.fields;
      const formError = result?.form ?? null;
      const hasFieldErrors = fieldErrors != null && Object.keys(fieldErrors).length > 0;
      if (hasFieldErrors || formError != null) {
        setErrors({ ...controlledErrors, ...fieldErrors });
        setResolverFormError(formError);
        return; // block the submit
      }
      // Clean pass — drop any stale resolver errors, keep server-supplied ones.
      setErrors(controlledErrors);
    }
    await onSubmit?.(values);
  }

  // Controlled `error` wins; otherwise show whatever the resolver reported.
  const contextError = error != null ? error : resolverFormError;
  const errorContext = useMemo<FormErrorContextValue>(
    () => ({ error: contextError }),
    [contextError],
  );

  // Prefer the controlled errors prop (kept in sync) over local state so a new
  // server-error object always reaches Base UI.
  const effectiveErrors = controlledErrors ?? errors;

  return (
    <FormErrorContext.Provider value={errorContext}>
      <BaseForm
        {...(rest as BaseFormProps<Values>)}
        ref={ref}
        errors={effectiveErrors}
        onFormSubmit={handleSubmit as (values: Record<string, unknown>) => void}
        className={mergeClassName(styles.root, className)}
      >
        {children}
      </BaseForm>
    </FormErrorContext.Provider>
  );
}

// --- FormField --------------------------------------------------------------

export interface FormFieldProps extends Omit<ComponentPropsWithoutRef<typeof Field>, "children"> {
  /** Identifies the field when the form is submitted and keys its error. */
  name: string;
  /** Label above (or beside) the control. */
  label?: ReactNode;
  /** Supplementary copy below the control (full-strength fg, never grey). */
  description?: ReactNode;
  /** Per-field validation. Return a message (or array) to mark invalid, `null`
   *  to pass. Runs per `validationMode`. Same signature as Base UI Field's. */
  validate?: (
    value: unknown,
    formValues: Record<string, unknown>,
  ) => string | string[] | null | Promise<string | string[] | null>;
  /** Stack label above the control (default) or place them side-by-side. */
  orientation?: FieldOrientation;
  /** The control — an `Input`, `DigitInput`, `DatePicker`, `Checkbox`, … */
  children: ReactNode;
}

/** Binds a single control to a named form field: renders the label, the
 *  control, an optional description, and the field's live error message — all
 *  wired through Base UI's Field so per-field `validate` and the form's
 *  consolidated errors surface automatically. The bound, opinionated sibling of
 *  `Field`; drop to `Field` directly when you need full control of the slots. */
export const FormField = forwardRef<HTMLDivElement, FormFieldProps>(function FormField(
  { name, label, description, validate, orientation, className, children, ...rest },
  ref,
) {
  return (
    <Field
      {...rest}
      ref={ref}
      name={name}
      validate={validate}
      orientation={orientation}
      className={className}
    >
      {label != null ? <Field.Label>{label}</Field.Label> : null}
      {children}
      {description != null ? <Field.Description>{description}</Field.Description> : null}
      <Field.Error className={styles.fieldError} />
    </Field>
  );
});

// --- FormError --------------------------------------------------------------

export interface FormErrorProps extends ComponentPropsWithoutRef<"div"> {
  /** Override the message. When omitted, shows the form-level message from the
   *  enclosing `Form` (its `error` prop or the `resolver`'s `form` output). */
  children?: ReactNode;
}

/** Surfaces a form-level message — a submit error not tied to any single field
 *  (e.g. "Invalid credentials"). Reads the message from the enclosing `Form`
 *  unless given explicit `children`. Renders nothing when there's no message. */
export const FormError = forwardRef<HTMLDivElement, FormErrorProps>(function FormError(
  { children, className, ...rest },
  ref,
) {
  const { error } = useContext(FormErrorContext);
  const message = children ?? error;
  if (message == null || message === false || message === "") {
    return null;
  }
  return (
    <div {...rest} ref={ref} role="alert" className={cx(styles.formError, className)}>
      {message}
    </div>
  );
});
