# Command Table

Commander-only MTG web client. Freeform digital tabletop (no rules enforcement) — see
`commander-arena-design-doc-v0.2.md` for the full design.

## Status

Phases 1 through 4 (§17 of the design doc) are implemented:

- **Phase 1 — lobby:** room/lobby, WebSocket plumbing, seat claiming with rejoin tokens,
  Scryfall card ingestion, decklist parsing/resolution.
- **Phase 2 — table core:** the `GameObject` model, zones, the `MOVE_OBJECT` primitive, the
  hidden-information projection boundary (§9), `SHUFFLE_LIBRARY`/`DRAW`, and per-player
  full-state broadcast. The host's `start` builds the table from each seat's resolved decklist
  (commanders → command zone, deck → shuffled library) with randomized turn order.
- **Phase 3 — action catalog:** the rest of §8 except `ROLL_DICE`/`FLIP_COIN`/`CONCEDE`/`SAY`
  (deferred to Phase 4 alongside the log they depend on). Tap/untap (incl. `UNTAP_ALL`),
  arbitrary object/player counters, attach/unattach, markers, transform/face-down/face-up,
  annotations, control changes, token/copy creation, deletion, mill, scry-style peeking,
  reveal/hide, library search, bulk zone moves, bulk life changes, commander damage tracking,
  and mulligans.
- **Phase 4 — log and undo:** every action appends a human-readable `LogEntry` (§15.1),
  filtered per-viewer by the same projection boundary as objects. A bounded 50-snapshot ring
  buffer (§15.2) backs undo: a player's own uncontested last action reverts instantly, anything
  further back or after someone else has acted requires majority consent from connected players
  (a `undoRequest`/`undoVote` round the doc specifies the shape of but not the voting mechanics
  — see the deviation note below). Undo also detects when a revert would re-hide something a
  player already saw, and says so in the log rather than pretending the leak didn't happen
  (§15.2). `ROLL_DICE`/`FLIP_COIN`/`CONCEDE`/`SAY` land here too, now that there's a log for
  their results to go into.

This is the doc's "playable, ugly game" milestone (Phase 2) plus enough of Phase 3 that most
interactions no longer need a workaround, plus Phase 4's referee: misclicks are now survivable
and disputes have a paper trail. Verified against live multi-client WebSocket sessions, not
just unit tests — including a real self-leak catch (a player who drew a card and could see it,
then undid the draw, correctly got flagged as still "knowing" what they saw).

Not yet implemented: commander-specific affordances like the damage grid UI and tax display
(Phase 5, though the underlying data — commander damage, cast count — already exists in
`PlayerState`), and any client UI at all (Phases 6-7). Right now this is a server with no
frontend — interact with it via raw WebSocket messages (see `packages/common/src/protocol.ts`).

## Structure

```
packages/
  common/   Shared TypeScript types (cards, decklists, lobby/table state, wire protocol, actions, log)
  server/   Node WebSocket server: room manager, card index, decklist parser/resolver, ingestion,
            table factory, action applier (dispatch + actions/{object,zone,player,meta}Actions.ts),
            projection boundary, table history + undo
```

## Setup

```
npm install
npm run typecheck                                    # tsc -b across all packages
npm run ingest --workspace @command-table/server      # fetch Scryfall Oracle Cards into SQLite
```

Ingestion writes to `packages/server/data/cards.sqlite3` (gitignored — it's a rebuildable cache,
not user state; re-run weekly or whenever Oracle Cards updates). Requires network access to
`api.scryfall.com`.

## Running the server

```
npm run dev --workspace @command-table/server
```

Listens on `:8080` (override with `PORT`). Two entry points:
- `POST /api/rooms` — creates a room, returns `{ roomId }`.
- `ws://localhost:8080/ws` — join with `{ t: 'join', roomId, displayName }`, submit a deck with
  `{ t: 'deck', list }`, and once the host sends `{ t: 'start' }` (2+ seated players required),
  act on the table with `{ t: 'action', clientSeq, action }` or roll back with
  `{ t: 'undo', targetRevision }`. See `packages/common/src/protocol.ts` and
  `packages/common/src/actions.ts` for the full `Action` union and message set.

## Testing

```
npm test
```

Vitest across all packages. `deckResolver.integration.test.ts` runs against the real ingested
SQLite index and is skipped automatically if `npm run ingest` hasn't been run yet.

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
