import type { Story } from "@ladle/react";
import { BenchFill } from "./BenchFill";

// Perf-regression rig for the chosen WebGL renderer. probe-nonideal targets
// `bench-fill--webgl` and sizes [data-nis-root].
export const Webgl: Story = () => <BenchFill />;
