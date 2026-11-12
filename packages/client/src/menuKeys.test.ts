import { describe, expect, it } from 'vitest';
import { nextMenuIndex } from './menuKeys.js';

describe('nextMenuIndex', () => {
  it('steps down and up, wrapping at either end', () => {
    expect(nextMenuIndex(0, 3, 'ArrowDown')).toBe(1);
    expect(nextMenuIndex(2, 3, 'ArrowDown')).toBe(0);
    expect(nextMenuIndex(0, 3, 'ArrowUp')).toBe(2);
  });

  it('jumps to the ends with Home and End', () => {
    expect(nextMenuIndex(1, 3, 'Home')).toBe(0);
    expect(nextMenuIndex(1, 3, 'End')).toBe(2);
  });

  it('enters from the right end when nothing in the menu has focus', () => {
    expect(nextMenuIndex(-1, 3, 'ArrowDown')).toBe(0);
    expect(nextMenuIndex(-1, 3, 'ArrowUp')).toBe(2);
  });

  it('leaves every other key alone', () => {
    expect(nextMenuIndex(0, 3, 'Enter')).toBeNull();
    expect(nextMenuIndex(0, 3, 'ArrowLeft')).toBeNull();
  });
});
