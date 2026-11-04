// The table's own right-click menu, and the F shortcut beside it (Plane.tsx).
//
// Unit tests own the zoom maths (planeView.ts) and the placement (menuPlacement.ts). What they
// cannot reach is which menu a right-click opens: the same gesture means "this card" over a card
// and "this table" over the background, and only a real hit test can tell the two apart. Nor can
// they reach whether Fit and F actually land on the same view.
//
// Four seats, the read-only bucket (see seat.ts): this spec only ever moves its own camera, which
// is client-local and leaves the table exactly as it found it.

import { expect, test, type Page } from '@playwright/test';
import { needsCardIndex, openSeat, startPlay } from './seat.js';

test.beforeEach(needsCardIndex);

/** The plane's live transform. It is written as an inline style by Plane, so it reads back exactly. */
function transform(page: Page): Promise<string> {
  return page.locator('.plane').evaluate((el) => (el as HTMLElement).style.transform);
}

function scaleOf(css: string): number {
  const match = css.match(/scale\(([\d.]+)\)/);
  if (!match) throw new Error(`no scale in ${css}`);
  return Number(match[1]);
}

test('right-clicking the table zooms and fits, and F fits too', async ({ browser }) => {
  const alice = await openSeat(browser, 4, 'Alice');
  await startPlay(alice, [await openSeat(browser, 4, 'Bob')]);

  // The top-left corner of the viewport is plane background: the mats are centred by the fit.
  // Fit first, and take that as the baseline: the view the plane opened with is checked on its own
  // below, and this test is about the menu and the key landing on the same view.
  await alice.locator('.plane-viewport').click({ button: 'right', position: { x: 12, y: 12 } });
  await expect(alice.locator('.context-menu-title')).toHaveText('The table');
  await alice.getByRole('button', { name: 'Fit the whole table' }).click();
  await expect(alice.locator('.context-menu')).toHaveCount(0);
  const fitted = await transform(alice);

  await alice.locator('.plane-viewport').click({ button: 'right', position: { x: 12, y: 12 } });
  await alice.getByRole('button', { name: 'Zoom in' }).click();
  expect(scaleOf(await transform(alice))).toBeGreaterThan(scaleOf(fitted));

  // Fit from the menu undoes it exactly.
  await alice.locator('.plane-viewport').click({ button: 'right', position: { x: 12, y: 12 } });
  await alice.getByRole('button', { name: 'Fit the whole table' }).click();
  expect(await transform(alice)).toBe(fitted);

  // And so does the keyboard, which is the point of listing it in the help dialog.
  await alice.locator('.plane-viewport').click({ button: 'right', position: { x: 12, y: 12 } });
  await alice.getByRole('button', { name: 'Zoom out' }).click();
  expect(scaleOf(await transform(alice))).toBeLessThan(scaleOf(fitted));
  await alice.keyboard.press('f');
  expect(await transform(alice)).toBe(fitted);
});

// The gesture is the same; the subject is not. A card's menu naming the table would be the bug.
test('right-clicking a card still opens that card, not the table', async ({ browser }) => {
  const alice = await openSeat(browser, 4, 'Alice');
  await startPlay(alice, [await openSeat(browser, 4, 'Bob')]);

  await alice.locator('.hand .card-tile').last().click({ button: 'right' });
  await expect(alice.locator('.context-menu-title')).not.toHaveText('The table');
  await expect(alice.getByRole('button', { name: 'Zoom in' })).toHaveCount(0);
});

// The menu carries the settings gear's follow toggle. One setting behind two controls is the
// thing that can quietly become two, and each would then report a different answer.
test('following can be switched from the table menu, and the gear agrees', async ({ browser }) => {
  const alice = await openSeat(browser, 4, 'Alice');
  await startPlay(alice, [await openSeat(browser, 4, 'Bob')]);

  const gearToggle = alice.getByRole('checkbox');
  await alice.getByRole('button', { name: 'Settings' }).click();
  await expect(gearToggle).not.toBeChecked();
  await alice.keyboard.press('Escape');

  await alice.locator('.plane-viewport').click({ button: 'right', position: { x: 12, y: 12 } });
  await alice.getByRole('button', { name: 'Follow the active player' }).click();

  await alice.getByRole('button', { name: 'Settings' }).click();
  await expect(gearToggle).toBeChecked();
  await alice.keyboard.press('Escape');

  // And the menu says what the next click would do, not what the last one did.
  await alice.locator('.plane-viewport').click({ button: 'right', position: { x: 12, y: 12 } });
  await expect(alice.getByRole('button', { name: 'Stop following the active player' })).toBeVisible();
  await alice.getByRole('button', { name: 'Stop following the active player' }).click();
  await alice.getByRole('button', { name: 'Settings' }).click();
  await expect(gearToggle).not.toBeChecked();
});

/** How far the plane's scale is from what a fit would give for the sizes on screen right now. */
function fitScaleGap(page: Page): Promise<number> {
  return page.evaluate(() => {
    const viewport = document.querySelector<HTMLElement>('.plane-viewport')!;
    const plane = document.querySelector<HTMLElement>('.plane')!;
    const scale = Number(/scale\(([\d.]+)\)/.exec(plane.style.transform)![1]);
    // fitView's own sum, with Plane's FIT_PADDING of 24 on each side, clamped to planeView's
    // MIN_SCALE and MAX_SCALE as fitView clamps it — a short window can ask for less than 0.15.
    const fit = Math.min((viewport.clientWidth - 48) / plane.offsetWidth, (viewport.clientHeight - 48) / plane.offsetHeight);
    return Math.abs(scale - Math.min(2.5, Math.max(0.15, fit)));
  });
}

// The first fit used to be measured before the hand had fanned and the HUD had settled, so a table
// opened well short of its real fit — tiny, in the top middle — and stayed that way until F.
test('the table opens framed, and stays framed while the window changes', async ({ browser }) => {
  const alice = await openSeat(browser, 4, 'Alice');
  await expect.poll(() => fitScaleGap(alice)).toBeLessThan(0.001);

  await alice.setViewportSize({ width: 1024, height: 700 });
  await expect.poll(() => fitScaleGap(alice)).toBeLessThan(0.001);
});
