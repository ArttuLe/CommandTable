import { describe, expect, it } from 'vitest';
import { fisherYatesShuffle } from './shuffle.js';

describe('fisherYatesShuffle', () => {
  it('returns a permutation containing exactly the same elements', () => {
    const input = [1, 2, 3, 4, 5];
    const result = fisherYatesShuffle(input, () => 0);
    expect(result.slice().sort()).toEqual(input.slice().sort());
    expect(result).toHaveLength(input.length);
  });

  it('does not mutate the input array', () => {
    const input = [1, 2, 3];
    fisherYatesShuffle(input, () => 0);
    expect(input).toEqual([1, 2, 3]);
  });

  it('applies the standard Fisher-Yates swaps for a given randomInt sequence', () => {
    // Walking i from the end down to 1, each swaps position i with randomInt(i+1).
    // With randomInt always returning 0, that's: swap(3,0), swap(2,0), swap(1,0).
    const result = fisherYatesShuffle([1, 2, 3, 4], () => 0);
    expect(result).toEqual([2, 3, 4, 1]);
  });

  it('handles empty and single-element arrays', () => {
    expect(fisherYatesShuffle([], () => 0)).toEqual([]);
    expect(fisherYatesShuffle([1], () => 0)).toEqual([1]);
  });
});
