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
  (commanders → command zone, deck → shuffled library, opening hand of 7 per §14.1 step 5) with
  randomized turn order.
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

Also implemented: **Phase 5's commander affordances** (§12) — commander tax tracking
(`commanderCastCount` increments when a commander moves command zone → stack, shown as a
`+N` badge on the commander tile), a per-player commander damage grid (§12.3, one row per
commander in play, editable, highlighted past 21 lethal), and life/poison lethal-threshold
highlighting (≤0 life, ≥10 poison) — plus a **minimal client** (early Phase 6 — React +
TypeScript + Vite + Zustand, per §4) that now covers most of the action catalog, not just the
headline ones. Beyond click-to-play/click-to-tap: a right-click context menu on any object
(§16.2 — tap/untap, transform, face down/up, move to any zone, add a counter or marker, remove
an existing marker, set an annotation, change controller), sidebar buttons for search library +
peek top N (with a "revealed library" panel that renders whatever `SEARCH_LIBRARY`/`PEEK_TOP`
made visible, right-clickable like anything else), roll dice / flip a coin, create tokens
(name/type/power/toughness/quantity via prompts), and a chat box for `SAY`. Hover-zoom made the
cut despite being "later polish" in spirit, since the doc calls it "non-negotiable" (§16.1)
rather than optional. The battlefield also splits into a lands row and a nonlands area (§16.1),
via CSS `order` rather than pre-sorted arrays — see the deviation note. Keyboard shortcuts
(§16.2) cover the high-frequency actions — `D` draw, `U` untap all, `P` pass turn, `+`/`-` your
own life — gated so they don't fire while a text input has focus. A client-local mana pad (§8.4)
sits above the sidebar controls: WUBRGC counters a player bumps by hand as they tap lands and
spend mana, reset at will, never synced to the server or other players. Multi-select (§16.2)
covers the doc's two stated use cases — "tap five lands" and "sacrifice all my tokens" — via
shift-click on any battlefield object, a selection bar with Tap/Untap/To graveyard/Clear, and
Escape to clear; drag-box selection wasn't built since shift-click already satisfies the
tedium checklist. Drag-and-drop and mobile support are deliberately not planned — see the
deviation notes below, not the Phase 6/7 gap list.

The §16.3 tedium checklist is now fully covered: passing turn bundles an untap of the new
active player's permanents (previously a separate click), life can be adjusted by an arbitrary
amount or across all players at once (not just ±1 per player), "clear all markers" is a
one-click sidebar action, and the two most common counter types (+1/+1, -1/-1) are one click
from the context menu rather than two sequential prompts.

The layout is a vertical stack, not a side-by-side split: a top toolbar (mana pad, selection
bar, action buttons, a "Log & chat" popup toggle — log/chat moved out of always-visible space
since they're read far less often than the board), then opponents' boards, then your own —
each getting the full window width. This replaced an earlier side-by-side attempt (opponents +
your own board sharing a column with a fixed-width sidebar) that turned out to have a genuine
CSS Grid bug, not just a size problem: `.sidebar` had a definite row but an automatic column,
and the grid placement algorithm resolves definite-row items *before* fully-automatic ones —
so the sidebar silently claimed the wide column and `.opponents` got squeezed into the narrow
one, the opposite of the intended layout. Card tiles are 30% larger than the original
(104×145px) on top of that fix. Opponents wrap onto multiple rows (capped at 46vh with their
own scroll) rather than forcing a horizontal scroll, so 1–3 opponents typically fit without
scrolling at all — verified live with a 4-player game.

This is the doc's "playable, ugly game" milestone (Phase 2) plus enough of Phase 3 that most
interactions no longer need a workaround, plus Phase 4's referee: misclicks are now survivable
and disputes have a paper trail. Verified against live multi-client sessions at both the
protocol level (raw WebSocket traffic) and now in a real browser with two tabs: room creation,
joining, decklist submission with real warnings (deck size, and a genuine color-identity
violation against real Scryfall data), starting a game, drawing, playing a card to the
battlefield, tapping it (with a real card image and CSS rotation), casting a commander through
the stack, adjusting life/poison and commander damage (including triggering and visually
confirming the 21-damage lethal highlight), hovering a card to see a full-size, fully-readable
zoom preview, opening the right-click context menu on another player's object, sending a chat
message and flipping a coin (both showed up live in the log), searching a library and seeing
all of it rendered with real card art in the revealed-library panel, and the log/commander-
damage grid updating live across both clients — plus, at the protocol level, a real self-leak
catch (a player who drew a card and could see it, then undid the draw, correctly got flagged as
still "knowing" what they saw).

Not yet implemented: Phase 6/7's remaining polish (MDFC/saga layout handling, a real stack
view, server-restart persistence per §14.5). Drag-and-drop and mobile support are deliberately
not planned — see "Notable deviations from the design doc" below. See `packages/client/src`
for what exists.

## Structure

```
packages/
  common/   Shared TypeScript types (cards, decklists, lobby/table state, wire protocol, actions, log)
  server/   Node WebSocket server: room manager, card index, decklist parser/resolver, ingestion,
            table factory, action applier (dispatch + actions/{object,zone,player,meta}Actions.ts),
            projection boundary, table history + undo
  client/   Minimal React client: Home (create/join room) → Lobby (seats, decklist, ready/start)
            → Table (battlefield/hand/log, wired straight to the WebSocket via a Zustand store)
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

## Running the client

```
npm run dev --workspace @command-table/client
```

Serves on `:5173` (Vite default). Hardcoded to talk to the server at `localhost:8080`
(`packages/client/src/api.ts`) — there's no deployment story yet (§14.5 isn't reached), so this
is dev-only. Requires the server to be running with an ingested card index (see above).

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
- **`joined` now carries the joining player's own `playerId`:** the doc's §11.1 message shape
  didn't include it, which would have forced the client to guess which seat was "me" by matching
  on display name — fragile the moment two players share a name. Added it while building the
  client, the first consumer that actually needed it.
- **New `GET /api/cards/:scryfallId` endpoint, and permissive CORS on the HTTP API:** the wire
  protocol only ever sends a `scryfallId` (§7.1 — `GameObject.source` never carries a display
  name), so a client needs *some* way to resolve what a card actually looks like. CORS is
  wide open (`Access-Control-Allow-Origin: *`) because this is a private, non-commercial,
  known-friend-group tool with no auth anywhere else in the stack (§2) — locking down origins
  would add friction without adding real protection.
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
- **Server-restart persistence (§14.5, also §21 Open Question 3) is skipped, on purpose:**
  `TableState` is plain JSON and trivial to snapshot, but reconnecting after a restart also
  needs each player's rejoin token, which lives only in-memory on the lobby `Room` object and is
  never serialized anywhere today — a TableState-only snapshot would let a restarted server show
  a room existed without letting anyone actually rejoin it. The doc itself ranks this as the
  highest-effort of three mitigations and calls it optional ("worth doing if games get long");
  the cheaper mitigations (don't deploy mid-game, a health endpoint showing player count) cover
  the realistic risk for now.
- **Casting a commander goes straight through the stack to the battlefield in one click:**
  clicking a command-zone commander sends `MOVE_OBJECT` to `{ zone: 'stack' }` (so §12.2's tax
  tracking fires, since that's keyed on the command-zone → stack transition specifically) and
  then immediately to the caster's battlefield. There's no stack UI to hold it there — the doc
  lists "no stack resolution" as an explicit non-goal (§1.3), so a visible, interactive stack
  would be scope the doc itself doesn't ask for. The two `MOVE_OBJECT` calls are genuinely two
  separate actions server-side (two log entries, two history entries), which is a minor honesty
  trade-off: self-undo after casting only reverts the second step.
- **Commander name lookup falls back to "{owner}'s commander" when the card hasn't loaded (or
  fetch failed) yet:** the commander-damage grid's rows are keyed by object id, not by a
  pre-fetched name, since `useCard` resolves asynchronously per §4's "thin client" approach — no
  client-side cache warm-up step exists yet.
- **The context menu and several sidebar buttons use `window.prompt()`** for free-text/numeric
  input (counter key+amount, marker name, annotation, change-controller target, dice sides,
  peek count, token fields) rather than a custom modal. This is a real, if minor, UX compromise
  — native prompts are blunt and block the page — but building N one-off modal components for an
  "ugly by design" MVP client wasn't worth it. The one place this matters beyond taste: automated
  browser testing can't drive these paths (a JS prompt blocks further extension commands), so
  they're verified by code review and manual play rather than the live-session testing the rest
  of the client got.
- **Right-clicking any object works regardless of who controls it:** the context menu's zone
  moves target the object's `controllerId` (visible even on a redacted object) rather than
  requiring you to control it first — consistent with §10's "anyone can take any action at any
  time," which the doc frames as correct specifically because there's no priority system to
  violate.
- **Lands/nonlands split uses a CSS ordering trick, not two arrays:** land-ness depends on card
  data (`typeLine`) that loads asynchronously per object via `useCard`, so pre-splitting into
  two arrays before render isn't straightforward without a global reactive cache. Instead every
  battlefield slot sets its own flex `order` (lands first) plus a full-width spacer forces the
  wrap between them. Cost: a permanent can render in the wrong group for one frame while its
  card data is still loading, then self-correct — an acceptable, self-healing cost for the
  "ugly by design" client.
