// Passing out of turn asks first, and Enter answers "no". It used to focus "Pass turn", so a stray
// P then Enter ended someone else's turn. Focus is only real in a browser.

import { expect, test, type Page } from '@playwright/test';
import { needsCardIndex, openSeat, startPlay } from './seat.js';

test.beforeEach(needsCardIndex);

const turnNumber = async (page: Page) => Number((await page.locator('.turn-pill').textContent())?.match(/Turn (\d+)/)?.[1]);

test('Enter cancels an out-of-turn pass', async ({ browser }) => {
  // Three seats: it passes the turn, which the four-seat bucket must not be left with (see seat.ts).
  const seats = await Promise.all(['Alice', 'Bob', 'Carol'].map((name) => openSeat(browser, 3, name)));
  await startPlay(seats[0], seats.slice(1));

  const mine = await Promise.all(seats.map((page) => page.locator('.turn-pill.mine').count()));
  const active = seats[mine.indexOf(1)];
  const outsider = seats[mine.indexOf(0)];
  const activeName = (await outsider.locator('.turn-pill').textContent())?.match(/— (.+)'s turn/)?.[1];
  const before = await turnNumber(outsider);

  await outsider.keyboard.press('p');
  const dialog = outsider.getByRole('dialog');
  await expect(dialog).toContainText(`It is ${activeName}'s turn. Passing now ends ${activeName}'s turn.`);
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  await outsider.keyboard.press('Enter');
  await expect(dialog).toHaveCount(0);

  // The active player's own pass is the one change that should land. Had Enter passed, it would
  // no longer be their turn, and P would ask them instead of passing.
  await active.keyboard.press('p');
  await expect.poll(() => turnNumber(outsider)).toBe(before + 1);
  await expect(active.getByRole('dialog')).toHaveCount(0);
});
