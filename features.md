# Features to add
- Playwright end-to-end tests. Nothing in the client has automated coverage today — every test
  file is pure-logic `.ts`, so layout and interaction work is verified by hand (scripted `ws`
  clients, or driving a real browser). Playwright would cover what unit tests structurally
  cannot: the context menu not scrolling, the hand fan not spilling over the action bar,
  targeting not playing a card out of hand, the change pulse landing on the right tile.
  `/devtest/:playerAmount/:playerName` (below) is what makes these cheap to write.
- Actual cards as creature-tokens. Create token... creates a blank card with its power and name,
  we could use the actual cards from the data as tokens. The dialog should still open, but the
  player should be able to search and pick from a dropdown for example the right creature
  token.

## Done
- `npm run dev` — a development-side script which spins up the host and dev with no password.
- `/devtest/:playerAmount/:playerName` — a dev-only route that boots a ready-made table with N
  seats filled, decks resolved and the game already started. See the Development section of the
  README.
