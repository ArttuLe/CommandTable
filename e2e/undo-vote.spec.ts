// An undo vote is something the whole table has to see the same way: who asked, how far the vote
// has got, and how it ended. Before, the requester saw nothing at all, voters saw no tally, and a
// rejection cleared the bar without a word — so this takes two clients.

import { expect, test } from '@playwright/test';
import { needsCardIndex, openSeat, playFromHand, startPlay } from './seat.js';

test.beforeEach(needsCardIndex);

test('the whole table sees the vote, its tally, and how it ended', async ({ browser }) => {
  // Three seats: plays a card, like the rest of that bucket (see seat.ts). All three sit down, so
  // the majority is a known two of three rather than whatever the dev table counts as connected.
  const alice = await openSeat(browser, 3, 'Alice');
  const bob = await openSeat(browser, 3, 'Bob');
  const carol = await openSeat(browser, 3, 'Carol');
  await startPlay(alice, [bob, carol]);

  // Alice's action, so Bob can't take it back on his own: he is asked, then it goes to a vote.
  await playFromHand(alice);
  await bob.keyboard.press('z');
  await bob.getByRole('dialog').getByRole('button', { name: 'Ask the table' }).click();

  // Bob's own approval is already in, so he waits rather than votes.
  await expect(bob.locator('.undo-request')).toContainText('Waiting for the table to approve your undo');
  await expect(bob.locator('.undo-request')).toContainText('1 of 2 approvals');
  await expect(bob.locator('.undo-request').getByRole('button')).toHaveCount(0);

  await expect(alice.locator('.undo-request')).toContainText('Bob wants to undo');
  await expect(alice.locator('.undo-request')).toContainText('1 of 2 approvals');
  await alice.locator('.undo-request').getByRole('button', { name: 'Reject' }).click();

  // One refusal of three leaves a majority still possible, so the vote stays open for Carol.
  await expect(carol.locator('.undo-request')).toContainText('Bob wants to undo');
  await carol.locator('.undo-request').getByRole('button', { name: 'Reject' }).click();

  for (const [page, whose] of [[alice, 'Bob’s'], [bob, 'your'], [carol, 'Bob’s']] as const) {
    await expect(page.locator('.notice-toast')).toHaveText(`The table turned down ${whose} undo.`);
    await expect(page.locator('.undo-request')).toHaveCount(0);
  }
});
