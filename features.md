# Features to add
- Actual cards as creature-tokens. Create token... creates a blank card with its power and name,
  we could use the actual cards from the data as tokens. The dialog should still open, but the
  player should be able to search and pick from a dropdown for example the right creature
  token.

## Minor changes to do
- Don't persist room passphrase in (localStorage?)

## Done
- `npm run dev` — a development-side script which spins up the host and dev with no password.
- `/devtest/:playerAmount/:playerName` — a dev-only route that boots a dealt table with N seats
  filled and decks resolved, stopping at the opening-hand step. See the Development section of
  the README.
- Playwright end-to-end tests (`npm run test:e2e`, specs in `e2e/`). They cover what the pure-logic
  `.ts` tests structurally cannot: the context menu staying inside the window with its last item
  reachable, the hand fan never overlapping the action bar at any card size, targeting not playing
  a card out of hand, the change pulse landing on the right tile on the *other* player's screen,
  and the opening-hand step itself. Isolation is by seat count — one dev table exists per player
  amount, so each spec picks a number that suits what it does to the table (see the comment at the
  top of `e2e/seat.ts`).
