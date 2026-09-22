import { describe, expect, it } from 'vitest';
import type { Card } from '@command-table/common';
import { producedMana } from './manaSources.js';

const card = (oracleText: string | null): Card =>
  ({ oracleText, name: 'test', typeLine: 'Land' }) as Card;

describe('producedMana', () => {
  it('reads a basic land', () => {
    expect(producedMana(card('({T}: Add {G}.)'))).toEqual(['G']);
  });

  it('reads both halves of a dual', () => {
    expect(producedMana(card('{T}: Add {G} or {W}.'))).toEqual(['G', 'W']);
  });

  it('collapses a repeated symbol to one choice', () => {
    expect(producedMana(card('{T}: Add {C}{C}.'))).toEqual(['C']);
  });

  it('expands "any color" to the five colours', () => {
    expect(producedMana(card('{T}: Add one mana of any color.'))).toEqual(['W', 'U', 'B', 'R', 'G']);
  });

  it('ignores mana symbols that are being spent rather than added', () => {
    expect(producedMana(card('{2}{W}: Create a 1/1 white Soldier creature token.'))).toEqual([]);
  });

  it('has nothing to say about a card that is still loading', () => {
    expect(producedMana(null)).toEqual([]);
    expect(producedMana(card(null))).toEqual([]);
  });
});
