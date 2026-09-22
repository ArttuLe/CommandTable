import { describe, expect, it } from 'vitest';
import { ATTACKING_MARKER, isAttacking } from './combat.js';

describe('isAttacking', () => {
  it('reads the marker the attack toggle writes', () => {
    expect(isAttacking({ markers: [ATTACKING_MARKER] })).toBe(true);
  });

  it('is false for a creature carrying other markers only', () => {
    expect(isAttacking({ markers: ['blocking', 'goaded'] })).toBe(false);
    expect(isAttacking({ markers: [] })).toBe(false);
  });
});
