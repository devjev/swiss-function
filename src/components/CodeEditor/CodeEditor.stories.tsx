import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import type { Story } from "@ladle/react";
import { useMemo, useState } from "react";
import { CodeEditor, type CodeEditorProps } from "./CodeEditor";

const JS = `// Fibonacci, memoized
const fib = (() => {
  const seen = new Map();
  return function f(n) {
    if (n < 2) return n;
    if (seen.has(n)) return seen.get(n);
    const v = f(n - 1) + f(n - 2);
    seen.set(n, v);
    return v;
  };
})();

console.log([...Array(10)].map((_, i) => fib(i)));
`;

const JSON_SRC = `{
  "name": "@tarassov-ch/swiss-function",
  "private": false,
  "sideEffects": ["**/*.css"],
  "peerDependencies": { "react": "^18 || ^19" }
}
`;

const box = { maxWidth: "calc(var(--sf-unit) * 26)" };

export const Playground: Story<Pick<CodeEditorProps, "vim" | "lineWrapping" | "readOnly">> = (
  args,
) => {
  const extensions = useMemo(() => [javascript()], []);
  return (
    <div style={box}>
      <CodeEditor defaultValue={JS} extensions={extensions} {...args} />
    </div>
  );
};
Playground.args = { vim: false, lineWrapping: false, readOnly: false };
Playground.argTypes = {
  vim: { control: { type: "boolean" } },
  lineWrapping: { control: { type: "boolean" } },
  readOnly: { control: { type: "boolean" } },
};

/** JavaScript, with the token-bound syntax theme. Toggle the app to dark mode
 *  (data-theme="dark") and the palette swaps with no code path. */
export const JavaScript: Story = () => {
  const extensions = useMemo(() => [javascript()], []);
  return (
    <div style={box}>
      <CodeEditor defaultValue={JS} extensions={extensions} />
    </div>
  );
};

/** Bring any language via `extensions` — here `@codemirror/lang-json`. */
export const Json: Story = () => {
  const extensions = useMemo(() => [json()], []);
  return (
    <div style={box}>
      <CodeEditor defaultValue={JSON_SRC} extensions={extensions} />
    </div>
  );
};

/** Opt-in Vim mode. Focus the editor and try `i`, `Esc`, `dd`, `:w`. */
export const Vim: Story = () => {
  const extensions = useMemo(() => [javascript()], []);
  return (
    <div style={box}>
      <CodeEditor defaultValue={JS} extensions={extensions} vim />
    </div>
  );
};

/** Fixed height: give the root a height and the editor fills and scrolls. */
export const FixedHeight: Story = () => {
  const extensions = useMemo(() => [javascript()], []);
  return (
    <div style={box}>
      <CodeEditor defaultValue={JS} extensions={extensions} style={{ height: 160 }} />
    </div>
  );
};

/** Read-only + soft wrap, no gutter. */
export const ReadOnly: Story = () => (
  <div style={box}>
    <CodeEditor
      defaultValue={JS}
      readOnly
      lineWrapping
      lineNumbers={false}
      extensions={useMemo(() => [javascript()], [])}
    />
  </div>
);

export const Empty: Story = () => (
  <div style={box}>
    <CodeEditor placeholder="Paste code here…" />
  </div>
);

export const Controlled: Story = () => {
  const [value, setValue] = useState(JSON_SRC);
  const extensions = useMemo(() => [json()], []);
  return (
    <div style={box}>
      <CodeEditor value={value} onChange={setValue} extensions={extensions} />
      <p style={{ fontSize: "var(--sf-font-size-sm)", marginBlockStart: "var(--sf-unit)" }}>
        {value.split("\n").length} lines · {value.length} chars
      </p>
    </div>
  );
};
