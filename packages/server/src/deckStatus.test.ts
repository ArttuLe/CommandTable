import { describe, expect, it } from 'vitest';
import { deckStatusFrom } from './deckStatus.js';
import type { ResolvedDecklist } from '@command-table/common';

function makeResolved(overrides: Partial<ResolvedDecklist> = {}): ResolvedDecklist {
  return { commanders: [], deck: [], sideboard: [], maybeboard: [], unresolved: [], warnings: [], ...overrides };
}

describe('deckStatusFrom', () => {
  it('is ok when there are no warnings or unresolved lines', () => {
    expect(deckStatusFrom(makeResolved())).toBe('ok');
  });

  it('is warnings when there are warnings', () => {
    expect(
      deckStatusFrom(makeResolved({ warnings: [{ kind: 'wrong_deck_size', expected: 100, actual: 99 }] }))
    ).toBe('warnings');
  });

  it('is warnings when there are unresolved lines', () => {
    expect(
      deckStatusFrom(
        makeResolved({
          unresolved: [{ line: { quantity: 1, name: 'X', set: null, collectorNumber: null, section: 'deck' }, suggestions: [] }],
        })
      )
    ).toBe('warnings');
  });
});
