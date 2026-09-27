// The player rail: where it sits on its mat, and what it reports.
//
// Three things only a browser can answer. Where the rail lands is measured layout — seating.ts
// returns 'left' or 'bottom' and that proves nothing about which edge the panel ends up flush
// with, since the anchoring is two CSS rules (`.mat.rail-right`, `.mat.lands-bottom
// .player-rail`) acting on a flex row. That the board is nothing but battlefield now is the
// point of the whole change, and a unit test cannot see the DOM the component renders. And a
// graveyard count on somebody else's rail is a number two clients have to agree on.
//
// Three seats, the bucket that already plays cards and moves numbers: a quad, so one screen
// carries both a left-rail mat and a right-rail mat. This spec sends one permanent to a
// graveyard, which nothing else in the bucket reads.

import { expect, test, type Page } from '@playwright/test';
import { needsCardIndex, openSeat, playFromHand, startPlay } from './seat.js';

/** Boxes come back in fractional pixels; a hair either way is rounding, not a misplaced rail. */
const SLACK = 1;

test.beforeEach(needsCardIndex);

/** One player's mat, found the way a person finds it: by the name on its rail. */
function matOf(page: Page, name: string) {
  return page.locator('.mat').filter({ has: page.locator('.player-name', { hasText: name }) });
}

test('every rail hugs the outer corner of its own mat', async ({ browser }) => {
  const alice = await openSeat(browser, 3, 'Alice');
  await startPlay(alice, [await openSeat(browser, 3, 'Bob'), await openSeat(browser, 3, 'Carol')]);

  // Alice sees herself bottom-left and Carol top-right (seating.ts), which is the pair that
  // exercises both mirrors at once.
  const mine = matOf(alice, 'Alice');
  const opposite = matOf(alice, 'Carol');

  const rect = async (locator: ReturnType<typeof matOf>, selector: string) =>
    (await locator.locator(selector).boundingBox())!;

  const myRail = await rect(mine, '.player-rail');
  const myBoard = await rect(mine, '.board');
  // Bottom-left: outer column is the left one, outer row is the bottom one.
  expect(myRail.x + myRail.width).toBeLessThanOrEqual(myBoard.x + SLACK);
  expect(myRail.y + myRail.height).toBeCloseTo(myBoard.y + myBoard.height, 0);
  // And it is genuinely anchored, not merely as tall as the board.
  expect(myRail.height).toBeLessThan(myBoard.height);

  const theirRail = await rect(opposite, '.player-rail');
  const theirBoard = await rect(opposite, '.board');
  // Top-right: both mirrors flip.
  expect(theirRail.x).toBeGreaterThanOrEqual(theirBoard.x + theirBoard.width - SLACK);
  expect(theirRail.y).toBeCloseTo(theirBoard.y, 0);
});

// The header band is gone, not merely restyled — the height it was taking is what this change
// was for, so the board holding nothing but its three zones is the thing worth pinning down.
test('the board is battlefield and nothing else', async ({ browser }) => {
  const alice = await openSeat(browser, 3, 'Alice');
  await startPlay(alice, [await openSeat(browser, 3, 'Bob'), await openSeat(browser, 3, 'Carol')]);

  const children = matOf(alice, 'Alice').locator('.board > *');
  await expect(children).toHaveCount(1);
  await expect(children.first()).toHaveClass(/battlefield/);
});

// Graveyard and exile counts are new to the plane: before the rail there was nowhere on the
// table that said how big anybody's graveyard was, your own included. The count has to be the
// same number on everyone's screen, and it is the owner's play that moves it.
test('a graveyard count lands on its owner rail, on both screens', async ({ browser }) => {
  const alice = await openSeat(browser, 3, 'Alice');
  const bob = await openSeat(browser, 3, 'Bob');
  await startPlay(alice, [bob, await openSeat(browser, 3, 'Carol')]);

  // Bob is seated first so he is watching before Alice acts — this table is shared, so read the
  // count now and assert the increment rather than any fixed value.
  const bobsViewOfAlice = matOf(bob, 'Alice').locator('.rail-count-graveyard dd');
  const before = Number(await bobsViewOfAlice.textContent());

  const id = await playFromHand(alice);
  await alice.locator(`.battlefield [data-object-id="${id}"]`).click({ button: 'right' });
  await alice.locator('.context-menu').getByRole('button', { name: 'GY', exact: true }).click();

  await expect(bobsViewOfAlice).toHaveText(String(before + 1));
  await expect(matOf(alice, 'Alice').locator('.rail-count-graveyard dd')).toHaveText(String(before + 1));
  // Alice's card did not land in anybody else's graveyard on the way.
  await expect(matOf(bob, 'Bob').locator('.rail-count-graveyard dd')).toHaveText('0');
});
