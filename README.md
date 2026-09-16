# Command Table

Commander-only MTG web client. Freeform digital tabletop (no rules enforcement) — see
`commander-arena-design-doc-v0.2.md` for the full design.

## Status

Phase 1 (§17 of the design doc) is implemented: room/lobby, WebSocket plumbing, seat claiming,
Scryfall card ingestion, and decklist parsing/resolution. Four people can join a room over a
real WebSocket connection, submit decklists, and see each other's resolved decks and warnings.

Not yet implemented: the game table itself (`GameObject`, zones, the `MOVE_OBJECT` primitive,
the hidden-information projection boundary), the action catalog, the log/undo system, and any
client UI. See the design doc's Phase 2+ for what's next.

## Structure

```
packages/
  common/   Shared TypeScript types (cards, decklists, lobby state, wire protocol)
  server/   Node WebSocket server: room manager, card index, decklist parser/resolver, ingestion
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
- `ws://localhost:8080/ws` — join with `{ t: 'join', roomId, displayName }`; see
  `packages/common/src/protocol.ts` for the full message set.

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
