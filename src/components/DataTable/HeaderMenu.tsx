/** The headers' right-click menu, split into its own module so Base UI's
 *  context-menu is loaded lazily (only when `headerMenu` is on). Statically
 *  imported it cost every DataTable consumer ~1.8KB gzip for a feature that is
 *  off by default, and the cost rode along into every entry that pulls the
 *  table in (Notebook, Widget). Same pattern as TableInput's SortableRows.
 *
 *  It renders the header block itself, through the trigger, so the right-click
 *  region is exactly the headers and the grid structure is unchanged. */

import type { ReactNode } from "react";
import { ContextMenu } from "../ContextMenu";

export interface HeaderMenuProps {
  /** The header block element this menu triggers on; rendered as the trigger. */
  header: ReactNode;
  /** Fit the one column the right-click landed on. Absent when it landed on a
   *  group header, or on a column that cannot be resized. */
  onFitColumn?: () => void;
  /** Fit every resizable column. Absent when none can be. */
  onFitAll?: () => void;
}

export default function HeaderMenu({ header, onFitColumn, onFitAll }: HeaderMenuProps) {
  return (
    <ContextMenu.Root>
      {/* `data-header-menu` marks the armed trigger: the module is lazy, so
          there is a short window after mount where the headers render without
          it (the same window TableInput's lazy drag has). Waiting for this
          attribute is how a test, or a host, knows the menu is live. */}
      <ContextMenu.Trigger data-header-menu="" render={header as React.ReactElement} />
      <ContextMenu.Portal>
        <ContextMenu.Positioner>
          <ContextMenu.Popup>
            <ContextMenu.Item disabled={!onFitColumn} onClick={() => onFitColumn?.()}>
              Fit this column
            </ContextMenu.Item>
            <ContextMenu.Item disabled={!onFitAll} onClick={() => onFitAll?.()}>
              Fit all columns
            </ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  );
}
