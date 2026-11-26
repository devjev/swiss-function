import type { BulletId, OutlinerValue } from "./types";

/**
 * Undo and redo for the outline: one stack for text and structure alike.
 *
 * The tree is immutable and shares what did not change, so a step is simply
 * the state before it: the tree and where the caret or the selection was (`U`,
 * whatever the caller needs to put the user back). Consecutive keystrokes in
 * one block are one step, until a pause.
 */
export interface HistoryState<U> {
  value: OutlinerValue;
  ui: U;
}

export class History<U> {
  private undoStack: HistoryState<U>[] = [];
  private redoStack: HistoryState<U>[] = [];
  private typing: { id: BulletId; at: number } | null = null;

  constructor(
    /** Steps kept. */
    private readonly limit = 200,
    /** A pause this long (ms) ends a run of typing. */
    private readonly pause = 1000,
  ) {}

  /** Record the state before a change. `typing` marks a keystroke in a block:
   *  it joins the run in progress instead of adding a step. */
  record(before: HistoryState<U>, typing?: { id: BulletId; now: number }): void {
    this.redoStack = [];
    const run = this.typing;
    if (typing && run && run.id === typing.id && typing.now - run.at < this.pause) {
      run.at = typing.now;
      return;
    }
    this.undoStack.push(before);
    if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.typing = typing ? { id: typing.id, at: typing.now } : null;
  }

  /** The caret moved, or the block changed: the next keystroke is a new step. */
  breakTyping(): void {
    this.typing = null;
  }

  /** Whether there is a step to undo, and one to redo. */
  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /** Step back: returns the state to restore, given the current one. */
  undo(current: HistoryState<U>): HistoryState<U> | null {
    const state = this.undoStack.pop();
    if (!state) return null;
    this.redoStack.push(current);
    this.typing = null;
    return state;
  }

  redo(current: HistoryState<U>): HistoryState<U> | null {
    const state = this.redoStack.pop();
    if (!state) return null;
    this.undoStack.push(current);
    this.typing = null;
    return state;
  }

  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    this.typing = null;
  }
}
