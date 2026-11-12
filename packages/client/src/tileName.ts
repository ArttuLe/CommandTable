// What a screen reader calls a card tile. The tile says most of its state in pictures (badges, a
// red border, a corner mark, rotation), so its name has to say the same things in words or
// "Grizzly Bears" reads the same with or without three +1/+1 counters on it.

import { counterBadgeText, counterKind } from './counters.js';

export interface TileState {
  /** The card's name, or null when it is hidden from you or still loading. */
  name: string | null;
  showsBack: boolean;
  tapped: boolean;
  pt: string | null;
  attacking: boolean;
  sick: boolean;
  counters: Record<string, number>;
  labels: string[];
}

export function tileName(t: TileState): string {
  const counters = Object.entries(t.counters).map(([key, value]) =>
    counterKind(key) === 'other' ? `${key}: ${value}` : counterBadgeText(key, value)
  );
  return [
    t.name ?? (t.showsBack ? 'Face-down card' : 'Card'),
    t.tapped && 'tapped',
    t.attacking && 'attacking',
    t.sick && 'summoning sick',
    t.pt,
    ...counters,
    ...t.labels,
  ]
    .filter(Boolean)
    .join(', ');
}
