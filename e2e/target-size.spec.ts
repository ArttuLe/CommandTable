// The smallest controls in the app meet WCAG 2.5.8's 24×24 floor.
//
// They are sized in CSS that also carries a pill, a menu row or a strip of chrome, so the number
// that matters is the box the browser actually lays out — which only a browser can measure. These
// are the ones that came out under it: the help button, the rails' collapse arrows, your life
// total, and the card menu's steppers and move chips.

import { expect, test, type Locator } from '@playwright/test';
import { needsCardIndex, openSeat, playFromHand, startPlay } from './seat.js';

test.beforeEach(needsCardIndex);

/** Boxes come back in fractional pixels; a hair under is rounding, not a miss. */
const FLOOR = 24 - 0.5;

async function expectAtLeastFloor(targets: Locator, what: string) {
  const boxes = await targets.evaluateAll((els) => els.map((el) => el.getBoundingClientRect()));
  expect(boxes.length, what).toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box.width, what).toBeGreaterThanOrEqual(FLOOR);
    expect(box.height, what).toBeGreaterThanOrEqual(FLOOR);
  }
}

test('the smallest controls are at least 24px square', async ({ browser }) => {
  // Three seats: plays a card, because the counter steppers are only on a card in play
  // (cardMenu.ts), and that is the bucket allowed to play one (see seat.ts).
  const page = await openSeat(browser, 3, 'Alice');
  await startPlay(page);
  const played = await playFromHand(page);

  await expectAtLeastFloor(page.locator('.help-button'), 'help button');
  await expectAtLeastFloor(page.locator('.vitals-pad button.vital-count'), 'life total');

  await page.keyboard.press('c');
  await expectAtLeastFloor(page.locator('.rail-header .icon-button'), 'rail collapse');

  await page.keyboard.press('c');
  await page.locator(`.battlefield [data-object-id="${played}"]`).click({ button: 'right' });
  await expectAtLeastFloor(page.locator('.context-menu .menu-stepper button'), 'menu stepper');
  await expectAtLeastFloor(page.locator('.context-menu .menu-chips button'), 'move chip');
});
