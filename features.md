# Features to add
- npm run dev a development side script which spins up the host and dev with no password
- Playwright end-to-end tests. Nothing in the client has automated coverage today — every test
  file is pure-logic `.ts`, so layout and interaction work is verified by hand (scripted `ws`
  clients, or driving a real browser). Playwright would cover what unit tests structurally
  cannot: the context menu not scrolling, the hand fan not spilling over the action bar,
  targeting not playing a card out of hand, the change pulse landing on the right tile.
- `/devtest/:players` — a dev-only route that boots a ready-made table with N seats filled,
  decks resolved and the game already started, so a change can be looked at in one click
  instead of a room plus a decklist per seat plus a host start. That setup currently has to be
  scripted over the WebSocket by hand every time. Needs a guard so it can't be reached on a
  real host, and it is also what would make the Playwright tests above cheap to write.
- Actual cards as creature-tokens. Create token... creates a blank card with its power and name,
  we could use the actual cards from the data as tokens. The dialog should still open, but the
  player should be able to search and pick from a dropdown for example the right creature
  token.
