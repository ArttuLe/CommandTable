import { describe, expect, it } from 'vitest';
import type { Card } from '@command-table/common';
import { matchesCardQuery } from './cardSearch.js';

const sol = { name: 'Sol Ring', typeLine: 'Artifact' } as Card;
const forest = { name: 'Forest', typeLine: 'Basic Land — Forest' } as Card;

describe('matchesCardQuery', () => {
  it('matches part of a name or a type line, ignoring case', () => {
    expect(matchesCardQuery(sol, 'ring')).toBe(true);
    expect(matchesCardQuery(forest, 'LAND')).toBe(true);
    expect(matchesCardQuery(sol, 'land')).toBe(false);
  });

  it('matches everything when the query is blank, and nothing it cannot read', () => {
    expect(matchesCardQuery(sol, '  ')).toBe(true);
    expect(matchesCardQuery(null, 'ring')).toBe(false);
  });
});
