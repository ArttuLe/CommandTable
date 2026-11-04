import { describe, expect, it } from 'vitest';
import type { Card } from '@command-table/common';
import { faceUp } from './cardFace.js';

const face = (name: string, typeLine: string, oracleText: string, art: string) => ({
  name, typeLine, oracleText, imageUris: { normal: art, artCrop: art },
  manaCost: null, power: null, toughness: null, loyalty: null, defense: null,
});
const card = (layout: string, faces: ReturnType<typeof face>[] | null, imageUris: Card['imageUris'] = null) =>
  ({ name: 'Front // Back', typeLine: 'Creature // Land', oracleText: null, layout, cardFaces: faces, imageUris }) as Card;

describe('faceUp', () => {
  // Scryfall gives a double-faced card no art or text of its own — they are on its faces — so tiles
  // fell back to text, the preview showed nothing, and Transform changed nothing anyone could see.
  it('reads a transforming card off the face that is up', () => {
    const dfc = card('transform', [face('Front', 'Creature', 'Flying', 'front.jpg'), face('Back', 'Land', '{T}: Add {G}.', 'back.jpg')]);
    expect(faceUp(dfc, 0)).toMatchObject({ name: 'Front', typeLine: 'Creature', imageUris: { normal: 'front.jpg' } });
    expect(faceUp(dfc, 1)).toMatchObject({ name: 'Back', typeLine: 'Land', oracleText: '{T}: Add {G}.', imageUris: { normal: 'back.jpg' } });
  });

  // A split or adventure card is one card with two halves: one image, read whole.
  it('leaves a two-part card that does not turn over whole', () => {
    const split = card('split', [face('Fire', 'Instant', 'a', 'x'), face('Ice', 'Instant', 'b', 'x')], { normal: 'whole.jpg', artCrop: 'w' });
    expect(faceUp(split, 0)).toBe(split);
  });
});
