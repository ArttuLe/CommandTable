// A seat has one live connection. Opening it again elsewhere moves it there, and the old tab says
// so and stops — rather than reconnecting, taking the seat back, and the two tabs trading it
// forever. The server closes the old socket with SUPERSEDED (protocol.ts); this is the two-client
// half only a browser can show.

import { expect, test } from '@playwright/test';
import { needsCardIndex, openSeat } from './seat.js';

test.beforeEach(needsCardIndex);

test('opening a seat in a second tab stops the first, and only the first', async ({ browser }) => {
  // Four seats, read-only: opens Dave twice and does nothing at the table.
  const first = await openSeat(browser, 4, 'Dave');
  const second = await openSeat(browser, 4, 'Dave');

  await expect(first.locator('.error-toast')).toContainText('opened somewhere else');
  await expect(second.locator('.error-toast')).toHaveCount(0);
  // The second tab is still at the table and still hears it: its own life change comes back.
  const life = second.locator('.vitals-pad .vital-count').first();
  const before = Number(await life.textContent());
  await second.locator('.vitals-pad').getByRole('button', { name: 'Gain 1 life' }).click();
  await expect(life).toHaveText(String(before + 1));
  await second.locator('.vitals-pad').getByRole('button', { name: 'Lose 1 life' }).click();
  await expect(life).toHaveText(String(before));
});
