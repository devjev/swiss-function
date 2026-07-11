/** Prose cells: markdown, display-only, not part of the reactive graph. */
import {Markdown} from "@tarassov-ch/swiss-function/markdown";
import type {CellType} from "../contract";

export const proseCellType: CellType = {
  type: "prose",
  label: "Prose",
  renderStatic: (source) => <Markdown value={source} measured />,
};
