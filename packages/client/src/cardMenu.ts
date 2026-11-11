// Which of the card menu's items a card actually gets, by where it is.
//
// A card gets every action applicable to it — applicable being the operative word.
// The menu used to offer the same twenty items wherever a card was, so a card in hand offered
// Tap, Transform, Turn face down and "move to Hand" ahead of the moves it could really make.

import type { Card } from '@command-table/common';

export type MenuZone = 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'library' | 'commandZone' | 'stack' | 'limbo';

/** Where a chip sends the card. `position` is only for the library: the top, or past the bottom. */
export interface MoveTarget {
  label: string;
  zone: Exclude<MenuZone, 'stack' | 'limbo'>;
  position?: 'top' | 'bottom';
}

/**
 * Six full-width "Move to X" rows were a quarter of a menu that had outgrown the screen; as chips
 * they are one row, and the short names are the ones players say out loud anyway.
 */
const MOVE_TARGETS: MoveTarget[] = [
  { label: 'Hand', zone: 'hand' },
  { label: 'GY', zone: 'graveyard' },
  { label: 'Exile', zone: 'exile' },
  { label: 'Play', zone: 'battlefield' },
  { label: 'Cmd', zone: 'commandZone' },
  { label: 'Top', zone: 'library', position: 'top' },
  { label: 'Bottom', zone: 'library', position: 'bottom' },
];

export interface CardMenuShape {
  tap: boolean;
  /** Attacking and Blocking…: creatures, in play. */
  combat: boolean;
  transform: boolean;
  faceToggle: boolean;
  counters: boolean;
  moves: MoveTarget[];
}

export function cardMenuShape({
  zone,
  creature,
  transformable,
}: {
  zone: MenuZone;
  creature: boolean;
  transformable: boolean;
}): CardMenuShape {
  const inPlay = zone === 'battlefield';
  return {
    tap: inPlay,
    combat: inPlay && creature,
    transform: inPlay && transformable,
    // Exile is where suspend keeps its time counters and foretell keeps a card face down.
    faceToggle: inPlay || zone === 'exile',
    counters: inPlay || zone === 'exile',
    // Not the zone it is already in — except a library's, whose two ends are both somewhere else.
    moves: MOVE_TARGETS.filter((target) => target.zone !== zone || target.zone === 'library'),
  };
}

/** The layouts with a back face to turn over. A split or adventure card has two halves, not two sides. */
const TRANSFORMING_LAYOUTS = new Set(['transform', 'modal_dfc', 'double_faced_token', 'reversible_card', 'meld', 'flip']);

export function isTransformable(card: Pick<Card, 'layout' | 'cardFaces'> | null): boolean {
  return card !== null && TRANSFORMING_LAYOUTS.has(card.layout) && (card.cardFaces?.length ?? 0) > 1;
}
