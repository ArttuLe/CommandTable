import { describe, expect, it } from 'vitest';
import type { GameObject } from '@command-table/common';
import { clearSweepMessage } from './clearSweep.js';

const card = (id: string, counters: Record<string, number> = {}, markers: string[] = []) =>
  ({ id, counters, markers }) as unknown as GameObject;

describe('clearSweepMessage', () => {
  it('counts every counter, every other mark and the cards carrying them, everyone’s included', () => {
    const objects = [
      card('a', { '+1/+1': 3 }),
      card('b', { counter: 4 }, ['flying']),
      card('c', {}, ['attacking', 'block:a']),
      card('d'),
    ];
    expect(clearSweepMessage(objects)).toBe(
      'This takes 7 counters and 3 labels or combat markers off 3 cards — everyone’s, not just yours.'
    );
  });

  // The server spares summoning sickness (objectActions.ts), so promising to remove it would be
  // a count of something that stays.
  it('leaves summoning sickness out, as the sweep does', () => {
    expect(clearSweepMessage([card('a', { '+1/+1': 1 }, ['summoning-sick'])])).toBe(
      'This takes 1 counter and 0 labels or combat markers off 1 card — everyone’s, not just yours.'
    );
  });

  it('says so when there is nothing to clear', () => {
    expect(clearSweepMessage([card('a', {}, ['summoning-sick'])])).toBe(
      'There is nothing to clear: no card on the table carries a counter or a label.'
    );
  });
});
