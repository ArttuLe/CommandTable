// An armed arrow owns the next click.
//
// "Target…" puts the table into a mode, and the click that follows has to mean "point at this"
// wherever it lands — including on a card in hand, which a double-click normally plays. The
// double-click is the hard case: its first click points and stands the mode down, so the second
// arrives with no mode armed and must still not play the card. That guard lives at
// the one chokepoint every tile goes through (CardTile.tsx); before it, arming an arrow and then
// picking a target in hand cast the card as well.

import { expect, test } from '@playwright/test';
import { handIds, needsCardIndex, openSeat, playFromHand, startPlay } from './seat.js';

test.beforeEach(needsCardIndex);

test('pointing at a card in hand does not also play it', async ({ browser }) => {
  // Three seats: shared with change-pulse.spec.ts. Both play a card; neither minds the other's.
  const page = await openSeat(browser, 3, 'Alice');
  await startPlay(page);

  // Something to point *from*. The battlefield starts empty — commanders go to the command zone
  // and everything else to library and hand (tableFactory.ts).
  const sourceId = await playFromHand(page);
  const source = page.locator(`.battlefield [data-object-id="${sourceId}"]`);

  await source.click({ button: 'right' });
  await page.getByRole('button', { name: 'Target…' }).click();
  await expect(page.locator('.targeting-hint')).toBeVisible();

  const handBefore = await handIds(page);
  const onBattlefield = await page.locator('.battlefield .card-tile').count();

  await page.locator('.hand .card-tile').last().dblclick();
  await expect(page.locator('.targeting-hint')).toBeHidden();

  // Wait for the one thing this click is allowed to do to come back from the server before
  // asking what else it did. Nothing here may be a bare "is it still unchanged?" — the answer is
  // yes until the round trip lands, so such a check would pass whether the guard exists or not.
  await source.click({ button: 'right' });
  await expect(page.getByRole('button', { name: 'Clear target' })).toBeVisible();

  // Read with the menu still open: both of these only measure, and dismissing it first is one
  // more interaction that could go wrong in a test about clicks going wrong.
  // Comparing the ids rather than the count is the same work and also catches a swap.
  expect(await handIds(page)).toEqual(handBefore);
  expect(await page.locator('.battlefield .card-tile').count()).toBe(onBattlefield);
});
