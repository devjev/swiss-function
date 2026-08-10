// Attention model for ContextEditor. Internal (not part of the public export):
// lays the enabled blocks along the context window by cumulative tokens and
// scores each one's positional and effective attention.

import type { ContextBlock } from "./ContextEditor";

/** Compact token label: 41800 -> "41.8k", 900 -> "900", -72000 -> "-72k". */
export function fmtTokens(n: number): string {
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs < 1_000) return sign + String(Math.round(abs));
  const k = abs / 1_000;
  return `${sign}${k >= 100 ? Math.round(k) : k.toFixed(1)}k`;
}

/**
 * Positional attention weight for a point `p` (0 = window start, 1 = end).
 *
 * Long-context models attend most to the beginning and the end of the window
 * and least to the middle: the "lost in the middle" effect (Liu et al., 2023).
 * Modelled as the max of a primacy and a recency exponential decay, floored so
 * the trough is never zero. Returns a value in [floor, 1], symmetric about 0.5.
 */
export function positionalAttention(p: number): number {
  const lambda = 0.26; // decay length; smaller = deeper middle trough
  const floor = 0.12;
  const primacy = Math.exp(-p / lambda);
  const recency = Math.exp(-(1 - p) / lambda);
  return floor + (1 - floor) * Math.max(primacy, recency);
}

export interface BlockSpan {
  block: ContextBlock;
  /** Cumulative token span, as fractions of the packed context [start, end]. */
  start: number;
  end: number;
  mid: number;
  /** Positional attention at the block's midpoint, 0..1. */
  positional: number;
  /** positional x salience: how much of the model's attention this earns. */
  effective: number;
}

/** Total tokens across the given blocks. */
export function sumTokens(blocks: ContextBlock[]): number {
  return blocks.reduce((sum, b) => sum + b.tokens, 0);
}

/**
 * Score each block's position and attention. Positions are relative to the
 * packed (enabled) context, not the full window. `salience` is optional: when a
 * block omits it, attention is positional only (salience defaults to 1).
 */
export function blockSpans(blocks: ContextBlock[]): BlockSpan[] {
  const total = sumTokens(blocks) || 1;
  let cursor = 0;
  return blocks.map((block) => {
    const start = cursor / total;
    cursor += block.tokens;
    const end = cursor / total;
    const mid = (start + end) / 2;
    const positional = positionalAttention(mid);
    const salience = block.salience ?? 1;
    return { block, start, end, mid, positional, effective: positional * salience };
  });
}

export type AttentionFlag = "strong" | "buried" | "wasted" | null;

/**
 * Classify a block so a flag means the same thing everywhere: `strong` earns
 * its place, `buried` sits in the positional trough, `wasted` is large but
 * ignored. Only these carry colour; everything else is neutral.
 */
export function flagFor(s: BlockSpan): AttentionFlag {
  if (s.block.tokens > 5_000 && s.effective < 0.18) return "wasted";
  if (s.positional < 0.3 && s.block.tokens > 8_000) return "buried";
  if (s.effective > 0.55) return "strong";
  return null;
}
