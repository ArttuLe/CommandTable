# Command Table

Commander-only MTG web client. Freeform digital tabletop (no rules enforcement) — see
`commander-arena-design-doc-v0.2.md` for the full design.

## Status

Phase 1, 2, and most of Phase 3 (§17 of the design doc) are implemented:

- **Phase 1 — lobby:** room/lobby, WebSocket plumbing, seat claiming with rejoin tokens,
  Scryfall card ingestion, decklist parsing/resolution.
- **Phase 2 — table core:** the `GameObject` model, zones, the `MOVE_OBJECT` primitive, the
  hidden-information projection boundary (§9), `SHUFFLE_LIBRARY`/`DRAW`, and per-player
  full-state broadcast. The host's `start` builds the table from each seat's resolved decklist
  (commanders → command zone, deck → shuffled library) with randomized turn order.
- **Phase 3 — action catalog:** the rest of §8 except `ROLL_DICE`/`FLIP_COIN`/`CONCEDE`/`SAY`
  (deferred to Phase 4 — see below). Tap/untap (incl. `UNTAP_ALL`), arbitrary object/player
  counters, attach/unattach, markers, transform/face-down/face-up, annotations, control
  changes, token/copy creation, deletion, mill, scry-style peeking, reveal/hide, library
  search, bulk zone moves, bulk life changes, commander damage tracking, and mulligans.

This is the doc's "playable, ugly game" milestone (Phase 2) plus enough of Phase 3 that most
interactions no longer need a workaround. Verified against live multi-client WebSocket
sessions, not just unit tests: hand/library contents stay genuinely hidden across players after
draws, token creation, and bulk life swings.

Not yet implemented: `ROLL_DICE`/`FLIP_COIN`/`CONCEDE`/`SAY` and the log/undo system (Phase 4 —
see the deviation note below on why these are bundled together), commander-specific affordances
like the damage grid UI and tax display (Phase 5, though the underlying data — commander
damage, cast count — already exists in `PlayerState`), and any client UI at all (Phases 6-7).
Right now this is a server with no frontend — interact with it via raw WebSocket messages (see
`packages/common/src/protocol.ts`).

## Structure

```
packages/
  common/   Shared TypeScript types (cards, decklists, lobby/table state, wire protocol, actions)
  server/   Node WebSocket server: room manager, card index, decklist parser/resolver, ingestion,
            table factory, action applier (dispatch + actions/{object,zone,player}Actions.ts),
            projection boundary
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
  act on the table with `{ t: 'action', clientSeq, action }`. See
  `packages/common/src/protocol.ts` and `packages/common/src/actions.ts` for the full `Action`
  union and message set.

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
