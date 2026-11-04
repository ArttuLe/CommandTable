import { describe, expect, it } from 'vitest';
import type { PlayerState } from '@command-table/common';
import { winnerOf } from './winner.js';

const player = (id: string, status: PlayerState['status']) => ({ id, status }) as PlayerState;

describe('winnerOf', () => {
  it('names the last player still in once everyone else is out', () => {
    expect(winnerOf([player('a', 'conceded'), player('b', 'active'), player('c', 'conceded')])?.id).toBe('b');
  });

  it('has no winner while two or more are still playing', () => {
    expect(winnerOf([player('a', 'active'), player('b', 'active'), player('c', 'conceded')])).toBeNull();
  });

  // A table of one isn't a game anybody won.
  it('has no winner at a table of one', () => {
    expect(winnerOf([player('a', 'active')])).toBeNull();
  });
});
