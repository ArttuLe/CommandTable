// Finding a card in a long zone by typing. A library search used to be a scroll through ninety
// full-size cards; matching the type line as well lets "land" or "creature" narrow it the way
// a tutor's own wording does.

import type { Card } from '@command-table/common';

export function matchesCardQuery(card: Pick<Card, 'name' | 'typeLine'> | null, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (!card) return false;
  return card.name.toLowerCase().includes(q) || card.typeLine.toLowerCase().includes(q);
}
