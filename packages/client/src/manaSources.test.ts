import { describe, expect, it } from 'vitest';
import type { Card } from '@command-table/common';
import { manaToRemove, producedMana } from './manaSources.js';
import type { ManaColor } from './uiStore.js';

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

describe('manaToRemove', () => {
  const pad = (held: Partial<Record<ManaColor, number>>): Record<ManaColor, number> =>
    ({ W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, ...held });

  it('takes back the one colour a single source made', () => {
    expect(manaToRemove(['G'], pad({ G: 1 }))).toBe('G');
  });

  it('takes back a colour of the source that you are actually holding', () => {
    expect(manaToRemove(['G', 'W'], pad({ W: 2 }))).toBe('W');
  });

  it('prefers the source\'s own order when you hold several of its colours', () => {
    expect(manaToRemove(['G', 'W'], pad({ G: 1, W: 1 }))).toBe('G');
  });

  it('takes nothing back when you are holding none of what it made', () => {
    expect(manaToRemove(['G', 'W'], pad({ U: 3 }))).toBe(null);
    expect(manaToRemove([], pad({ G: 1 }))).toBe(null);
  });
});
