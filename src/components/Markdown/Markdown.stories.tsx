import type { Story } from "@ladle/react";
import { useState } from "react";
import { Markdown } from "./Markdown";

const SAMPLE = `# Heading 1
## Heading 2

A paragraph with **bold**, *italic*, ~~strikethrough~~, and a [link](https://example.com).

- Bullet one
- Bullet two
  - Nested
- Bullet three

1. Numbered
2. List

> A blockquote.
> Spanning two lines.

Inline \`code\` and a fenced block:

\`\`\`ts
function greet(name: string) {
  return \`Hello, \${name}!\`;
}
\`\`\`

| Col A | Col B | Col C |
| ----- | ----- | ----- |
| 1     | foo   | true  |
| 2     | bar   | false |

- [x] Task done
- [ ] Task pending

---
`;

export const Rendered: Story = () => (
  <div style={{ maxWidth: "calc(var(--sf-unit) * 28)" }}>
    <Markdown value={SAMPLE} />
  </div>
);

export const Editable: Story = () => {
  const [text, setText] = useState("# Click to read.\n\n**Double-click** to edit.");
  return (
    <div style={{ maxWidth: "calc(var(--sf-unit) * 28)" }}>
      <p style={{ fontSize: "var(--sf-font-size-sm)", color: "var(--sf-color-muted)" }}>
        Double-click the content to edit. Cmd/Ctrl+Enter or click outside to commit. Esc cancels.
      </p>
      <Markdown editable value={text} onChange={setText} />
    </div>
  );
};

export const Empty: Story = () => (
  <div style={{ maxWidth: "calc(var(--sf-unit) * 24)" }}>
    <Markdown value="" placeholder="No notes — double-click to start writing." editable />
  </div>
);
