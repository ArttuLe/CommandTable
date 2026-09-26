// Life, poison and commander damage on the board that owns them (Board.tsx's BoardVitals).
//
// They used to sit at the crossroads where the mats meet; they now ride in each board's header.
// Two things about that only a browser can check: that the numbers land on the *right* board —
// the header is the only thing naming whose they are now — and that they land on everyone's
// screen, since each player writes only their own row from their own HUD.
//
// Three seats, the bucket that already plays cards: this spec changes life and poison, which
// nothing else in that bucket reads.

import { expect, test, type Page } from '@playwright/test';
import { needsCardIndex, openSeat, startPlay } from './seat.js';

test.beforeEach(needsCardIndex);

/** One player's mat, found the way a person finds it: by the name in its header. */
function boardOf(page: Page, name: string) {
  return page.locator('.board').filter({ has: page.locator('.player-name', { hasText: name }) });
}

test('a life change shows on its own board, on both screens', async ({ browser }) => {
  const alice = await openSeat(browser, 3, 'Alice');
  const bob = await openSeat(browser, 3, 'Bob');
  await startPlay(alice, [bob, await openSeat(browser, 3, 'Carol')]);

  const before = Number(await boardOf(alice, 'Alice').locator('.board-life').textContent());

  // The one place a player writes their own row: their own HUD, never a neighbour's board.
  await alice.locator('.vitals-pad .vital').first().getByRole('button', { name: '−' }).click();

  await expect(boardOf(alice, 'Alice').locator('.board-life')).toHaveText(String(before - 1));
  await expect(boardOf(bob, 'Alice').locator('.board-life')).toHaveText(String(before - 1));
  // Bob's own board is not where Alice's life went.
  await expect(boardOf(bob, 'Bob').locator('.board-life')).not.toHaveText(String(before - 1));
});

// The badges are absent until there is something to say, which is why they cost an empty board
// no room — and why their appearing is worth asserting rather than their value alone.
test('poison appears on the board only once there is any', async ({ browser }) => {
  const alice = await openSeat(browser, 3, 'Alice');
  const bob = await openSeat(browser, 3, 'Bob');
  await startPlay(alice, [bob, await openSeat(browser, 3, 'Carol')]);

  await expect(boardOf(bob, 'Carol').locator('.poison')).toHaveCount(0);

  await alice.locator('.vitals-pad .vital').nth(1).getByRole('button', { name: '+' }).click();

  await expect(boardOf(bob, 'Alice').locator('.poison')).toHaveText('☠ 1');
  await expect(boardOf(bob, 'Carol').locator('.poison')).toHaveCount(0);
});

// The three vitals read as one row of one control, which means one height — and the commander
// pill is the one that can lose it: at three seats or more it opens a list instead of carrying
// its own −/+, and those buttons are what give the other two their height (styles.css).
test('life, poison and commander damage are the same height', async ({ browser }) => {
  const alice = await openSeat(browser, 3, 'Alice');
  await startPlay(alice, [await openSeat(browser, 3, 'Bob'), await openSeat(browser, 3, 'Carol')]);

  const pills = alice.locator('.vitals-pad > .vital, .vitals-pad > .damage-menu > .vital');
  await expect(pills).toHaveCount(3);

  const heights = await pills.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().height));
  expect(heights[1]).toBeCloseTo(heights[0], 1);
  expect(heights[2]).toBeCloseTo(heights[0], 1);
});
