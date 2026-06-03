import type { Story } from "@ladle/react";
import { Switch } from "./Switch";

export const Default: Story = () => <Switch />;
export const DefaultChecked: Story = () => <Switch defaultChecked />;
export const Disabled: Story = () => <Switch disabled defaultChecked />;
