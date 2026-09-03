import { Toggle as BaseToggle } from "@base-ui/react/toggle";
import { ToggleGroup as BaseToggleGroup } from "@base-ui/react/toggle-group";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { createContext, forwardRef, useContext } from "react";
import { cx, mergeClassName } from "../../lib/cx";
import type { ControlSurface } from "../../lib/surface";
import { curveStyle, surfaceClass } from "../../lib/surface";
import type { ButtonSize } from "../Button";
import { ButtonGroupSizeContext } from "../ButtonGroup/context";
import styles from "./ToggleGroup.module.css";

interface ToggleGroupRootProps extends ComponentPropsWithoutRef<typeof BaseToggleGroup> {
  /** Cascade a size to all items. */
  size?: ButtonSize;
  /** The face of every key: `"dish"` (default) the scoop of a keycap, `"dome"`
   *  a rounded cap, `"flat"` no ramp. Cascades to all items. */
  surface?: ControlSurface;
  /** Amplitude of the face ramp as a multiple of the system `--sf-curve`
   *  (1 = the token, 2 doubles it, 0 flattens the face). */
  curve?: number;
  children?: ReactNode;
}

const SurfaceContext = createContext<ControlSurface>("dish");

const Root = forwardRef<HTMLDivElement, ToggleGroupRootProps>(function ToggleGroupRoot(
  { size, surface = "dish", curve, style, className, children, ...rest },
  ref,
) {
  return (
    <ButtonGroupSizeContext.Provider value={size}>
      <SurfaceContext.Provider value={surface}>
        <BaseToggleGroup
          {...rest}
          ref={ref}
          style={curveStyle(curve, style)}
          className={mergeClassName(styles.root, className)}
        >
          {children}
        </BaseToggleGroup>
      </SurfaceContext.Provider>
    </ButtonGroupSizeContext.Provider>
  );
});

const sizeClass: Record<ButtonSize, string> = {
  sm: styles.sizeSm ?? "",
  md: "",
  lg: styles.sizeLg ?? "",
};

interface ToggleGroupItemProps extends ComponentPropsWithoutRef<typeof BaseToggle> {
  value: string;
}

const Item = forwardRef<HTMLButtonElement, ToggleGroupItemProps>(function ToggleGroupItem(
  { className, ...rest },
  ref,
) {
  const groupSize = useContext(ButtonGroupSizeContext) ?? "md";
  const surface = useContext(SurfaceContext);
  return (
    <BaseToggle
      {...rest}
      ref={ref}
      className={mergeClassName(
        cx(styles.item, sizeClass[groupSize], surfaceClass[surface]),
        className,
      )}
    />
  );
});

export const ToggleGroup = Object.assign(Root, { Item });
