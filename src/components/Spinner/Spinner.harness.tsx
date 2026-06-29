import type { SpinnerVariant } from "../../lib/effects";
import { Spinner } from "./Spinner";

export function SpinnerHarness({ variant = "braille" }: { variant?: SpinnerVariant }) {
  return <Spinner variant={variant} speed={4} label="Loading" />;
}
