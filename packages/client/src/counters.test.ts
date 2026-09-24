import { describe, expect, it } from 'vitest';
import { counterBadgeText, counterKind } from './counters.js';

describe('counterKind', () => {
  it('reads the two counters the context menu writes on nearly every turn', () => {
    expect(counterKind('+1/+1')).toBe('buff');
    expect(counterKind('-1/-1')).toBe('debuff');
  });

  it('leaves the nameless counter neutral, like any other name', () => {
    expect(counterKind('counter')).toBe('other');
  });

  it('falls back to neutral for the long tail of counter names', () => {
    expect(counterKind('stun')).toBe('other');
    expect(counterKind('')).toBe('other');
  });
});

describe('counterBadgeText', () => {
  it('spells out what the counters add up to, rather than how many there are', () => {
    expect(counterBadgeText('+1/+1', 3)).toBe('+3/+3');
    expect(counterBadgeText('-1/-1', 2)).toBe('-2/-2');
  });

  it('shows a single +1/+1 as itself, not as a bare 1', () => {
    expect(counterBadgeText('+1/+1', 1)).toBe('+1/+1');
    expect(counterBadgeText('-1/-1', 1)).toBe('-1/-1');
  });

  it('keeps the nameless counter a bare number — four zombies read as 4', () => {
    expect(counterBadgeText('counter', 4)).toBe('4');
  });

  it('leaves the name off the long tail too — a badge is a count, not a caption', () => {
    expect(counterBadgeText('stun', 2)).toBe('2');
  });
});
