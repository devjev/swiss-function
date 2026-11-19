import type { Bullet, BulletId } from "./types";

/** Where a dropped card goes: its column and the card it follows. Pure, so it
 *  is tested on its own. `over` is the card or the column under the pointer. */
export function cardTarget(
  columns: Bullet[],
  cardId: BulletId,
  over: { columnId: BulletId; cardId: BulletId | null },
): { columnId: BulletId; afterId: BulletId | null } | null {
  const column = columns.find((c) => c.id === over.columnId);
  if (!column) return null;
  const cards = column.children ?? [];
  const rest = cards.filter((c) => c.id !== cardId);
  if (over.cardId === null || over.cardId === cardId) {
    if (over.cardId === cardId) return null;
    // On the column itself: the card goes last.
    return { columnId: column.id, afterId: rest[rest.length - 1]?.id ?? null };
  }
  const from = cards.findIndex((c) => c.id === cardId);
  const to = cards.findIndex((c) => c.id === over.cardId);
  if (to < 0) return null;
  // Within one column a card dragged down lands after the one it is over; in
  // every other case it takes that card's place.
  if (from >= 0 && from < to) return { columnId: column.id, afterId: over.cardId };
  const at = rest.findIndex((c) => c.id === over.cardId);
  return { columnId: column.id, afterId: rest[at - 1]?.id ?? null };
}
