// The face of a card that is currently up.
//
// Scryfall puts a double-faced card's art and rules text on its faces, not on the card, so a tile
// read off the card itself showed no art and the hover preview nothing at all — and TRANSFORM
// only ever changes `currentFace`, which nothing read, so turning a card over changed nothing on
// anyone's screen. Everything that draws or reads a card goes through useCard/useCards, which
// apply this, so the tile, the preview, its band on the board and the mana it makes all follow.

import type { Card } from '@command-table/common';
import { isTransformable } from './cardMenu.js';

export function faceUp(card: Card, currentFace: number): Card {
  if (!isTransformable(card)) return card;
  const face = card.cardFaces![currentFace] ?? card.cardFaces![0];
  return {
    ...card,
    name: face.name,
    typeLine: face.typeLine ?? card.typeLine,
    oracleText: face.oracleText,
    power: face.power,
    toughness: face.toughness,
    imageUris: face.imageUris ?? card.imageUris,
  };
}
