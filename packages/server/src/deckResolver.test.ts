import { describe, expect, it } from 'vitest';
import { resolveDecklist } from './deckResolver.js';
import type { Card, DeckLine } from '@command-table/common';

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    oracleId: 'o1',
    scryfallId: 's1',
    name: 'Sol Ring',
    manaCost: '{1}',
    cmc: 1,
    typeLine: 'Artifact',
    oracleText: null,
    power: null,
    toughness: null,
    loyalty: null,
    defense: null,
    colors: [],
    colorIdentity: [],
    layout: 'normal',
    cardFaces: null,
    imageUris: null,
    set: 'lea',
    collectorNumber: '1',
    ...overrides,
  };
}

function makeLookup(cards: Card[]) {
  return {
    findByName: (name: string) => cards.find((c) => c.name.toLowerCase() === name.toLowerCase()),
    findByPrinting: (name: string, set: string, cn: string) =>
      cards.find(
        (c) => c.name.toLowerCase() === name.toLowerCase() && c.set === set.toLowerCase() && c.collectorNumber === cn
      ) ?? cards.find((c) => c.name.toLowerCase() === name.toLowerCase()),
    suggestNames: (query: string) => cards.map((c) => c.name).slice(0, 3),
  };
}

describe('resolveDecklist', () => {
  it('resolves lines into their respective sections', () => {
    const atraxa = makeCard({ name: "Atraxa, Praetors' Voice" });
    const solRing = makeCard({ name: 'Sol Ring' });
    const lookup = makeLookup([atraxa, solRing]);
    const lines: DeckLine[] = [
      { quantity: 1, name: "Atraxa, Praetors' Voice", set: null, collectorNumber: null, section: 'commander' },
      { quantity: 1, name: 'Sol Ring', set: null, collectorNumber: null, section: 'deck' },
    ];

    const result = resolveDecklist({ lines }, lookup);

    expect(result.commanders).toHaveLength(1);
    expect(result.commanders[0].card.name).toBe("Atraxa, Praetors' Voice");
    expect(result.deck).toHaveLength(1);
    expect(result.unresolved).toHaveLength(0);
  });

  it('reports unresolved names with suggestions instead of blocking', () => {
    const lookup = makeLookup([makeCard({ name: 'Sol Ring' })]);
    const lines: DeckLine[] = [
      { quantity: 1, name: 'Sol Rng', set: null, collectorNumber: null, section: 'deck' },
    ];

    const result = resolveDecklist({ lines }, lookup);

    expect(result.deck).toHaveLength(0);
    expect(result.unresolved).toHaveLength(1);
    expect(result.unresolved[0].suggestions).toContain('Sol Ring');
  });

  it('warns when total deck size (including commanders) is not 100', () => {
    const lookup = makeLookup([makeCard({ name: 'Sol Ring' })]);
    const lines: DeckLine[] = [{ quantity: 5, name: 'Sol Ring', set: null, collectorNumber: null, section: 'deck' }];

    const result = resolveDecklist({ lines }, lookup);

    expect(result.warnings).toContainEqual({ kind: 'wrong_deck_size', expected: 100, actual: 5 });
  });

  it('does not warn on deck size when it is exactly 100', () => {
    const lookup = makeLookup([makeCard({ name: 'Sol Ring' }), makeCard({ name: 'Plains', scryfallId: 'p' })]);
    const lines: DeckLine[] = [
      { quantity: 1, name: 'Sol Ring', set: null, collectorNumber: null, section: 'commander' },
      { quantity: 99, name: 'Plains', set: null, collectorNumber: null, section: 'deck' },
    ];

    const result = resolveDecklist({ lines }, lookup);

    expect(result.warnings.some((w) => w.kind === 'wrong_deck_size')).toBe(false);
  });

  it('warns on duplicate non-basic lands but not on repeated basics', () => {
    const lookup = makeLookup([
      makeCard({ name: 'Sol Ring' }),
      makeCard({ name: 'Plains', scryfallId: 'p', typeLine: 'Basic Land — Plains' }),
    ]);
    const lines: DeckLine[] = [
      { quantity: 1, name: 'Sol Ring', set: null, collectorNumber: null, section: 'deck' },
      { quantity: 1, name: 'Sol Ring', set: null, collectorNumber: null, section: 'sideboard' },
      { quantity: 10, name: 'Plains', set: null, collectorNumber: null, section: 'deck' },
    ];

    const result = resolveDecklist({ lines }, lookup);

    expect(result.warnings).toContainEqual({ kind: 'duplicate_nonbasic', name: 'Sol Ring', count: 2 });
    expect(result.warnings.some((w) => w.kind === 'duplicate_nonbasic' && w.name === 'Plains')).toBe(false);
  });

  it('warns when a card falls outside the commanders combined color identity', () => {
    const commander = makeCard({ name: 'Korvold, Fae-Cursed King', colorIdentity: ['B', 'G', 'R'] });
    const offColor = makeCard({ name: 'Counterspell', scryfallId: 'c', colorIdentity: ['U'] });
    const lookup = makeLookup([commander, offColor]);
    const lines: DeckLine[] = [
      { quantity: 1, name: 'Korvold, Fae-Cursed King', set: null, collectorNumber: null, section: 'commander' },
      { quantity: 1, name: 'Counterspell', set: null, collectorNumber: null, section: 'deck' },
    ];

    const result = resolveDecklist({ lines }, lookup);

    expect(result.warnings).toContainEqual({
      kind: 'color_identity_violation',
      name: 'Counterspell',
      cardIdentity: ['U'],
      commanderIdentity: ['B', 'G', 'R'],
    });
  });

  it('honors set/collector-number hints via findByPrinting', () => {
    let capturedArgs: unknown[] = [];
    const lookup = {
      findByName: () => undefined,
      findByPrinting: (...args: unknown[]) => {
        capturedArgs = args;
        return makeCard();
      },
      suggestNames: () => [],
    };
    const lines: DeckLine[] = [{ quantity: 1, name: 'Sol Ring', set: 'LTC', collectorNumber: '284', section: 'deck' }];

    resolveDecklist({ lines }, lookup);

    expect(capturedArgs).toEqual(['Sol Ring', 'LTC', '284']);
  });
});
