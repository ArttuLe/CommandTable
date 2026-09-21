// How a counter should read on a card. Colour carries the meaning for the two that come up
// constantly (see ContextMenu's one-click +1/+1 and -1/-1), so those badges can show a bare
// number; everything else keeps its name.

export type CounterKind = 'buff' | 'debuff' | 'loyalty' | 'other';

export function counterKind(key: string): CounterKind {
  if (key === '+1/+1') return 'buff';
  if (key === '-1/-1') return 'debuff';
  if (key.toLowerCase() === 'loyalty') return 'loyalty';
  return 'other';
}

/** Badge text. Buff/debuff drop the label — the colour already says which it is. */
export function counterBadgeText(key: string, value: number): string {
  const kind = counterKind(key);
  return kind === 'buff' || kind === 'debuff' || kind === 'loyalty' ? String(value) : `${key} ${value}`;
}
