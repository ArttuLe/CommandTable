# Command Table

Commander-only MTG web client. Freeform digital tabletop (no rules enforcement) — see
`commander-arena-design-doc-v0.2.md` for the full design.

## Structure

```
packages/
  common/   Shared TypeScript types (cards, decklists, lobby/table state, wire protocol, actions, log)
  server/   Node WebSocket server: room manager, card index, decklist parser/resolver, ingestion,
            table factory, action applier (dispatch + actions/{object,zone,player,meta}Actions.ts),
            projection boundary, table history + undo, and the dev-only devtest/ table fixture
  client/   Minimal React client: Home (create/join room) → Lobby (seats, decklist, ready/start)
            → Table (a pan/zoom plane of per-player mats — a board plus a rail carrying that
            player's read-only life, zone counts and command zone — collapsible chat and log rails
            either side of it, an SVG arrow overlay for blocks and spell targets, and a fixed
            bottom band of hand + vitals + mana + zones + actions, wired
            straight to the WebSocket via a Zustand store)
e2e/        Playwright specs driving the dev-table route in a real browser (see Testing)
```

The client keeps its geometry and its rules-of-thumb in pure modules with their own tests, apart
from the components that use them: `planeView.ts` (pan/zoom), `arrows.ts` (arrow geometry),
`combat.ts` (reading combat off markers), `counters.ts`/`labels.ts` (how a badge reads),
`seating.ts`, `battlefieldZones.ts`, `playerRail.ts` (which rows a rail shows). A component
measures the DOM and paints; these decide.

## Setup

```
npm install
npm run typecheck                                    # tsc -b across all packages
npm run ingest --workspace @command-table/server      # fetch Scryfall Oracle Cards into SQLite
```

Ingestion writes to `packages/server/data/cards.sqlite3` (gitignored — it's a rebuildable cache,
not user state; re-run weekly or whenever Oracle Cards updates). Requires network access to
`api.scryfall.com`.

For the end-to-end tests only, one more step — `npx playwright install chromium`.

> On NixOS that download will not run, because it is dynamically linked against libraries the
> system does not provide. Use the browsers from nixpkgs instead:
>
> ```
> export PLAYWRIGHT_BROWSERS_PATH=$(nix-build '<nixpkgs>' -A playwright-driver.browsers --no-out-link)
> ```
>
> That is also why `@playwright/test` is pinned to an exact version rather than a caret range: it
> has to be the version whose browser revisions nixpkgs' `playwright-driver` ships, or it refuses
> to launch. Bump the two together.

## Running the server

```
npm run dev --workspace @command-table/server
```

Listens on `:8080` (override with `PORT`). On startup it prints the table passphrase — set
`HOST_SECRET` to choose your own, or let it generate one. Both entry points require it: room
creation as an `X-Host-Secret` header, joining as the `secret` field on the `join` message.
- `POST /api/rooms` — creates a room, returns `{ roomId }`.
- `ws://localhost:8080/ws` — join with `{ t: 'join', roomId, displayName, secret }`, submit a deck with
  `{ t: 'deck', list }`, and once the host sends `{ t: 'start' }` (2+ seated players required),
  act on the table with `{ t: 'action', clientSeq, action }` or roll back with
  `{ t: 'undo' }` (no revision — see the deviations below). The host ends a game with `{ t: 'endGame' }`, which clears the
  table and returns everyone to that room's lobby with seats and decklists intact, and clears an
  abandoned lobby seat with `{ t: 'freeSeat', seat }`. See
  `packages/common/src/protocol.ts` and `packages/common/src/actions.ts` for the full `Action`
  union and message set.

### Saved games

In-flight games are snapshotted to `data/sessions.json` (`SESSION_PATH` to move it), so a restart
or a crash resumes them rather than ending them — see §14.5. The file holds each room's seats,
resolved decklists, and **rejoin tokens**, plus the generated passphrase: the passphrase has to
persist or a restart would mint a new one and lock out everyone holding the old one. Treat the
file with the same care as the passphrase itself. It lives in gitignored `data/` on the host's
own machine.

Entries older than 24h are dropped on load, and a corrupt or unreadable file costs you the saved
games but never the ability to start the server. Undo history is not persisted (see "Notable
deviations" below).

## Running the client

```
npm run dev --workspace @command-table/client
```

Serves on `:5173` (`CLIENT_PORT` to change it), bound to all interfaces, and fails rather than
falling back to another port — `npm run host` prints the URL before Vite starts, so a silent
fallback would advertise a dead link. It talks to the server on port 8080 of **whatever hostname
the page was loaded from** (`packages/client/src/api.ts`), so `localhost`, a LAN address, and a
tailnet name all work with no rebuild. Override the port with `VITE_SERVER_PORT` if you moved
the server off 8080. Requires the server to be running with an ingested card index (see above).

## Playing with a friend

```
npm run host
```

Starts the server and the client together and prints the link and passphrase to send. Two people
on different machines connect over Tailscale — no VPS, no port forwarding, whoever is hosting
runs the server; guests just open the link. See
[playing-with-a-friend.md](playing-with-a-friend.md).

## Development

```
npm run dev
```

The local-only counterpart to `npm run host`: same two processes, but with the passphrase
switched off and a dev-table route open. Dev tables are saved to `data/dev-sessions.json`, so
they never mix with real games.

`/devtest/:playerAmount/:playerName` boots a dealt table — N seats filled with the precon
decklists in `packages/server/src/devtest/decks/`, libraries shuffled, opening hands dealt — and
stops at the opening-hand step. Keep (or mulligan), then start the game; Alice is the host, and
the host's button is live whether or not anyone else has kept. Open `/devtest/4/Alice` in one tab
and `/devtest/4/Bob` in another and both sit at the same table; the seat count picks the table, so
`/devtest/2/Alice` is a different one. Names are Alice, Bob, Carol, Dave in seat order.

It stops there rather than keeping and beginning on the players' behalf because that step is a
screen like any other, and pressing through it here would put it out of reach of both a look and
an end-to-end test. What is left is built out of the same pieces a real start uses
(`parseDecklist` → `resolveDecklist` → `createTableState`) and invents nothing, so the fixture
cannot drift from what the host's Start button produces — see
`packages/server/src/devtest/devTable.ts`.

Both the missing passphrase and the route are gated on `DEV_MODE=1`, which only `npm run dev`
sets; the client half is behind `import.meta.env.DEV` as well, so it is not in a built client.
A machine running `npm run host` answers 404 there and still demands the passphrase.

## Testing

```
npm test
```

Vitest across all packages. `deckResolver.integration.test.ts` runs against the real ingested
SQLite index and is skipped automatically if `npm run ingest` hasn't been run yet.

```
npm run test:e2e
```

Playwright, in `e2e/`. These drive a real browser against `/devtest/:playerAmount/:playerName` to
cover what the pure-logic modules structurally cannot: measured layout and the CSS acting on it
(the hand fan clearing the action bar, the context menu staying reachable), which of two menus a
right-click opens, and anything two clients have to agree about (the change pulse landing on the
same card on both screens, one player's life landing on their own board on everyone's). Because
the route is behind `import.meta.env.DEV`, they run against the Vite dev server and never a build.

The suite starts a server and a Vite of its own on 8091/5174, so it neither collides with a
`npm run dev` you already have open nor disturbs its table. It needs the ingested card index and
skips itself without one. Isolation is by seat count — the server keeps one dev table per player
amount, so each spec picks a number that suits what it does to the table; see the comment at the
top of `e2e/seat.ts` before adding a spec.

### Writing them

A UI change wants a spec here for the same reason a rules change wants one in Vitest, so write
them together rather than leaving the browser half to be checked by hand. The suite exists to
make that cheap — all of it runs in about five seconds, which is the budget worth protecting.

Write one when the claim is only true in a browser:

- **Measured layout, and the CSS acting on it.** `handFan.ts` returning the right number proves
  nothing about where the cards actually land.
- **Something two clients have to agree on.** One browser cannot show you that Bob saw it too.
- **A mode that changes what an interaction means** — an armed arrow, an open menu, a drag.
- **A regression you just fixed in any of the above**, so that it stays fixed.

Don't write one when a pure module can answer it. That is what the `foo.ts` + `foo.test.ts` pairs
are for, they run in milliseconds, and a browser test of arithmetic is the slow way to learn
nothing. Not every button needs a spec; the behaviours above do.

Two things to get right, both of which have already bitten:

- **Check that the spec can fail.** Break the thing on purpose — make `fanOverlap` return `0`, or
  `place()` return `at` — and watch it go red before trusting it green.
- **Never assert "nothing changed" on its own.** Actions round-trip the WebSocket and nothing is
  optimistic, so "the hand is the same" is true for a moment whether or not the bug is there, and
  a check like that passes forever. Wait for the change the interaction *is* meant to make, then
  assert what it must not have done. `targeting.spec.ts` is the worked example.

Specs are `e2e/*.spec.ts` — `.spec.ts`, not `.test.ts`, which is what keeps Vitest out of them.
Adding one means picking a seat count, so read the comment at the top of `e2e/seat.ts` first: the
three tables are fully spoken for.

Note that `npm run typecheck` covers `common` and `server` only — the root `tsconfig.json`
references those two. The client is typechecked by its own build, so check it with
`npx tsc -b packages/client` (or `npm run build`), and the e2e specs with `npx tsc -p e2e`, before
assuming a change compiles.

## Notable deviations from the design doc

- **Printing fidelity:** ingests Scryfall's *Oracle Cards* bulk file (one row per card, not per
  printing) rather than *Default Cards* — see design doc §21 Open Question 1. Set/collector-number
  hints in decklists (`1 Sol Ring (LTC) 284`) are accepted but only honored if that exact printing
  happens to be in the index; otherwise resolution falls back to the card by name. Switching to
  Default Cards later is additive, not a rewrite (the schema already carries `set`/`collectorNumber`).
- **Bulk data format:** Scryfall now serves bulk data as gzip'd JSONL (`jsonl_download_uri`)
  rather than one giant JSON array, which the design doc (written earlier) assumed. This is
  simpler than anticipated — no streaming-JSON-array library needed, just gunzip + readline.
- **Face-name aliasing:** the Oracle Cards file stores double-faced/split/adventure cards under
  their combined name (`"Delver of Secrets // Insectile Aberration"`), but decklist exports
  reference the front face alone (`"Delver of Secrets"`). The card index maintains a
  `card_face_aliases` table so front-face lookups resolve correctly — not called out explicitly
  in the design doc's §5/§6, but required for real decks with any transform/MDFC cards, which are
  common in Commander.
- **Blocking and targeting encoded into marker strings:** §7.3 is explicit that there is no combat
  state in the model — "attackers and blockers are `markers` on objects" — but a blocker has to
  say *which* attacker it is blocking for the arrows to be drawable at all.
  Rather than add relation fields to `GameObject` and the actions to set them, the relationship
  goes into the marker itself: `block:<attackerId>` and `target:<objectId>`, with the
  format owned by `packages/common/src/markers.ts` and parsed nowhere else. Markers are freeform
  by design, so this needs no new action, no protocol change, and no projection or undo work.
- **Summoning sickness is marked by the server, filtered by the client:** `MOVE_OBJECT` and the
  token/copy actions put a `summoning-sick` marker on anything arriving on a battlefield, and
  `PASS_TURN` clears it from the incoming player's permanents alongside their untap. The applier
  has no card data (it never names a card — see `actionDescriptions.ts`), so it cannot tell a
  creature from a land and marks both; the client draws the indicator only on creatures.
- **`PASS_TURN` also taps combatants:** anything carrying an attacking or block marker is tapped
  as the turn ends, before the markers are swept. Already-untapped permanents are left alone, so
  a player who untapped a vigilant attacker keeps that correction (§1.1 — nothing enforces rules).
- **An opening-hand step the doc doesn't have:** §14.1 deals seven cards and drops straight into
  turn 1, leaving no moment to mulligan in. `TableState.setupComplete` and `PlayerState.keptHand`
  mark out that moment, with `KEEP_HAND` and `BEGIN_PLAY` as ordinary actions so they flow through
  the existing log and undo. It gates nothing: the host can begin play whatever anyone has kept.
  The mulligan itself is still the doc's redraw-seven, not the London mulligan.
- **Ending a game un-submits every deck:** `Room.endGame` clears the resolved decklist along with
  the ready flags, so the next game's lobby is the same blank slate as the first. The decklist
  *text* is kept in the browser's localStorage and refilled into the box, so this costs a click,
  not a re-paste.
- **`PASS_TURN` pulled into Phase 2:** the doc's §17 phase list doesn't assign this action to any
  phase, but `TableState` structurally requires a `TurnTracker` (§7.3) and leaving it a field with
  no way to advance seemed worse than implementing the (one-line) mutation alongside it.
- **Pre-game decklist privacy:** the doc doesn't say whether opponents should see your decklist
  before the game starts. Treated it like in-game hidden information by default: the lobby only
  broadcasts a `deckStatus` badge (`none`/`ok`/`warnings`) to everyone, and the actual resolved
  cards/warnings go back only to the submitting player via a private `deckResult` message.
- **`limbo` zone default visibility:** §9.2 specifies defaults for every zone except `limbo`
  ("outside the game", used for e.g. concession per §14.3). `MOVE_OBJECT` defaults it to
  `{ kind: 'none' }` as the safer choice until a real use of that zone says otherwise.
- **`ROLL_DICE`/`FLIP_COIN`/`CONCEDE`/`SAY` deferred to Phase 4, not Phase 3:** §8 lists these
  as ordinary actions, but the doc explicitly routes their output through the log ("results go
  into the public log", §13; disconnect/elimination handling leans on the log as "the referee",
  §14.3/§15) — a log that doesn't exist until Phase 4. Implementing them now would mean a dice
  roll or a concede that produces a result with nowhere for the table to see it, which is a
  half-finished feature rather than a smaller complete one.
- **SCRY/SURVEIL/PEEK_TOP collapsed into one `PEEK_TOP` action:** all three reveal the top N
  library cards to the owner (§8.2); what differs is purely what the player does next with
  `MOVE_OBJECT` (reorder in place for scry, distribute to library/graveyard for surveil). Three
  near-identical actions would duplicate what's already one primitive.
- **`SET_LIFE` takes `playerIds: PlayerId[]`, not a single id:** §8.3 requires bulk support
  ("must support bulk (Blasphemous Act hitting four players)"). A single-player change is just
  an array of length 1, so this avoids a second, near-duplicate single-target action.
- **`SHUFFLE_LIBRARY` now also resets visibility to hidden:** needed once `SEARCH_LIBRARY` and
  `PEEK_TOP` exist — otherwise cards revealed by a search/peek would stay revealed forever after
  the very shuffle that's supposed to scramble them back into secrecy. Not explicitly stated in
  §9/§13, but a direct consequence of combining them.
- **Log text never names a specific card:** `GameObject` only carries a `scryfallId` — display
  names live in the DB-backed `CardIndex`, deliberately kept out of the pure, DB-free action-
  application layer (`actionApplier.ts` and friends), which is what makes that layer trivially
  unit-testable per §18. So log entries read "moved a card" / "drew 2 cards" rather than naming
  Sol Ring — a real loss of the doc's own example fidelity ("Alice untapped 6 permanents"), but
  one that avoids wiring a database dependency through the reducer for the sake of prettier
  strings. If this ever matters enough, the fix is client-side (join the log's `scryfallId`-
  bearing object references against the already-fetched card data), not a change to this layer.
- **`undo` carries no `targetRevision`:** §11.1 gives the client message one. A revert holds
  older content under a newer revision number, so where "one step back" lands is only knowable
  from the server's history — a client naming a revision would be guessing, and guessing wrong
  turned a second undo press into a silent redo. The server computes the target itself; the
  other three undo messages keep their `targetRevision`, since by then it has been decided.
- **`undoVote`/`undoResolved` fill a protocol gap:** §11.1/§15.2 specify `undoRequest` (the
  broadcast asking for consent) but never say how players respond or how "majority of connected
  players" gets tallied. Implemented as: the requester's own vote counts as an implicit yes,
  each connected player sends one `undoVote`, and it resolves the moment a strict majority of
  currently-connected seats votes either way (ties, e.g. 2-2 in a 4-player game, never resolve
  from votes alone under this rule — a disconnect changes the denominator, which is the doc's
  own get-out clause: "majority of *connected* players").
- **Undo's information-leak check is a heuristic, not exhaustive:** it flags a player who could
  see a specific object in the state being discarded but can't see that same object (by id)
  after the revert. It won't catch every conceivable leak (e.g. a player inferring information
  from a count changing) — the doc only asks that the honest fact be surfaced, not that leakage
  be perfectly modeled, and this catches the common, concrete case (a peek/reveal being undone).
- **`joined` now carries the joining player's own `playerId`:** the doc's §11.1 message shape
  didn't include it, which would have forced the client to guess which seat was "me" by matching
  on display name — fragile the moment two players share a name. Added it while building the
  client, the first consumer that actually needed it.
- **New `GET /api/cards/:scryfallId` endpoint, and permissive CORS on the HTTP API:** the wire
  protocol only ever sends a `scryfallId` (§7.1 — `GameObject.source` never carries a display
  name), so a client needs *some* way to resolve what a card actually looks like. CORS is
  wide open (`Access-Control-Allow-Origin: *`) because the client is served from a different
  origin than the API, on a hostname that changes with whoever is hosting — there is no origin
  allowlist that could be written down ahead of time. Access is gated by the table passphrase
  instead (see [playing-with-a-friend.md](playing-with-a-friend.md)), which is the one piece of
  authentication the design
  doc's §2 "known friend group" assumption doesn't cover: that assumption holds on a trusted
  network, and the passphrase is what makes it hold when the server is a laptop.
- **Click-to-move instead of drag-and-drop, deliberately:** §16.2 calls drag-and-drop "worth
  building" for zone movement, but the click-based interaction already built (single-click to
  play a hand card or tap a permanent, plus the context menu for everything else) was judged
  sufficient — a product call, not a stopgap pending a future drag-and-drop pass. Context menu
  and multi-select, both also named in §16.2, have landed.
- **Mobile/tablet support (§21 Open Question 4) is explicitly out of scope for now,** not merely
  unstarted — no one in the group plays on a tablet currently, so the hover-dependent zoom
  interaction stays as-is rather than adding a tap-triggered fallback nobody needs yet.
- **CONCEDE's control-reversion is auto-revert-to-owner + a log flag, not the §14.3-specified
  prompt, and this is staying that way:** "control reverts... but which player it reverts to is
  context-dependent, so prompt rather than guess" is the doc's wording, but the auto-revert is
  logged plainly ("please review") and any player can immediately fix a wrong guess via the
  existing "Change controller…" context-menu action — judged sufficient without a dedicated
  prompt protocol.
- **A lobby seat can be reclaimed by display name, which the doc doesn't describe:** §14.1/§14.2
  make the rejoin token the only key to a seat, but that token lives in one browser. Someone who
  loses it takes a new seat and leaves the old one behind as a ghost that keeps their name, ready
  flag and decklist — and `buildSeatSetups` would deal it into the game as a phantom player. So
  joining a **not-yet-started** room with a name matching a disconnected seat reclaims that seat.
  Name matching is weak identification; it is accepted here because the room is already behind a
  passphrase among people on a shared voice call, and the alternative is a broken game. It is
  deliberately off once the game starts, where a held seat is sacred (§14.2) and this would be a
  way to take one over — there, the host's `freeSeat` is the only escape hatch.
- **Server-restart persistence (§14.5) is implemented, but undo history is not persisted:**
  `data/sessions.json` holds each room — seats, resolved decklists, rejoin tokens — alongside its
  current `TableState`, so a restart or a crash resumes the game instead of ending it. Rejoin
  tokens had to be serialized too; without them a restored server would show that a room existed
  without letting anyone actually rejoin it. `TableHistory`'s 50 snapshots are deliberately left
  out, since persisting them would bloat the file ~50x: after a restore you can undo back to the
  restart point but not past it.
- **Casting a commander goes straight through the stack to the battlefield in one click:**
  clicking a command-zone commander sends `MOVE_OBJECT` to `{ zone: 'stack' }` (so §12.2's tax
  tracking fires, since that's keyed on the command-zone → stack transition specifically) and
  then immediately to the caster's battlefield. There's no stack UI to hold it there — the doc
  lists "no stack resolution" as an explicit non-goal (§1.3), so a visible, interactive stack
  would be scope the doc itself doesn't ask for. The two `MOVE_OBJECT` calls are genuinely two
  separate actions server-side (two log entries, two history entries), which is a minor honesty
  trade-off: self-undo after casting only reverts the second step.
- **Commander name lookup falls back to "{owner}'s commander" when the card hasn't loaded (or
  fetch failed) yet:** commander damage is keyed by object id, not by a pre-fetched name, since
  `useCard` resolves asynchronously per §4's "thin client" approach — no client-side cache
  warm-up step exists yet. `commanders.tsx` owns that fallback so the damage badges, the HUD's
  damage list and the status bar's command-zone prompt all name a commander the same way.
- **No path asks a question through `window.prompt`/`window.confirm` any more.** Every one of them
  is an in-app dialog on the shared shell (`Dialog.tsx` — Escape, click-outside, and standing the
  table's keyboard shortcuts down while it is up), with four shapes above it: `ConfirmDialog`
  (pass turn, concede), `NumberDialog` (peek depth, dice sides, ±N life for yourself or the whole
  table), `TextDialog` (marker, annotation) and one purpose-built form, `TokenDialog`. Adding a
  counter or a label is one pick from a list. A counter asks for a name and nothing else: the
  first one goes straight on and the menu then carries a −/+ stepper for it, like `+1/+1` has, so
  a count that changes every turn is one click rather than a trip through a dialog. That stepper
  is also how a pile of identical tokens is kept — four zombies are one tile with a `zombies 4`
  counter, not four tiles. "Change controller" is a list of
  players rather than a typed name, which used to fail silently when it matched nobody. The
  context menu renders its dialog *instead of* itself — its backdrop would otherwise sit between
  the dialog and the table and one click would dismiss both.
- **Right-clicking any object works regardless of who controls it:** the context menu's zone
  moves target the object's `controllerId` (visible even on a redacted object) rather than
  requiring you to control it first — consistent with §10's "anyone can take any action at any
  time," which the doc frames as correct specifically because there's no priority system to
  violate.
- **Battlefield zones resolve card data in the parent, not per tile:** which zone a permanent
  belongs to depends on `typeLine`, which loads asynchronously, and `useCard` is a per-object
  hook that can't be called across a list whose length changes between renders. `useCards`
  (`useCard.ts`) resolves a whole zone in one hook through the cache `api.ts` already keeps, so
  `Board` can group with a pure function (`battlefieldZones.ts`) before rendering. This replaced
  an earlier flex-`order` trick, which could not give the zones labels or reserved height.
  Cost: a permanent sits in the middle zone for one frame while its card data loads, then moves
  itself — an acceptable, self-healing cost for the "ugly by design" client.
- **"Bottom of library" is `toPosition: libraryCount`, which can tie:** `SHUFFLE_LIBRARY`
  renumbers positions densely `0..n-1`, so the card count is always past the last card and a
  bottomed card really does land underneath everything. Two cards bottomed in a row, though,
  both get that same position, leaving their relative order arbitrary until the next shuffle.
  Renumbering server-side on every insert would fix it and isn't worth the write amplification
  for a freeform client whose libraries get shuffled constantly.
- **Mulligan is a plain redraw of seven, not the London mulligan:** `MULLIGAN` returns the hand,
  reshuffles and draws 7 without bottoming N cards, so a mulligan currently costs nothing. The
  count is tracked (`counters.mulligan`) and shown on the player's rail, so players can enforce
  the bottoming by hand; §10's freeform stance means the client wouldn't block them either way.
- **`CLEAR_ALL_MARKERS` is `CLEAR_MARKERS_AND_COUNTERS`, and spares summoning sickness:** §8.1
  names the action for markers alone, but the markers/counters split is the model's and not the
  player's — a card wearing three +1/+1 counters looks no different from one wearing a 'flying'
  pill, and a sweep that took only half of them read as doing nothing. It now takes both. The one
  thing it leaves alone is `summoning-sick`, which the server sets on arrival and clears when that
  permanent's controller next untaps: it is bookkeeping rather than something a player stuck on
  the card, and clearing it here would wake a creature that had just been played.
- **Passing turn untaps and clears attackers, but deliberately does not draw:** the untap bundle
  is §16.3's, and sweeping the `attacking` markers keeps red rings from outliving their combat.
  A turn-start draw was built and then removed — it is the one turn-start step players want to
  perform themselves (`D`, or the Draw button), and a card that draws itself is harder to trust
  than one you asked for. `PASS_TURN` would have been the right place for it: it's the only thing
  that starts a turn, so the opening player's skipped draw needed no special case.
- **Commander damage also subtracts life, from one click:** §12.3 tracks the damage grid and
  §8.3 the life total as separate actions, and doing both by hand is how the two readouts drift
  apart. The HUD's ⚔ ±1 buttons fire both. They stay two actions in the log, so an undo reverts
  one half — worth it against forgetting the second click every combat.
- **Nothing in the client writes another player's life:** every board's readout is read-only and
  the vitals pad only ever targets `playerId`, so the damage you dealt is recorded
  by the player who took it. `SET_LIFE` still takes a list of players, but nothing in the client
  aims it at anyone but yourself any more — "Adjust all life…" was the last caller that did, and
  it is gone. The gap this leaves is a disconnected player whose total has drifted: nobody can
  correct it for them.
- **A library search shuffles itself when you close the popover:** the popover used to carry a
  note asking you to remember. A peek never shuffles, since a scry depends on exactly the order
  it just showed you (`libraryDirtiedBy` in `libraryMoves.ts`).
- **"Duplicate" creates a token rather than a `copy` object:** `CREATE_COPY` requires a
  `scryfallId`, so it cannot reproduce the ad-hoc tokens that "Create token…" makes, and its
  output is a `copy`, which the server then refuses to copy again. `duplicate.ts` issues
  `CREATE_TOKEN` with the original's own face instead, so a duplicate is as duplicable as what it
  came from.
- **The commander replacement offer covers graveyard and exile only,** not the hand and library
  CR 903.9 also allows. A commander in hand is usually there on purpose (you bounced it to
  recast), and a tucked one can't be offered at all: cards in a library are omitted from the
  projection entirely (§9.2), so the client never learns it's there. The standing offer lives in
  the status bar rather than the toast rail it was planned for — a toast expires in five seconds
  and would take the choice with it.
