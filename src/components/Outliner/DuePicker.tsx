// The calendar behind a due-date chip, in its own module: DatePicker stays out
// of the Outliner's base bundle and loads with the first chip that is clicked.

import { DatePicker } from "../DatePicker";
import { Popover } from "../Popover";

export interface DuePickerProps {
  anchor: HTMLElement;
  /** ISO date, `YYYY-MM-DD`. */
  value: string;
  onPick: (date: Date) => void;
  onClose: () => void;
}

export default function DuePicker({ anchor, value, onPick, onClose }: DuePickerProps) {
  const [year, month, day] = value.split("-").map(Number) as [number, number, number];
  return (
    <Popover.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Popover.Portal>
        <Popover.Positioner anchor={anchor} side="bottom" align="start" sideOffset={4}>
          {/* The popup's first field, the date, takes the keyboard. */}
          <Popover.Popup aria-label="Due date">
            <DatePicker
              size="sm"
              clearable={false}
              value={new Date(year, month - 1, day)}
              onChange={(date) => {
                if (date) onPick(date);
              }}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
