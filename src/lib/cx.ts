export function cx(...args: Array<string | undefined | null | false>): string {
  return args.filter(Boolean).join(" ");
}

/**
 * Compose a base className (from our CSS Module) with a consumer-supplied
 * className that may be either a string or a state→string function
 * (Base UI's dynamic className API). The function form is preserved so
 * the consumer can still react to component state.
 */
export function mergeClassName<S>(
  base: string | undefined,
  user: string | ((state: S) => string | undefined) | undefined,
): string | ((state: S) => string) {
  if (typeof user === "function") {
    return (state: S) => cx(base, user(state));
  }
  return cx(base, user);
}
