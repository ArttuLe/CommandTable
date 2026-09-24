// The opening-hand step (SetupStep.tsx): the moment between the deal and turn 1.
//
// Two seats, because most of what this step does is tell the table about itself — who is still
// deciding, and one person's button moving everybody to a board.

import { expect, test } from '@playwright/test';
import { handIds, needsCardIndex, openSeat, OPENING_HAND } from './seat.js';

test.beforeEach(needsCardIndex);

test('mulligan, keep, and the host starting the game', async ({ browser }) => {
  // Two seats is this spec's alone: it is the only one that needs a table nobody has started.
  const alice = await openSeat(browser, 2, 'Alice');
  const bob = await openSeat(browser, 2, 'Bob');

  await expect(alice.locator('.turn-pill')).toHaveText('Opening hands');
  await expect(alice.locator('.setup-waiting')).toHaveText(/Alice/);
  await expect(alice.locator('.setup-waiting')).toHaveText(/Bob/);

  // A mulligan here is not a London one: it shuffles back and redraws seven (playerActions.ts).
  const before = await handIds(alice);
  await alice.getByRole('button', { name: 'Mulligan', exact: true }).click();
  await expect(alice.locator('.hand .card-tile')).toHaveCount(OPENING_HAND);
  await expect.poll(() => handIds(alice)).not.toEqual(before);

  // Keeping is reported to the other seat, not just this one.
  await alice.getByRole('button', { name: 'Keep', exact: true }).click();
  await expect(alice.locator('.setup-kept')).toBeVisible();
  await expect(bob.locator('.setup-waiting')).toHaveText(/Bob/);
  await expect(bob.locator('.setup-waiting')).not.toHaveText(/Alice/);

  // Only the host is offered the start, and one click moves both browsers.
  await expect(bob.getByRole('button', { name: 'Start the game' })).toHaveCount(0);
  await alice.getByRole('button', { name: 'Start the game' }).click();
  await expect(alice.locator('.setup-step')).toHaveCount(0);
  await expect(bob.locator('.setup-step')).toHaveCount(0);
  await expect(alice.locator('.turn-pill')).not.toHaveText('Opening hands');
});
