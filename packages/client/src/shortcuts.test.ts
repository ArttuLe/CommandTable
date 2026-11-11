import { describe, expect, it } from 'vitest';
import { HOW_TOS } from './shortcuts.js';

describe('HOW_TOS', () => {
  it('never ends a menu label’s ellipsis with a full stop', () => {
    expect(HOW_TOS.filter(({ how }) => how.includes('….'))).toEqual([]);
  });
});
