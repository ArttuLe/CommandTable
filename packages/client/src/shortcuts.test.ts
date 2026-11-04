import { describe, expect, it } from 'vitest';
import { hoverMove } from './shortcuts.js';

const mine = { id: 'o1', controllerId: 'alice', zone: { playerId: 'alice', zone: 'battlefield' } } as const;

describe('hoverMove', () => {
  it('sends your card where its key says', () => {
    expect(hoverMove('g', mine, 'alice')).toEqual({ t: 'MOVE_OBJECT', objectId: 'o1', toZone: { playerId: 'alice', zone: 'graveyard' } });
    expect(hoverMove('e', mine, 'alice')).toMatchObject({ toZone: { zone: 'exile' } });
    expect(hoverMove('h', mine, 'alice')).toMatchObject({ toZone: { zone: 'hand' } });
  });

  it("leaves someone else's card alone", () => {
    expect(hoverMove('g', mine, 'bob')).toBeNull();
  });

  it('does nothing for a card already there, or a key that is not a move', () => {
    expect(hoverMove('h', { ...mine, zone: { playerId: 'alice', zone: 'hand' } }, 'alice')).toBeNull();
    expect(hoverMove('x', mine, 'alice')).toBeNull();
  });
});
