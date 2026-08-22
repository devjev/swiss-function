import type { Story } from "@ladle/react";
import { useState } from "react";
import { LaunchButton } from "./LaunchButton";

export const Default: Story = () => (
  <LaunchButton onClick={() => console.log("fired")}>Launch</LaunchButton>
);

export const GuardLabel: Story = () => (
  <LaunchButton guardLabel="ARM" onClick={() => console.log("fired")}>
    Launch
  </LaunchButton>
);

export const PrimaryTone: Story = () => (
  <LaunchButton tone="primary" guardLabel="DEPLOY" onClick={() => console.log("deployed")}>
    Deploy
  </LaunchButton>
);

export const SwitchMode: Story = () => (
  <LaunchButton mode="switch" guardLabel="ARM" onCheckedChange={(c) => console.log("armed:", c)}>
    Autopilot override
  </LaunchButton>
);

export const SwitchModeArmed: Story = () => (
  <LaunchButton mode="switch" defaultOpen defaultChecked guardLabel="ARM">
    Autopilot override
  </LaunchButton>
);

export const Vertical: Story = () => (
  <LaunchButton mode="switch" orientation="vertical" guardLabel="ARM">
    MASTER ARM
  </LaunchButton>
);

export const VerticalOpen: Story = () => (
  <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", paddingTop: "1.5rem" }}>
    <LaunchButton mode="switch" orientation="vertical" guardLabel="ARM" defaultOpen>
      MASTER ARM
    </LaunchButton>
    <LaunchButton mode="switch" orientation="vertical" guardLabel="ARM" defaultOpen defaultChecked>
      MASTER ARM
    </LaunchButton>
  </div>
);

export const VerticalSizes: Story = () => (
  <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start", paddingTop: "1.5rem" }}>
    <LaunchButton mode="switch" orientation="vertical" size="sm" defaultOpen defaultChecked>
      ARM
    </LaunchButton>
    <LaunchButton mode="switch" orientation="vertical" size="md" defaultOpen defaultChecked>
      MASTER ARM
    </LaunchButton>
    <LaunchButton mode="switch" orientation="vertical" size="lg" defaultOpen defaultChecked>
      MASTER ARM
    </LaunchButton>
  </div>
);

export const VerticalButton: Story = () => (
  <LaunchButton orientation="vertical" guardLabel="JETT" defaultOpen>
    Jettison
  </LaunchButton>
);

export const Sizes: Story = () => (
  <div style={{ display: "flex", alignItems: "flex-end", gap: "1.5rem" }}>
    <LaunchButton size="sm">Purge</LaunchButton>
    <LaunchButton size="md">Purge</LaunchButton>
    <LaunchButton size="lg">Purge</LaunchButton>
  </div>
);

export const Disabled: Story = () => (
  <LaunchButton disabled guardLabel="ARM">
    Launch
  </LaunchButton>
);

/** A static open frame (also the VRT / reduced-motion reference). */
export const OpenResting: Story = () => <LaunchButton defaultOpen>Launch</LaunchButton>;

export const ControlledOpen: Story = () => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ display: "grid", gap: "1.5rem", justifyItems: "start" }}>
      <label style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
        <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} />
        guard open
      </label>
      <LaunchButton
        open={open}
        onOpenChange={(next, reason) => {
          console.log("open:", next, reason);
          setOpen(next);
        }}
        onClick={() => console.log("fired")}
      >
        Launch
      </LaunchButton>
    </div>
  );
};
