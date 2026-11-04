# Command Table

A browser tabletop for Commander (Magic: The Gathering), played with friends. The rules aren't
enforced: cards sit on a shared table and players move them, while the app keeps hidden
information hidden and handles the bookkeeping. That covers life, mana, commander tax and damage,
a log of every action, and undo.

- **Playing:** [HOW-TO-PLAY.md](HOW-TO-PLAY.md)
- **Hosting a game for friends:** [playing-with-a-friend.md](playing-with-a-friend.md)
- **The full design:** [commander-arena-design-doc-v0.2.md](commander-arena-design-doc-v0.2.md)

## Setup

Requires Node.js and npm.

```
npm install
npm run typecheck                                  # builds common, which server and client import
npm run ingest --workspace @command-table/server   # downloads Scryfall's card data into SQLite
```

Ingestion writes `packages/server/data/cards.sqlite3`, a cache of about 30 MB. It needs network
access to `api.scryfall.com`; re-run it now and then to pick up new cards. Only the machine running
the server needs it.

For the end-to-end tests, also run `npx playwright install chromium`.

> On NixOS that browser won't run. Use the nixpkgs build instead, and keep `@playwright/test` pinned
> to the version whose browsers it ships:
>
> ```
> export PLAYWRIGHT_BROWSERS_PATH=$(nix-build '<nixpkgs>' -A playwright-driver.browsers --no-out-link)
> ```

## Running

| Command | What it starts |
|---|---|
| `npm run host` | A real game: server and client together. It prints the link and passphrase to send your friends. |
| `npm run dev` | Development: the same two processes with no passphrase, plus the dev tables below. |
| `npm run dev --workspace @command-table/server` (or `…/client`) | One half on its own. |

The client is served on `:5173` and talks to the server on `:8080` at whatever hostname the page
was loaded from, so `localhost`, a LAN address and a Tailscale name all work without a rebuild.

### Configuration

| Variable | Default | Used by |
|---|---|---|
| `PORT` | `8080` | Server port |
| `CLIENT_PORT` | `5173` | Client port. Fails rather than falling back to another port, so the printed link is never wrong. |
| `VITE_SERVER_PORT` | `8080` | Server port the client connects to |
| `HOST_SECRET` | generated, then saved | The table passphrase. It is kept across restarts. |
| `SESSION_PATH` | `./data/sessions.json` | Saved games, relative to `packages/server` |
| `CARD_DB_PATH` | `./data/cards.sqlite3` | The card index, relative to `packages/server` |

### Saved games

Games in progress are saved to `SESSION_PATH` as they change, so a restart or a crash resumes them.
The file holds each room's seats, decklists, game state and players' rejoin tokens, along with the
passphrase, so treat it as carefully as the passphrase itself. A room expires a day after anyone
last did anything in it. Undo history isn't saved: after a restart you can undo back to the
restart, but not past it.

### Dev tables

With `npm run dev`, `/devtest/:players/:name` (for example
`http://localhost:5173/devtest/4/Alice`) opens a table that is already dealt. It has 2–4 seats
filled with the decklists in `packages/server/src/devtest/decks/` and stops at the opening-hand
step.

- Seats are named Alice, Bob, Carol and Dave, in seat order. Alice is the host.
- Open other names in other tabs to sit at the same table.
- Each seat count is its own table.
- Dev tables are saved to `data/dev-sessions.json`, apart from real games.

The route and the missing passphrase both exist only when `DEV_MODE=1`, which only `npm run dev`
sets. The client half is compiled out of a production build.

## Structure

```
packages/
  common/   Types shared by both sides: cards, decklists, lobby and table state, actions, the log,
            and the WebSocket protocol (protocol.ts)
  server/   Node HTTP and WebSocket server: rooms, saved games, the card index, decklist parsing
            and resolution, the action applier (actionApplier.ts, actions/), the per-player
            projection that hides what each player may not see (projection.ts), and undo history
  client/   React, Vite and Zustand: Home → Lobby → Table. The table is a pan/zoom plane of player
            mats, with chat and log rails and the player's own bottom bar.
e2e/        Playwright specs, driven against the dev tables
```

The server is authoritative. Every action is applied there and each client is sent only its own
projection of the table. Nothing is optimistic on the client.

Logic lives in pure modules with their own tests, apart from the components that use them. For
example: `planeView.ts` (pan and zoom), `seating.ts`, `battlefieldZones.ts`, `cardMenu.ts`,
`manaSources.ts`, `combat.ts` and `logText.ts` on the client, and `actionApplier.ts`,
`projection.ts`, `undo.ts` and `decklistParser.ts` on the server. Components measure the DOM and
paint; the pure modules decide.

## Testing

```
npm test             # Vitest, every package
npm run test:e2e     # Playwright, e2e/
```

`npm run typecheck` covers `common` and `server`. Check the client with `npx tsc -b packages/client`
and the specs with `npx tsc -p e2e`.

The Playwright suite starts its own server and client on ports 8091/5174, so it doesn't disturb a
`npm run dev` already running. It needs the card index and skips itself without one. It runs in
about fifteen seconds. Specs share one dev table per seat count, so read the comment at the top of
`e2e/seat.ts` before adding one.

### Writing them

Write a Vitest test beside the module for anything a pure function decides; these run in
milliseconds. Write a Playwright spec when the claim is only true in a browser:

- **Measured layout, and the CSS acting on it.** A function returning the right number proves
  nothing about where the cards actually land.
- **Something two clients have to agree on.** One browser can't show you that Bob saw it too.
- **A mode that changes what an interaction means**, such as an armed arrow, an open menu or a
  drag.
- **A regression you just fixed in any of the above**, so that it stays fixed.

Two rules, both learned the hard way:

- **Check that the spec can fail.** Break the thing on purpose and watch it go red before trusting
  it green.
- **Never assert "nothing changed" on its own.** Actions round-trip the server, so "the hand is the
  same" holds for a moment whether or not the bug is there. Wait for the change the interaction
  *is* meant to make, then assert what it must not have done. `targeting.spec.ts` is the worked
  example.

Specs are `e2e/*.spec.ts`. The `.spec.ts` suffix, rather than `.test.ts`, keeps Vitest out of them.
