import type { Story } from "@ladle/react";
import { Checkbox } from "./Checkbox";

export const Default: Story = () => <Checkbox />;
export const DefaultChecked: Story = () => <Checkbox defaultChecked />;
export const Indeterminate: Story = () => <Checkbox indeterminate />;
export const Disabled: Story = () => <Checkbox disabled defaultChecked />;
