import type { Story } from "@ladle/react";
import { useState } from "react";
import { Button } from "../Button";
import { Login } from "./Login";

const center: React.CSSProperties = {
  display: "grid",
  placeItems: "center",
  padding: "calc(var(--sf-unit) * 2)",
};

export const Playground: Story = () => (
  <div style={center}>
    <Login onSubmit={() => {}} />
  </div>
);

export const WithError: Story = () => (
  <div style={center}>
    <Login error="Invalid credentials." onSubmit={() => {}} />
  </div>
);

/** `loading` disables the fields and shows a spinner in the button while your
 *  submit handler authenticates. */
export const Loading: Story = () => (
  <div style={center}>
    <Login loading onSubmit={() => {}} />
  </div>
);

/** `identifierType="email"` for an email login, with a footer slot for links. */
export const EmailWithFooter: Story = () => (
  <div style={center}>
    <Login
      identifierLabel="Email"
      identifierType="email"
      footer={<a href="#reset">Forgot password?</a>}
      onSubmit={() => {}}
    />
  </div>
);

/** The `alternatives` slot holds other auth methods below a dithered divider.
 *  You supply the buttons (passkey, SSO); the divider and framing are the panel's. */
export const WithAlternatives: Story = () => (
  <div style={center}>
    <Login
      onSubmit={() => {}}
      alternatives={
        <>
          <Button variant="secondary">Continue with a passkey</Button>
          <Button variant="secondary">Single sign-on</Button>
        </>
      }
    />
  </div>
);

/** A live example: the submit handler flips `loading`, then reports an error. */
export const Interactive: Story = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  return (
    <div style={center}>
      <Login
        loading={loading}
        error={error}
        onSubmit={(c) => {
          setError(undefined);
          setLoading(true);
          window.setTimeout(() => {
            setLoading(false);
            setError(c.password === "letmein" ? undefined : "Wrong password. Try letmein.");
          }, 900);
        }}
      />
    </div>
  );
};
