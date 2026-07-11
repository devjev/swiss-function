/**
 * Hand-written ambient declarations for @observablehq/runtime v6.
 *
 * The package ships plain ES modules with no bundled or @types declarations,
 * so under `strict` the bare import would be an implicit `any`. Only the
 * surface actually used by runtime-graph.ts is declared here; the source of
 * truth is node_modules/@observablehq/runtime/src/{runtime,module,variable,errors}.js.
 */
declare module "@observablehq/runtime" {
  /**
   * Per-variable state callbacks (all optional). `fulfilled`/`rejected` also
   * receive the variable's current name as a second argument.
   */
  export interface RuntimeObserver {
    pending?: () => void;
    fulfilled?: (value: unknown, name?: string | null) => void;
    rejected?: (error: unknown, name?: string | null) => void;
  }

  export interface RuntimeVariable {
    /**
     * (Re)defines this variable. `inputs` are names resolved within the
     * module; `definition` is invoked with the inputs' settled values in
     * order. Returns `this`.
     */
    define(
      name: string | null,
      inputs: readonly string[],
      definition: (...inputs: unknown[]) => unknown,
    ): RuntimeVariable;
    /** Deletes the variable's definition and name (dependents then reject). */
    delete(): RuntimeVariable;
  }

  export interface RuntimeModule {
    /** Creates a new, initially-undefined variable observed by `observer`. */
    variable(observer?: RuntimeObserver): RuntimeVariable;
  }

  export class Runtime {
    /**
     * @param builtins optional map of builtin variables.
     * @param global fallback resolver for names not defined in any module;
     *   defaults to reading `globalThis` — pass `() => undefined` to disable.
     */
    constructor(
      builtins?: Record<string, unknown> | null,
      global?: (name: string) => unknown,
    );
    module(): RuntimeModule;
    /** Invalidates all variables and disables future computation. */
    dispose(): void;
  }

  /**
   * Thrown/rejected by the runtime itself ("circular definition",
   * "<name> is not defined", …). `input` is the name of the *direct* input
   * variable the error was propagated through, when applicable.
   */
  export class RuntimeError extends Error {
    constructor(message: string, input?: string);
    readonly input: string | undefined;
  }
}
