import type { Story } from "@ladle/react";
import { BenchFill } from "./BenchFill";

// Throwaway benchmark stories (Phase 2/3). probe-nonideal targets each by id
// and sizes [data-nis-root]. Removed with the rig in Task 3.3.

export const DomPre: Story = () => <BenchFill renderer="dom" />;
