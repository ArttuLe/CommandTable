import { describe, expect, it } from 'vitest';
import type { Card } from '@command-table/common';
import { cardMenuShape, isTransformable } from './cardMenu.js';

const shape = (zone: Parameters<typeof cardMenuShape>[0]['zone'], creature = false, transformable = false) =>
  cardMenuShape({ zone, creature, transformable });
const chips = (s: ReturnType<typeof cardMenuShape>) => s.moves.map((m) => m.label);

describe('cardMenuShape', () => {
  it('offers a creature on the battlefield everything a permanent can do', () => {
    const s = shape('battlefield', true);
    expect(s).toMatchObject({ tap: true, combat: true, faceToggle: true, counters: true, transform: false });
    // Not "Play": it is already in play.
    expect(chips(s)).toEqual(['Hand', 'GY', 'Exile', 'Cmd', 'Top', 'Bottom']);
  });

  // In hand the menu used to offer Tap, Transform, Turn face down and "Hand" — none of which a
  // card in hand can do — ahead of the moves that it can.
  it('offers a card in hand only what a card in hand can do', () => {
    const s = shape('hand', true, true);
    expect(s).toMatchObject({ tap: false, combat: false, transform: false, faceToggle: false, counters: false });
    expect(chips(s)).toEqual(['GY', 'Exile', 'Play', 'Cmd', 'Top', 'Bottom']);
  });

  it('offers Transform only for a card with another face, and only in play', () => {
    expect(shape('battlefield', false, true).transform).toBe(true);
    expect(shape('battlefield', false, false).transform).toBe(false);
  });

  // Suspend and foretell live in exile: time counters, and cards exiled face down.
  it('keeps counters and the face toggle in exile', () => {
    expect(shape('exile')).toMatchObject({ counters: true, faceToggle: true, tap: false });
  });

  it('keeps both ends of a library for a card that is already in one', () => {
    expect(chips(shape('library'))).toEqual(['Hand', 'GY', 'Exile', 'Play', 'Cmd', 'Top', 'Bottom']);
  });
});

describe('isTransformable', () => {
  it('knows the layouts that turn over from the two-part ones that do not', () => {
    const faces = [{}, {}] as unknown as NonNullable<Card['cardFaces']>;
    expect(isTransformable({ layout: 'transform', cardFaces: faces })).toBe(true);
    expect(isTransformable({ layout: 'modal_dfc', cardFaces: faces })).toBe(true);
    expect(isTransformable({ layout: 'split', cardFaces: faces })).toBe(false);
    expect(isTransformable({ layout: 'adventure', cardFaces: faces })).toBe(false);
    expect(isTransformable({ layout: 'normal', cardFaces: null })).toBe(false);
    expect(isTransformable(null)).toBe(false);
  });
});
