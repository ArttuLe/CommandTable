import { describe, expect, it } from 'vitest';
import { nextDelay } from './backoff.js';

const noJitter = () => 1;

describe('nextDelay', () => {
  it('grows exponentially from 500ms', () => {
    expect(nextDelay(0, noJitter)).toBe(500);
    expect(nextDelay(1, noJitter)).toBe(1000);
    expect(nextDelay(2, noJitter)).toBe(2000);
  });

  it('caps at 8s however long the outage lasts', () => {
    expect(nextDelay(10, noJitter)).toBe(8000);
    expect(nextDelay(100, noJitter)).toBe(8000);
  });

  // Four clients dropped by the same host restart shouldn't retry in lockstep.
  it('jitters within half the capped delay, never to zero', () => {
    expect(nextDelay(5, () => 0)).toBe(4000);
    expect(nextDelay(5, () => 1)).toBe(8000);
  });
});
