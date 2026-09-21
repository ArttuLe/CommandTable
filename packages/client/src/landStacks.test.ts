import { describe, expect, it } from 'vitest';
import { isBasicLandName, stackLands } from './landStacks.js';

describe('isBasicLandName', () => {
  it('recognises the basics, including snow-covered ones', () => {
    expect(isBasicLandName('Forest')).toBe(true);
    expect(isBasicLandName('Snow-Covered Island')).toBe(true);
    expect(isBasicLandName('Wastes')).toBe(true);
  });

  it('leaves everything else alone', () => {
    expect(isBasicLandName('Command Tower')).toBe(false);
    expect(isBasicLandName(null)).toBe(false);
  });
});

describe('stackLands', () => {
  const land = (id: string, name: string | null, tapped = false) => ({ id, name, tapped });
  const infoOf = (l: { name: string | null; tapped: boolean }) => l;

  it('collapses identical basics into one stack, in first-appearance order', () => {
    const stacks = stackLands(
      [land('a', 'Forest'), land('b', 'Island'), land('c', 'Forest')],
      infoOf
    );

    expect(stacks.map((s) => s.objects.map((o) => o.id))).toEqual([['a', 'c'], ['b']]);
  });

  it('keeps tapped basics apart from untapped ones, so a stack still reads as mana', () => {
    const stacks = stackLands([land('a', 'Forest'), land('b', 'Forest', true)], infoOf);

    expect(stacks.map((s) => s.objects.map((o) => o.id))).toEqual([['a'], ['b']]);
    expect(stacks.map((s) => s.tapped)).toEqual([false, true]);
  });

  it('gives non-basics and face-down lands a stack each, even when named alike', () => {
    const stacks = stackLands(
      [land('a', 'Command Tower'), land('b', 'Command Tower'), land('c', null), land('d', null)],
      infoOf
    );

    expect(stacks.map((s) => s.objects.map((o) => o.id))).toEqual([['a'], ['b'], ['c'], ['d']]);
  });

  it('has nothing to draw for an empty band', () => {
    expect(stackLands([], infoOf)).toEqual([]);
  });
});
