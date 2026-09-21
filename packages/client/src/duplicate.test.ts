import { describe, expect, it } from 'vitest';
import type { GameObject } from '@command-table/common';
import { duplicateAction } from './duplicate.js';

function obj(overrides: Partial<GameObject>): GameObject {
  return {
    id: 'o1',
    ownerId: 'alice',
    controllerId: 'alice',
    source: { kind: 'card', scryfallId: 's', oracleId: 'o' },
    zone: { playerId: 'alice', zone: 'battlefield' },
    position: 0,
    faceVisibility: { kind: 'all' },
    faceDown: false,
    currentFace: 0,
    tapped: false,
    flipped: false,
    counters: {},
    attachedTo: null,
    annotation: null,
    markers: [],
    ...overrides,
  };
}

const squirrel = { name: 'Squirrel', typeLine: 'Token Creature — Squirrel', power: '1', toughness: '1' };

describe('duplicateAction', () => {
  it('reproduces an ad-hoc token from its own face, into the same zone', () => {
    const token = obj({ source: { kind: 'token', adhoc: squirrel } });
    expect(duplicateAction(token, 'alice')).toEqual({
      t: 'CREATE_TOKEN',
      ownerId: 'alice',
      zone: { playerId: 'alice', zone: 'battlefield' },
      source: { adhoc: squirrel },
      quantity: 1,
    });
  });

  it('reproduces a Scryfall-backed token as another token, not as a copy', () => {
    const token = obj({ source: { kind: 'token', scryfallId: 'tok-1' } });
    expect(duplicateAction(token, 'alice')).toMatchObject({ t: 'CREATE_TOKEN', source: { scryfallId: 'tok-1' } });
  });

  it('credits the duplicate to the player who owns the original', () => {
    const token = obj({ ownerId: 'bob', source: { kind: 'token', adhoc: squirrel } });
    expect(duplicateAction(token, 'bob')).toMatchObject({ ownerId: 'bob' });
  });

  it('offers nothing for a real card, a copy, or a face-down object', () => {
    expect(duplicateAction(obj({}), 'alice')).toBeNull();
    expect(duplicateAction(obj({ source: { kind: 'copy', ofObjectId: 'x', scryfallId: 's' } }), 'alice')).toBeNull();
    expect(duplicateAction({ id: 'o1', zone: { playerId: 'alice', zone: 'battlefield' }, controllerId: 'alice', tapped: false, counters: {}, attachedTo: null, markers: [], hidden: true }, 'alice')).toBeNull();
  });
});
