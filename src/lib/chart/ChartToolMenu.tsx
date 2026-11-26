/** The compact chart toolbar's tool key and its menu (ChartControls.tsx): the
 *  annotation tools as a named list, with the zoom commands after them for a
 *  mouse. A module of its own so that Base UI's Menu loads only for a chart
 *  whose plot is too narrow for the palette. */

import { Button } from "../../components/Button";
import { Check, ChevronDown, ZoomIn, ZoomOut } from "../../components/Icon";
import { Menu } from "../../components/Menu";
import { Glyph } from "../icons";
import type { ChartTool } from "./ChartControls";
import styles from "./ChartControls.module.css";
import type { AnnotationTool } from "./useAnnotationEditor";

export interface ChartToolMenuProps {
  tools: readonly ChartTool[];
  /** The armed tool. */
  tool: AnnotationTool;
  onPick: (tool: AnnotationTool) => void;
  /** The key's look: primary while a tool or the zoom marquee is armed. */
  variant: "primary" | "secondary";
  /** The zoom commands, listed after the tools (a mouse on a narrow plot). */
  zoom?: { armed: boolean; onArm: () => void; onZoomOut: () => void };
}

export default function ChartToolMenu({ tools, tool, onPick, variant, zoom }: ChartToolMenuProps) {
  const current = tools.find((t) => t.value === tool) ?? tools[0];
  const CurrentIcon = current?.icon;
  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <Button
            variant={variant}
            size="sm"
            aria-label={`Tool: ${current?.label ?? "Select"}`}
            title="Tools"
          />
        }
      >
        {CurrentIcon ? <CurrentIcon /> : null}
        <Glyph slot="chevronDown" fallback={ChevronDown} size="0.85em" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="start" sideOffset={4}>
          <Menu.Popup>
            {tools.map(({ value, label, icon: Icon }) => (
              <Menu.Item
                key={value}
                role="menuitemradio"
                aria-checked={tool === value}
                className={styles.menuItem}
                onClick={() => onPick(value)}
              >
                <Icon />
                <span className={styles.menuLabel}>{label}</span>
                {tool === value ? <Glyph slot="check" fallback={Check} /> : null}
              </Menu.Item>
            ))}
            {zoom ? (
              <>
                <Menu.Separator />
                <Menu.Item
                  role="menuitemcheckbox"
                  aria-checked={zoom.armed}
                  className={styles.menuItem}
                  onClick={zoom.onArm}
                >
                  <Glyph slot="zoomIn" fallback={ZoomIn} />
                  <span className={styles.menuLabel}>Zoom to a region</span>
                  {zoom.armed ? <Glyph slot="check" fallback={Check} /> : null}
                </Menu.Item>
                <Menu.Item className={styles.menuItem} onClick={zoom.onZoomOut}>
                  <Glyph slot="zoomOut" fallback={ZoomOut} />
                  <span className={styles.menuLabel}>Zoom out</span>
                </Menu.Item>
              </>
            ) : null}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
