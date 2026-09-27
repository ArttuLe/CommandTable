# Features to add
- Actual cards as creature-tokens. Create token... creates a blank card with its power and name,
  we could use the actual cards from the data as tokens. The dialog should still open, but the
  player should be able to search and pick from a dropdown for example the right creature
  token.

## Minor changes to do

_Nothing outstanding._

## Done
- The room passphrase is no longer kept in localStorage. It lives in sessionStorage beside the
  tab marker, which is the only tab that resumes silently anyway — so a refresh still takes its
  seat back and a closed browser asks for the passphrase again.
- The commander-damage pill is the poison pill: same shape, same −/+. With one opposing commander
  the buttons act on it directly; a table with several keeps the list behind the pill, since
  "which commander" is then a real question.
- Right-clicking the table offers Zoom in / Zoom out / Fit at the cursor, zooming around the point
  you clicked, and the "follow the active player" toggle the settings gear carries. `F` fits from
  the keyboard. All of it is in the help dialog.
- Each player's name, life, zone counts and command zone moved off the board into a **player
  rail** beside it, half the board's height and hugging the mat's outer corner. The header band
  they were in cost every board a row of the height its three battlefield bands were competing
  for; the rail was added to the plane's width rather than taken out of the board, so the
  battlefield kept every pixel it had. Graveyard and exile counts are on the table for the first
  time — for everyone, not just yourself. The turn pill stands just outside the rail.
- Boards are taller (700px to 900px) and the cards on them are bigger (156px to 180px wide). The
  plane now keeps its own card size, separate from the hand and the zone popovers, since a narrow
  window is answered out there by the camera rather than by shrinking the table.
- "You kept." reads with the step's other prose instead of sitting in among the buttons.
- Player boards are wider — 1040px to 1170px in a four-player table, 1240px to 1500px in a
  two-player one.
- "Change controller" is gone from the card menu.
- Life, poison and commander damage moved from the crossroads into each board's header. The track
  between the mats existed only to hold them, so the boards are now a seam apart rather than a
  readout's width.
- `npm run dev` — a development-side script which spins up the host and dev with no password.
- `/devtest/:playerAmount/:playerName` — a dev-only route that boots a dealt table with N seats
  filled and decks resolved, stopping at the opening-hand step. See the Development section of
  the README.
- Playwright end-to-end tests (`npm run test:e2e`, specs in `e2e/`). They cover what the pure-logic
  `.ts` tests structurally cannot: the context menu staying inside the window with its last item
  reachable, the hand fan never overlapping the action bar at any card size, targeting not playing
  a card out of hand, the change pulse landing on the right tile on the *other* player's screen,
  the opening-hand step itself, which of two menus a right-click on the table opens, and one
  player's life landing on their own board on everybody's screen. Isolation is by seat count — one dev table exists per player
  amount, so each spec picks a number that suits what it does to the table (see the comment at the
  top of `e2e/seat.ts`).
