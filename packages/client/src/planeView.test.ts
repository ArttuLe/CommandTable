import { describe, expect, it } from 'vitest';
import { MAX_SCALE, MIN_SCALE, fitView, focusView, zoomAt, type View } from './planeView.js';

/** Where a plane-space point lands on screen under a given view. */
const project = (view: View, point: { x: number; y: number }) => ({
  x: view.x + point.x * view.scale,
  y: view.y + point.y * view.scale,
});

describe('zoomAt', () => {
  const view: View = { x: 0, y: 0, scale: 1 };

  it('keeps the plane point under the cursor pinned to the cursor', () => {
    const cursor = { x: 300, y: 200 };
    const before = (cursor.x - view.x) / view.scale;

    const zoomed = zoomAt(view, cursor, 1.25);

    expect(project(zoomed, { x: before, y: 0 }).x).toBeCloseTo(cursor.x);
  });

  it('pins the cursor point when zooming out too', () => {
    const start: View = { x: -120, y: 40, scale: 1.4 };
    const cursor = { x: 500, y: 350 };
    const point = { x: (cursor.x - start.x) / start.scale, y: (cursor.y - start.y) / start.scale };

    const zoomed = zoomAt(start, cursor, 0.8);

    const after = project(zoomed, point);
    expect(after.x).toBeCloseTo(cursor.x);
    expect(after.y).toBeCloseTo(cursor.y);
  });

  it('clamps at the zoom limits', () => {
    expect(zoomAt({ x: 0, y: 0, scale: MAX_SCALE }, { x: 0, y: 0 }, 4).scale).toBe(MAX_SCALE);
    expect(zoomAt({ x: 0, y: 0, scale: MIN_SCALE }, { x: 0, y: 0 }, 0.1).scale).toBe(MIN_SCALE);
  });

  it('does not drift the view when a zoom is clamped away', () => {
    const clamped: View = { x: -50, y: -25, scale: MAX_SCALE };

    expect(zoomAt(clamped, { x: 400, y: 300 }, 2)).toEqual(clamped);
  });
});

describe('fitView', () => {
  it('scales to the limiting dimension and centers the content', () => {
    const view = fitView({ width: 2000, height: 1000 }, { width: 1000, height: 1000 }, 0);

    expect(view.scale).toBeCloseTo(0.5);
    expect(view.x).toBeCloseTo(0);
    expect(view.y).toBeCloseTo(250);
  });

  it('accounts for padding on both edges', () => {
    const view = fitView({ width: 1000, height: 1000 }, { width: 600, height: 600 }, 50);

    expect(view.scale).toBeCloseTo(0.5);
    expect(view.x).toBeCloseTo(50);
  });

  it('never magnifies past the zoom ceiling when content is tiny', () => {
    const view = fitView({ width: 10, height: 10 }, { width: 1000, height: 1000 }, 0);

    expect(view.scale).toBe(MAX_SCALE);
  });

  it('survives a zero-sized viewport during first layout', () => {
    const view = fitView({ width: 0, height: 0 }, { width: 0, height: 0 }, 24);

    expect(Number.isFinite(view.scale)).toBe(true);
    expect(Number.isFinite(view.x)).toBe(true);
  });
});

describe('focusView', () => {
  const viewport = { width: 1000, height: 800 };

  it('centers the board it is given in the viewport', () => {
    const view = focusView({ x: 200, y: 100, width: 400, height: 200 }, viewport, 0);

    // The board's midpoint (400, 200) lands on the viewport's midpoint (500, 400).
    expect(view.x + 400 * view.scale).toBeCloseTo(500);
    expect(view.y + 200 * view.scale).toBeCloseTo(400);
  });

  it('zooms in until the board fills the viewport, limited by its tighter axis', () => {
    // Height is the binding constraint here: 800/200 = 4 beats 1000/400 = 2.5.
    expect(focusView({ x: 0, y: 0, width: 400, height: 200 }, viewport, 0).scale).toBe(2.5);
  });

  it('never zooms past the manual zoom ceiling', () => {
    expect(focusView({ x: 0, y: 0, width: 10, height: 10 }, viewport, 0).scale).toBe(MAX_SCALE);
  });

  it('leaves the requested padding around the board', () => {
    const view = focusView({ x: 0, y: 0, width: 400, height: 400 }, { width: 500, height: 500 }, 50);

    expect(view.scale).toBe(1);
    expect(view.x).toBe(50);
  });
});
