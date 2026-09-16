import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { CardIndex } from './cardIndex.js';
import type { Card } from '@command-table/common';

function makeCard(overrides: Partial<Card> = {}): Card {
  return {
    oracleId: 'oracle-sol-ring',
    scryfallId: 'scryfall-sol-ring-lea',
    name: 'Sol Ring',
    manaCost: '{1}',
    cmc: 1,
    typeLine: 'Artifact',
    oracleText: '{T}: Add {C}{C}.',
    power: null,
    toughness: null,
    loyalty: null,
    defense: null,
    colors: [],
    colorIdentity: [],
    layout: 'normal',
    cardFaces: null,
    imageUris: { normal: 'https://example.com/normal.jpg', artCrop: 'https://example.com/art.jpg' },
    set: 'lea',
    collectorNumber: '1',
    ...overrides,
  };
}

describe('CardIndex', () => {
  let index: CardIndex;

  beforeEach(() => {
    index = new CardIndex(new Database(':memory:'));
  });

  afterEach(() => {
    index.close();
  });

  it('finds a card by exact name, case-insensitively', () => {
    index.upsert(makeCard());
    expect(index.findByName('sol ring')?.name).toBe('Sol Ring');
    expect(index.findByName('SOL RING')?.name).toBe('Sol Ring');
  });

  it('returns undefined for a name with no match', () => {
    index.upsert(makeCard());
    expect(index.findByName('Not A Real Card')).toBeUndefined();
  });

  it('finds a card by scryfallId, for clients rendering a GameObject\'s source', () => {
    index.upsert(makeCard({ scryfallId: 'scryfall-sol-ring-lea' }));
    expect(index.findByScryfallId('scryfall-sol-ring-lea')?.name).toBe('Sol Ring');
    expect(index.findByScryfallId('nonexistent')).toBeUndefined();
  });

  it('finds a card by set and collector number', () => {
    index.upsert(makeCard({ scryfallId: 'a', set: 'ltc', collectorNumber: '284' }));
    index.upsert(makeCard({ scryfallId: 'b', set: 'lea', collectorNumber: '1' }));
    const found = index.findByPrinting('Sol Ring', 'ltc', '284');
    expect(found?.scryfallId).toBe('a');
  });

  it('prefers the requested printing but falls back to any printing by name', () => {
    index.upsert(makeCard({ scryfallId: 'only-printing', set: 'lea', collectorNumber: '1' }));
    const found = index.findByPrinting('Sol Ring', 'ltc', '284');
    expect(found?.scryfallId).toBe('only-printing');
  });

  it('suggests fuzzy name matches for typos', () => {
    index.upsert(makeCard({ name: 'Sol Ring' }));
    index.upsert(makeCard({ scryfallId: 'x', oracleId: 'y', name: 'Solemn Simulacrum' }));
    const suggestions = index.suggestNames('sol rng', 5);
    expect(suggestions).toContain('Sol Ring');
  });

  it('upsert replaces an existing row for the same scryfallId', () => {
    index.upsert(makeCard({ oracleText: 'old text' }));
    index.upsert(makeCard({ oracleText: 'new text' }));
    expect(index.findByName('Sol Ring')?.oracleText).toBe('new text');
  });

  it('finds a double-faced card by its front-face name alone', () => {
    // Oracle Cards stores DFCs under the combined name, but decklists reference the front face.
    index.upsert(
      makeCard({
        name: 'Delver of Secrets // Insectile Aberration',
        layout: 'transform',
        cardFaces: [
          { name: 'Delver of Secrets', manaCost: '{U}', typeLine: 'Creature — Human Wizard', oracleText: null, power: '1', toughness: '1', loyalty: null, defense: null, imageUris: null },
          { name: 'Insectile Aberration', manaCost: null, typeLine: 'Creature — Human Insect', oracleText: 'Flying', power: '3', toughness: '2', loyalty: null, defense: null, imageUris: null },
        ],
      })
    );

    expect(index.findByName('Delver of Secrets')?.name).toBe('Delver of Secrets // Insectile Aberration');
    expect(index.findByName('Insectile Aberration')?.name).toBe('Delver of Secrets // Insectile Aberration');
  });

  it('prefers an exact whole-name match over a face-name alias', () => {
    // A split card's combined name should still resolve directly, not via the alias table.
    index.upsert(
      makeCard({
        scryfallId: 'fire-ice',
        name: 'Fire // Ice',
        layout: 'split',
        cardFaces: [
          { name: 'Fire', manaCost: '{1}{R}', typeLine: 'Instant', oracleText: null, power: null, toughness: null, loyalty: null, defense: null, imageUris: null },
          { name: 'Ice', manaCost: '{1}{U}', typeLine: 'Instant', oracleText: null, power: null, toughness: null, loyalty: null, defense: null, imageUris: null },
        ],
      })
    );

    expect(index.findByName('Fire // Ice')?.scryfallId).toBe('fire-ice');
  });
});
