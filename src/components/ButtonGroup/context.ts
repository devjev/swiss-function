import { createContext } from "react";
import type { ButtonSize } from "../Button";

/** Provides the group's `size` to descendant `<Button>` / `<ToggleGroup.Item>`
 *  so consumers can set it once at the group level. `undefined` = no group
 *  context (button uses its own `size` prop or default). */
export const ButtonGroupSizeContext = createContext<ButtonSize | undefined>(undefined);
