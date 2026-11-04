// Theme, playmat and card back, picked in the gear (SettingsMenu.tsx, prefs.ts).
//
// prefs.test.ts owns what is stored. What it cannot reach is the CSS acting on it: that a pick
// lands as tokens on the page, that it survives a reload, and that each swatch still previews its
// own playmat rather than inheriting the one you picked.
//
// Four seats, the read-only bucket (see seat.ts): the look is client-local and touches no table.

import { expect, test, type Page } from '@playwright/test';
import { needsCardIndex, openSeat, startPlay } from './seat.js';

test.beforeEach(needsCardIndex);

function token(page: Page, name: string, selector = 'html'): Promise<string> {
  return page.locator(selector).first().evaluate((el, name) => getComputedStyle(el).getPropertyValue(name).trim(), name);
}

test('a picked look applies to the table and outlasts a reload', async ({ browser }) => {
  const alice = await openSeat(browser, 4, 'Alice');
  await startPlay(alice);

  await alice.getByRole('button', { name: 'Settings' }).click();
  await alice.getByRole('button', { name: 'Black' }).click();
  await alice.getByRole('button', { name: 'Green felt' }).click();
  await alice.getByRole('button', { name: 'Onyx' }).click();

  const picked = async () => {
    expect(await token(alice, '--accent')).toBe('#a987e6');
    expect(await token(alice, '--playmat')).toBe('#0f2218');
    expect(await token(alice, '--back-1')).toBe('#3b3a37');
    // The token alone proved nothing: the boards painted over it, so check what they paint.
    await expect(alice.locator('.board').first()).toHaveCSS('background-color', 'rgb(15, 34, 24)');
  };
  await picked();
  // The slate swatch shows slate, not the felt <html> now carries.
  expect(await token(alice, '--playmat', '.swatch-mat[data-playmat="slate"]')).not.toBe('#0f2218');

  await alice.reload();
  await expect(alice.locator('.hand .card-tile').first()).toBeVisible();
  await picked();
});
