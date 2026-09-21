// What you can do with a card you just revealed by searching or peeking.
//
// Right-clicking one only offers the generic zone list, which has no notion of *where* in the
// library a card lands — so there was no way to put a card on the bottom, which is the whole
// point of a peek. These four build the `MOVE_OBJECT` for each button in the library popover.

import type { Action, ObjectId, PlayerId } from '@command-table/common';

export type LibraryMove = 'hand' | 'battlefield' | 'top' | 'bottom';

export const LIBRARY_MOVES: { move: LibraryMove; label: string }[] = [
  { move: 'hand', label: 'Hand' },
  { move: 'battlefield', label: 'Play' },
  { move: 'top', label: 'Top' },
  { move: 'bottom', label: 'Bottom' },
];

export function libraryMoveAction(
  move: LibraryMove,
  objectId: ObjectId,
  playerId: PlayerId,
  libraryCount: number
): Action {
  if (move === 'hand' || move === 'battlefield') {
    return { t: 'MOVE_OBJECT', objectId, toZone: { playerId, zone: move } };
  }
  // Positions are dense 0..n-1 after any shuffle, so the card count is always past the last
  // card. Two cards bottomed in a row therefore share a position and their relative order is
  // arbitrary until the next shuffle — not worth a server-side renumber to fix.
  return {
    t: 'MOVE_OBJECT',
    objectId,
    toZone: { playerId, zone: 'library' },
    toPosition: move === 'top' ? 0 : libraryCount,
  };
}

/** Why the library popover was opened — see `libraryDirtiedBy`. */
export type LibraryLook = 'search' | 'peek';

/**
 * Whether closing the popover should shuffle.
 *
 * A search rummages through the whole library, so it owes the table a shuffle — the popover used
 * to just carry a note reminding you. A peek must NOT shuffle: it looked at the top N in order
 * and the player is about to rearrange them, which is the entire point of a scry.
 */
export function libraryDirtiedBy(look: LibraryLook): boolean {
  return look === 'search';
}
