// A block shown as one plain line (the breadcrumb, a drag label, a query's
// results), and the boundary that keeps a registered type's failure in its
// place. A module of its own, so the `outliner-blocks` entry can use it
// without the outline's widgets.

import type { ReactNode } from "react";
import { Component, useContext } from "react";
import { ActionsContext } from "./context";
import styles from "./Outliner.module.css";
import type { OutlinerBlockType } from "./types";
import { labelParts } from "./zoom";

/** What a registered type throws while rendering stays in its block. */
export class BlockBoundary extends Component<
  { name: string; source: string; children: ReactNode },
  { failed: string | null; source: string }
> {
  override state = { failed: null as string | null, source: this.props.source };

  static getDerivedStateFromError(error: unknown) {
    return { failed: error instanceof Error ? error.message : String(error) };
  }

  // A changed source is a new attempt.
  static getDerivedStateFromProps(
    props: { source: string },
    state: { failed: string | null; source: string },
  ) {
    return props.source === state.source ? null : { failed: null, source: props.source };
  }

  override render() {
    if (this.state.failed === null) return this.props.children;
    return (
      <span className={styles.blockRefMissing}>
        ⟨{this.props.name} failed: {this.state.failed}⟩
      </span>
    );
  }
}

// ----------------------------------------------------------------------------
// A block's text as one plain line
// ----------------------------------------------------------------------------

/** The line `plainLabel` gives, with the inline spans of `types` rendered
 *  (`$x$` as math). Null when there is nothing to show. */
export function renderLabel(
  content: string,
  types: readonly OutlinerBlockType[],
  plain = false,
): ReactNode {
  const parts = labelParts(
    content,
    types.map((type) => type.inline as NonNullable<OutlinerBlockType["inline"]>),
    plain,
  );
  if (parts.length === 0) return null;
  return parts.map((part, at) => {
    if (typeof part === "string") return part;
    const type = types[part.index] as OutlinerBlockType;
    return (
      // biome-ignore lint/suspicious/noArrayIndexKey: the parts of one line, in their order
      <BlockBoundary key={at} name={type.name} source={part.source}>
        {type.inline?.render(part.source)}
      </BlockBoundary>
    );
  });
}

/** A block's text as one plain line, the way the breadcrumb shows it: the
 *  first line without its markup, with the registered inline spans (`$x$`)
 *  rendered. For a registered block type that lists other blocks. `plain`
 *  says the text is such a line already (a path of labels). Renders `empty`
 *  when there is nothing to show. Outside an outline the spans stay text. */
export function OutlinerLabel({
  content,
  plain = false,
  empty = null,
}: {
  content: string;
  plain?: boolean;
  empty?: ReactNode;
}): ReactNode {
  const actions = useContext(ActionsContext);
  const label = actions ? actions.label(content, plain) : renderLabel(content, [], plain);
  return label ?? empty;
}
