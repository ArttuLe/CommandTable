import { describe, expect, it } from 'vitest';
import { tileName } from './tileName.js';

const bare = { name: 'Grizzly Bears', showsBack: false, tapped: false, pt: null, attacking: false, sick: false, counters: {}, labels: [] };

describe('tileName', () => {
  it('is just the card when nothing is on it', () => {
    expect(tileName(bare)).toBe('Grizzly Bears');
  });

  it('says what the tile shows, in the order it is read: state, P/T, counters, labels', () => {
    expect(
      tileName({ ...bare, tapped: true, pt: '2/2', attacking: true, sick: true, counters: { '+1/+1': 3, stun: 1 }, labels: ['flying'] })
    ).toBe('Grizzly Bears, tapped, attacking, summoning sick, 2/2, +3/+3, stun: 1, flying');
  });

  it('names a back without giving the card away', () => {
    expect(tileName({ ...bare, name: null, showsBack: true, tapped: true })).toBe('Face-down card, tapped');
  });

  it('falls back to "Card" while the card is still loading', () => {
    expect(tileName({ ...bare, name: null })).toBe('Card');
  });
});
