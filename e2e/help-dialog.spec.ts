// `?` opens help, and help keeps the keyboard inside it until it closes.
//
// Both are about where keyboard focus goes, which only a browser decides: the trap lives in
// Dialog.tsx, so this is the regression check for every dialog, not only help.
//
// Four seats, the read-only bucket (see seat.ts): opening and closing help changes nothing on the table.

import { expect, test } from '@playwright/test';
import { needsCardIndex, openSeat } from './seat.js';

test.beforeEach(needsCardIndex);

test('? opens help, Tab stays inside it, and Escape hands focus back', async ({ browser }) => {
  const page = await openSeat(browser, 4, 'Alice');
  const help = page.getByRole('dialog', { name: 'Help' });
  const insideHelp = () => help.evaluate((dialog) => dialog.contains(document.activeElement));

  await page.keyboard.press('?');
  await expect(help).toBeVisible();
  expect(await insideHelp()).toBe(true);

  // More Tabs than the dialog has controls, so a leak past either end would show.
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('Tab');
    expect(await insideHelp()).toBe(true);
  }

  await help.getByRole('tab').first().focus();
  await page.keyboard.press('Shift+Tab');
  await expect(help.getByRole('button', { name: 'Got it' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(help).toBeHidden();
  await expect(page.getByRole('button', { name: 'Help', exact: true })).toBeFocused();
});
