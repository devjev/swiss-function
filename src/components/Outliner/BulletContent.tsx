import { type ComponentProps, type ReactNode, useContext } from "react";
import type ReactMarkdown from "react-markdown";
import { Markdown } from "../Markdown";
import { ActionsContext } from "./context";
import { passthroughUrlTransform, preprocessOutlinerMarkdown } from "./markdown-extensions";
import styles from "./Outliner.module.css";

type Components = ComponentProps<typeof ReactMarkdown>["components"];

interface BulletContentProps {
  content: string;
  components?: Components;
}

/** A block's markdown, rendered. */
export function BulletContent({ content, components }: BulletContentProps): ReactNode {
  const preprocess = useContext(ActionsContext)?.preprocess ?? preprocessOutlinerMarkdown;
  // An empty block is an empty line: the bullet marks it.
  if (content.trim() === "") return <span className={styles.blank}>{"​"}</span>;
  return (
    <Markdown
      value={content}
      preprocess={preprocess}
      components={components}
      urlTransform={passthroughUrlTransform}
    />
  );
}
