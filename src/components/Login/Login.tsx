/** Login — a compact, terminal-styled sign-in panel. A dithered title bar, an
 *  identifier and a password field (monospace, DOS block caret, a mono show/hide
 *  toggle), a terminal error line, and slots for a footer and for other auth
 *  methods. Self-contained: it holds the field state and reports the values on
 *  submit; the authentication itself is yours.
 */

import type { FormEvent, HTMLAttributes, ReactNode } from "react";
import { forwardRef, useId, useState } from "react";
import { cx } from "../../lib/cx";
import { Button } from "../Button";
import { Input } from "../Input";
import { Spinner } from "../Spinner";
import styles from "./Login.module.css";

export interface LoginCredentials {
  /** The username or email typed into the identifier field. */
  identifier: string;
  /** The password. */
  password: string;
}

export interface LoginProps extends Omit<HTMLAttributes<HTMLFormElement>, "onSubmit" | "title"> {
  /** Title shown in the dithered bar. Default `"Sign in"`. */
  title?: ReactNode;
  /** Called with the typed credentials on submit (Enter or the button). The
   *  authentication is yours; drive `loading` and `error` from its result. */
  onSubmit?: (credentials: LoginCredentials) => void;
  /** Identifier field label. Default `"User"`. */
  identifierLabel?: ReactNode;
  /** Identifier input type. `"email"` sets an email keyboard and validation.
   *  Default `"text"`. */
  identifierType?: "text" | "email";
  /** Password field label. Default `"Password"`. */
  passwordLabel?: ReactNode;
  /** Submit button label. Default `"Sign in"`. */
  submitLabel?: ReactNode;
  /** A failed-sign-in message, rendered as a terminal error line (`role="alert"`). */
  error?: ReactNode;
  /** Authenticating: the fields and button disable and the button shows a
   *  spinner. Drive it from your submit handler. */
  loading?: boolean;
  /** Slot below the form: secondary links such as "forgot password". */
  footer?: ReactNode;
  /** Slot for other auth methods (passkey, OAuth), rendered below a dithered
   *  "or" divider. You supply the buttons. */
  alternatives?: ReactNode;
}

export const Login = forwardRef<HTMLFormElement, LoginProps>(function Login(
  {
    title = "Sign in",
    onSubmit,
    identifierLabel = "User",
    identifierType = "text",
    passwordLabel = "Password",
    submitLabel = "Sign in",
    error,
    loading = false,
    footer,
    alternatives,
    className,
    ...rest
  },
  ref,
) {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [reveal, setReveal] = useState(false);
  const errorId = useId();
  const identifierId = useId();
  const passwordId = useId();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;
    onSubmit?.({ identifier, password });
  };

  return (
    <form
      {...rest}
      ref={ref}
      className={cx(styles.root, className)}
      onSubmit={handleSubmit}
      aria-busy={loading || undefined}
    >
      <div className={styles.titlebar}>
        <span className={styles.dither} aria-hidden="true" />
        <span className={styles.title}>{title}</span>
        <span className={styles.dither} aria-hidden="true" />
      </div>

      <div className={styles.body}>
        {error != null ? (
          <p className={styles.error} role="alert" id={errorId}>
            <span className={styles.errorMark} aria-hidden="true">
              !
            </span>
            {error}
          </p>
        ) : null}

        <label className={styles.field} htmlFor={identifierId}>
          <span className={styles.label}>{identifierLabel}</span>
          <Input
            id={identifierId}
            type={identifierType}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete={identifierType === "email" ? "email" : "username"}
            disabled={loading}
            aria-invalid={error != null || undefined}
            aria-describedby={error != null ? errorId : undefined}
          />
        </label>

        <label className={styles.field} htmlFor={passwordId}>
          <span className={styles.label}>{passwordLabel}</span>
          <div className={styles.passwordRow}>
            <Input
              id={passwordId}
              type={reveal ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={loading}
              className={styles.passwordInput}
              aria-invalid={error != null || undefined}
              aria-describedby={error != null ? errorId : undefined}
            />
            <button
              type="button"
              className={styles.reveal}
              onClick={() => setReveal((v) => !v)}
              aria-pressed={reveal}
              aria-label={reveal ? "Hide password" : "Show password"}
              disabled={loading}
            >
              {reveal ? "hide" : "show"}
            </button>
          </div>
        </label>

        <Button type="submit" variant="primary" className={styles.submit} disabled={loading}>
          {loading ? (
            <>
              <Spinner variant="braille" /> authenticating…
            </>
          ) : (
            submitLabel
          )}
        </Button>

        {footer != null ? <div className={styles.footer}>{footer}</div> : null}

        {alternatives != null ? (
          <>
            <div className={styles.divider} aria-hidden="true">
              <span className={styles.dividerLabel}>or</span>
            </div>
            <div className={styles.alternatives}>{alternatives}</div>
          </>
        ) : null}
      </div>
    </form>
  );
});
