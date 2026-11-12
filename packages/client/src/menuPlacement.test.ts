import { describe, expect, it } from 'vitest';
import { placeMenu } from './menuPlacement.js';

const viewport = { width: 1000, height: 800 };
const menu = { width: 200, height: 300 };

describe('placeMenu', () => {
  it('opens below-right of the cursor when there is room', () => {
    expect(placeMenu({ x: 100, y: 100 }, menu, viewport)).toEqual({ left: 100, top: 100 });
  });

  it('flips upward when the menu would run past the bottom edge', () => {
    expect(placeMenu({ x: 100, y: 700 }, menu, viewport)).toEqual({ left: 100, top: 400 });
  });

  it('flips leftward when the menu would run past the right edge', () => {
    expect(placeMenu({ x: 950, y: 100 }, menu, viewport)).toEqual({ left: 750, top: 100 });
  });

  it('flips on both axes at once in the bottom-right corner', () => {
    expect(placeMenu({ x: 950, y: 700 }, menu, viewport)).toEqual({ left: 750, top: 400 });
  });

  it('clamps rather than flipping when the menu fits on neither side', () => {
    const tall = { width: 200, height: 780 };
    expect(placeMenu({ x: 100, y: 700 }, tall, viewport).top).toBe(12);
    // Taller than the viewport itself: pinned to the top margin and scrolled, never off-screen.
    expect(placeMenu({ x: 100, y: 10 }, { width: 200, height: 900 }, viewport).top).toBe(8);
  });

  it('keeps a flipped menu on screen when it was asked for below the window', () => {
    // The keyboard asks at the card's centre, wherever the card is (Shift+F10 on a tile scrolled out
    // of a short window). Flipped above that point, the menu still hung off the bottom.
    expect(placeMenu({ x: 100, y: 1100 }, menu, viewport).top).toBe(492);
  });
});
