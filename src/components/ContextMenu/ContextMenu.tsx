import { ContextMenu as BaseContextMenu } from "@base-ui/react/context-menu";
import { Menu } from "../Menu";

// A right-click (context) menu. Base UI's ContextMenu reuses every Menu part
// except Root and Trigger, so this component shares Menu's styled popup/items
// verbatim — there is intentionally no separate ContextMenu stylesheet. The
// Trigger marks the right-clickable region; everything else mirrors Menu.
const Root = BaseContextMenu.Root;
const Trigger = BaseContextMenu.Trigger;

export const ContextMenu = {
  Root,
  Trigger,
  Portal: Menu.Portal,
  Positioner: Menu.Positioner,
  Popup: Menu.Popup,
  Item: Menu.Item,
  Separator: Menu.Separator,
  Group: Menu.Group,
  GroupLabel: Menu.GroupLabel,
};
