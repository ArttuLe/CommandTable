// Exercises the parser + resolver against the real ingested SQLite card index (§18: decklist
// parser tests should run against real exports). Skips if `npm run ingest` hasn't been run yet,
// since this suite is meant to catch real-data surprises (see cardIndex.ts's alias table, added
// after this surfaced that Oracle Cards stores DFCs under their combined name).

import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import Database from 'better-sqlite3';
import { CardIndex } from './cardIndex.js';
import { parseDecklist } from './decklistParser.js';
import { resolveDecklist } from './deckResolver.js';

const DB_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'cards.sqlite3');

describe.skipIf(!existsSync(DB_PATH))('deck resolution against real card data', () => {
  const index = new CardIndex(new Database(DB_PATH, { readonly: true }));

  it('resolves a real decklist including a double-faced commander', () => {
    const decklist = `
Commander
1 Atraxa, Praetors' Voice

Deck
1 Sol Ring
1 Command Tower
1 Delver of Secrets
1 Fire // Ice
`;
    const parsed = parseDecklist(decklist);
    const resolved = resolveDecklist(parsed, index);

    expect(resolved.unresolved).toEqual([]);
    expect(resolved.commanders).toHaveLength(1);
    expect(resolved.deck).toHaveLength(4);
    expect(resolved.deck.find((l) => l.line.name === 'Delver of Secrets')?.card.name).toBe(
      'Delver of Secrets // Insectile Aberration'
    );
  });

  it('surfaces a typo as unresolved with a real fuzzy suggestion', () => {
    const parsed = parseDecklist('Deck\n1 Sol Rng');
    const resolved = resolveDecklist(parsed, index);

    expect(resolved.unresolved).toHaveLength(1);
    expect(resolved.unresolved[0].suggestions).toContain('Sol Ring');
  });
});
