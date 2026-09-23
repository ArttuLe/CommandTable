// How a counter should read on a card. Colour carries the meaning for the two that come up
// constantly (see ContextMenu's one-click +1/+1 and -1/-1), so those badges keep their shape
// rather than their count.

export type CounterKind = 'buff' | 'debuff' | 'loyalty' | 'other';

export function counterKind(key: string): CounterKind {
  if (key === '+1/+1') return 'buff';
  if (key === '-1/-1') return 'debuff';
  if (key.toLowerCase() === 'loyalty') return 'loyalty';
  return 'other';
}

/**
 * Badge text.
 *
 * Buff/debuff show what the counters add up to — three +1/+1 counters read `+3/+3`, which is the
 * number the player actually needs. They used to show a bare `3`, on the theory that the colour
 * already said which kind it was; at the table that lost the distinction between "three counters"
 * and "+3/+3", and a lone counter showing `1` read as neither.
 *
 * Loyalty stays bare: it is a total, not a modifier, and `5` is how it is printed on the card.
 *
 * So does everything else. A badge reading "charge 3" spelled its own name across a card that is
 * already hard enough to read at table zoom; the count is the part that changes, and the name is
 * in the tooltip and in the context menu. Anything that needs a word of its own is a label, not a
 * counter (see labels.ts).
 */
export function counterBadgeText(key: string, value: number): string {
  const kind = counterKind(key);
  if (kind === 'buff') return `+${value}/+${value}`;
  if (kind === 'debuff') return `-${value}/-${value}`;
  return String(value);
}
