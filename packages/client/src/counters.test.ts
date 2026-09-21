import { describe, expect, it } from 'vitest';
import { counterBadgeText, counterKind } from './counters.js';

describe('counterKind', () => {
  it('reads the two counters the context menu writes on nearly every turn', () => {
    expect(counterKind('+1/+1')).toBe('buff');
    expect(counterKind('-1/-1')).toBe('debuff');
  });

  it('recognises loyalty however it was typed into the prompt', () => {
    expect(counterKind('loyalty')).toBe('loyalty');
    expect(counterKind('Loyalty')).toBe('loyalty');
  });

  it('falls back to neutral for the long tail of counter names', () => {
    expect(counterKind('stun')).toBe('other');
    expect(counterKind('')).toBe('other');
  });
});

describe('counterBadgeText', () => {
  it('shows a bare number where the colour already says what the counter is', () => {
    expect(counterBadgeText('+1/+1', 3)).toBe('3');
    expect(counterBadgeText('-1/-1', 1)).toBe('1');
    expect(counterBadgeText('loyalty', 5)).toBe('5');
  });

  it('keeps the name on counters that have no colour of their own', () => {
    expect(counterBadgeText('stun', 2)).toBe('stun 2');
  });
});
