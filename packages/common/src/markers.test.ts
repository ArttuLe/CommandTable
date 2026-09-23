import { describe, expect, it } from 'vitest';
import {
  blockMarker,
  isCombatMarker,
  parseBlockMarker,
  parseTargetMarker,
  targetMarker,
} from './markers.js';

describe('block markers', () => {
  it('round-trips the attacker being blocked', () => {
    expect(parseBlockMarker(blockMarker('atk-1'))).toBe('atk-1');
  });

  it('survives the UUIDs object ids actually are', () => {
    const id = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';
    expect(parseBlockMarker(blockMarker(id))).toBe(id);
  });

  it('reads anything that is not a block marker as not one', () => {
    expect(parseBlockMarker('flying')).toBeNull();
    expect(parseBlockMarker('attacking')).toBeNull();
    expect(parseBlockMarker('')).toBeNull();
  });

  it('refuses one with no attacker in it', () => {
    expect(parseBlockMarker('block:')).toBeNull();
  });
});

describe('target markers', () => {
  it('round-trips the target', () => {
    expect(parseTargetMarker(targetMarker('obj-9'))).toBe('obj-9');
  });

  it('reads anything else as not a target', () => {
    expect(parseTargetMarker('flying')).toBeNull();
    expect(parseTargetMarker('target:')).toBeNull();
  });
});

describe('isCombatMarker', () => {
  it('recognises everything PASS_TURN has to sweep up', () => {
    expect(isCombatMarker('attacking')).toBe(true);
    expect(isCombatMarker(blockMarker('a'))).toBe(true);
    expect(isCombatMarker(targetMarker('a'))).toBe(true);
  });

  it('leaves labels the players set alone — those outlive a turn', () => {
    expect(isCombatMarker('flying')).toBe(false);
    expect(isCombatMarker('monarch')).toBe(false);
    expect(isCombatMarker('summoning-sick')).toBe(false);
  });
});
