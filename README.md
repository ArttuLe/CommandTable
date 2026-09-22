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
`+N` badge on the commander tile), commander damage tracked per source (§12.3, edited by the
player taking it, highlighted past 21 lethal), and life/poison lethal-threshold
highlighting (≤0 life, ≥10 poison) — plus a **minimal client** (early Phase 6 — React +
TypeScript + Vite + Zustand, per §4) that now covers most of the action catalog, not just the
headline ones. Beyond click-to-play/click-to-tap: a right-click context menu on any object
(§16.2 — tap/untap, mark as attacking, transform, face down/up, move to any zone, add a counter
or marker, remove an existing marker, set an annotation, change controller, duplicate a token;
the menu flips up or left when it would otherwise run off the window — see `menuPlacement.ts`),
search library + peek top N (both open the hand dock's Library popover on the spot, since
flipping card visibility server-side is otherwise invisible; each revealed card carries
Hand / Play / Top / Bottom buttons, which is what makes a peek usable as a scry, and a search
shuffles itself on the way out — see `libraryMoves.ts`), roll dice / flip a coin, create tokens
(name / type line / P / T / quantity as one form, with the type line following the name until
you edit it — `TokenDialog.tsx`, rules in `tokenForm.ts`), and a chat box for `SAY`. Hover-zoom made the
cut despite being "later polish" in spirit, since the doc calls it "non-negotiable" (§16.1)
rather than optional, and sits against the left edge, a little above centre, where it is at eye
level and never under the cursor that summoned it — the cards you hover most are along the bottom
of the window, so a dead-centre preview reads as lower than its own card. The battlefield splits into three named zones (§16.1) —
lands, non-creature permanents, creatures — see `battlefieldZones.ts`; identical basics fan into
one overlapping stack with a count (`landStacks.ts`) so a ten-land board doesn't wrap onto a
second row. Keyboard shortcuts
(§16.2) cover the high-frequency actions — `D` draw, `U` untap all, `P` pass turn, `+`/`-` your
own life, `L` the log rail — gated so they don't fire while a text input has focus. Passing on
someone else's turn (button or `P`) puts a confirmation dialog in front of it, since `PASS_TURN`
ends whoever is active, not you. That dialog is the app's own (`ConfirmDialog.tsx`), not
`window.confirm`; while it is up the keyboard shortcuts stand down so Escape and Enter belong
to it. A
client-local mana pad (§8.4) shares a strip above the hand with the graveyard / exile / library
tiles: WUBRGC counters a player bumps by hand as they tap lands and
spend mana, reset at will, never synced to the server or other players. Multi-select (§16.2)
covers the doc's two stated use cases — "tap five lands" and "sacrifice all my tokens" — via
shift-click on any battlefield object, a selection bar with Tap/Untap/To graveyard/Clear, and
Escape to clear; drag-box selection wasn't built since shift-click already satisfies the
tedium checklist. Drag-and-drop and mobile support are deliberately not planned — see the
deviation notes below, not the Phase 6/7 gap list.

The §16.3 tedium checklist is now fully covered: passing turn untaps the incoming player's
permanents and clears last turn's attackers as one undoable action (drawing for the turn stays
manual on purpose — see the deviation notes). Life can be adjusted by an arbitrary amount or
across all players at once (not just ±1 per player), commander damage takes the matching life
with it, "clear all markers" is a one-click sidebar action, the two most common counter types
(+1/+1, -1/-1) are one click from the context menu rather than two sequential prompts, and a
token is duplicated from that same menu instead of being re-typed into the form.

A commander that lands in your graveyard or exile puts a standing offer in the status bar —
"To command zone" or "Leave it" (`commanderPrompt.ts`, §12). It reads the table rather than
watching for the death, so it survives a refresh and a player who was looking elsewhere, and
"Leave it" is remembered per zone: the same commander later being exiled out of the graveyard
asks again, because that is a new decision.

Attacking creatures are marked rather than tracked: the context menu's Attacking toggle on any
creature sets the ordinary `attacking` marker (`combat.ts`), which draws a red ring around the
tile for everyone at the table. It is a reminder, not combat state — nothing resolves damage —
and it clears itself when the turn passes, so red rings never outlive the combat they described.

A card that changes zones comes out clean (`asNewObject` in `actions/helpers.ts`, CR 400.7): tap
state, counters, markers, annotation and attachments are dropped and control returns to the
owner, and anything attached to it comes loose. Reordering within one zone — the library moves —
is not a zone change and keeps everything. This is the one rules-shaped thing the server does,
and it earns its place: the alternative was every player hand-clearing a dead creature's +1/+1
counters before it could be reused.

The table is a pan-and-zoom plane holding every player's mat, laid out the way the group would
sit around a physical table (`Plane.tsx`, `seating.ts`, `Board.tsx`, `CrossroadsHub.tsx`). You
are always bottom-left and the other players run clockwise from you in turn order
(`PlayerState.seat`), so the player who acts after you is the one on your left; two-player games
stack vertically instead, since there's no clockwise worth modelling with one opponent. Each mat
faces its owner — the header (with the command zone tucked into it at half scale, since an
uncast commander is one card that was costing a full row of height) and the lands hug the
board's *outer* edge, non-creature permanents sit behind the line, and creatures push inward
toward the middle where combat happens. All three zones are always drawn, each with a faint label, so a permanent never
changes band as the board fills. The mirroring is a CSS flip (`column-reverse` on both the
board and its battlefield) over one `Board` component and one child order, not two layouts to
keep in sync.

Life, poison and commander damage live at the crossroads where the mats meet, each player's
readout in the corner nearest their own board. Those readouts only *report*: a name, a life
total, and a badge row that carries a ☠ poison count and a ⚔ badge per commander that has
actually connected — nothing while there is nothing to say, so an untouched board shows a bare
number. Which commander a ⚔ badge belongs to is in its hover title, not on its face; the badge
has to stay readable at the zoom where a whole four-player table fits on screen.

Everything on it is written from the vitals pad in your own bottom HUD (`ActionBar.tsx`, beside
the mana pad): −1/+1 life, a ±N dialog, poison −/+, and a ⚔ button — wearing your worst single
commander total — that opens a list of the other players' commanders with −/+ each. Nobody edits
a neighbour's numbers; you record what you took, the way you would across a physical table. That
also keeps the readout a number you read at a glance rather than a cluster of small buttons
repeated once per seat. The N×N damage matrix that used to sit at the crossroads is gone: with
badges on every box and an editor in your own HUD it was a third copy of the same numbers.

Pan by dragging the background, zoom with the wheel (exponential on the wheel delta, so
trackpads stay smooth and notched mice don't jump a step per click), or use the −/Fit/+
controls. The view refits only when the number of boards changes, never mid-turn — unless the
settings gear's "follow the active player" is on, in which case each turn the plane glides to
the new active player's mat and zooms in on it (`focusView` in `planeView.ts` frames the rect;
the easing is a CSS transition added for the glide and removed after, so dragging stays
frame-tight). It's off by default and panning by hand still works in between. Panning is
deliberately unbounded — "Fit" is one click away, which beats edge-clamping math that fights the
user near the borders. This is **not** WebGL or canvas, on purpose: a 4-player Commander table
peaks at a couple of hundred card elements, and the entire pan/zoom is one CSS transform on one
element (a composited layer move, not a relayout of every card). WebGL would mean reimplementing
the context menu, hover zoom, badges and text layout as textured quads with hand-rolled
hit-testing, and managing card images as textures instead of browser-cached `<img>` tags — all
cost, no benefit at this scale. The pan/zoom math that *is* subtle (keeping the point under the
cursor pinned while the scale changes) lives in `planeView.ts` behind unit tests, as do the
seating rules in `seating.ts` — the client's first two tested modules.

The screen is three bands. A slim status bar on top reports whose turn it is and nothing else —
`TurnTracker` has shipped in every projection since Phase 2 but went unrendered until now, so the
only way to tell was to read the log. Below it the plane, with the log rail beside it. Along the
bottom, in fixed chrome at a constant size no matter how far the table is zoomed out: your mana
pad, the three actions you take every turn (Draw / Untap all / **Pass turn**, plus a "More ⋯"
popover holding the ten you take a few times a game), your hand, and Graveyard / Exile / Library
as buttons that open their contents as a card grid. Card size is one knob — `--card-w`/`--card-h`
in `:root`, currently 156×218px — which the zone heights, the hand's height, its fan overlap and
the floating bars' offsets all derive from, so legibility is tuned in one place rather than six.
A hand over eight cards overlaps into a fan rather than wrapping to a second row, which would
steal height from the table.

Home and the lobby share that same token set — one `.panel` idiom, the `.btn` family, and a
baseline for text inputs so they aren't browser-default white boxes on a dark table. The lobby is
a header (room code, and the host's Start) over two panels, seats beside your deck, collapsing to
one column on a narrow window; deck warnings reuse the coloured-left-border treatment the table's
toasts use, so a caution reads the same on every screen.

Whose turn it is, is a ring: amber around the active player's mat, blue when it's yours, mirrored
on their life readout at the crossroads so it reads even when their mat is panned off-screen. The
rule lives in `turnStatus.ts` behind unit tests. `TurnTracker.phase` is deliberately not shown —
nothing mutates it (there's no `SET_PHASE` action), so it would permanently read "main".

Log and chat are a collapsible right rail rather than a modal. The modal's problem wasn't where
it sat but that nothing reached you until you opened it: a chat message or a dice roll was
invisible until someone went looking. Collapsed, the rail is a strip with an unread count, and
new entries pop as transient toasts in the top-right corner, clear of the rail itself (they shift
left when it's open), newest on top. Each carries its own five-second deadline that one shared
timer waits on, and fades out rather than vanishing. `LogEntry.kind` (`'chat' | 'random'`, absent for ordinary
actions) is what lets the rail style those apart and the toasts pick what's worth interrupting for
— the alternative was sniffing log strings, since `SAY`'s log text is the player's message verbatim.

This plane replaced a vertical stack of full-width boards, in which opponents rendered at a
compact 50×70px card size (capped at 28vh) with a ⤢ button to open any one of them full-size in
a modal. Zooming into any board subsumes both, so that compact CSS override and
`ExpandedPlayerModal` were removed rather than kept alongside it.

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
            → Table (a pan/zoom plane of per-player boards, the read-only crossroads life
            readout, a collapsible log rail, and a fixed bottom band of hand + vitals + mana +
            zones + actions, wired
            straight to the WebSocket via a Zustand store)
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

Listens on `:8080` (override with `PORT`). On startup it prints the table passphrase — set
`HOST_SECRET` to choose your own, or let it generate one. Both entry points require it: room
creation as an `X-Host-Secret` header, joining as the `secret` field on the `join` message.
- `POST /api/rooms` — creates a room, returns `{ roomId }`.
- `ws://localhost:8080/ws` — join with `{ t: 'join', roomId, displayName, secret }`, submit a deck with
  `{ t: 'deck', list }`, and once the host sends `{ t: 'start' }` (2+ seated players required),
  act on the table with `{ t: 'action', clientSeq, action }` or roll back with
  `{ t: 'undo', targetRevision }`. See `packages/common/src/protocol.ts` and
  `packages/common/src/actions.ts` for the full `Action` union and message set.

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
  fetch failed) yet:** commander damage is keyed by object id, not by a pre-fetched name, since
  `useCard` resolves asynchronously per §4's "thin client" approach — no client-side cache
  warm-up step exists yet. `commanders.tsx` owns that fallback so the damage badges, the HUD's
  damage list and the status bar's command-zone prompt all name a commander the same way.
- **The context menu and a few "More ⋯" items still use `window.prompt()`** for free-text/numeric
  input (counter key+amount, marker name, annotation, change-controller target, ±N life across
  all players) rather than a dialog. The paths that are worth the dialog have one — pass turn,
  peek depth, dice sides, create token, ±N on your own life — built on a shared shell
  (`Dialog.tsx`, plus `ConfirmDialog`,
  `NumberDialog`, `TokenDialog`) that owns Escape, click-outside, and standing the table's
  keyboard shortcuts down while it is up. The rest keep the native prompt for now: it is a real,
  if minor, UX compromise, and it costs automated browser testing those paths (a JS prompt
  blocks further extension commands), so they're verified by code review and manual play.
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
  count is tracked (`counters.mulligan`) and shown in the board header, so players can enforce
  the bottoming by hand; §10's freeform stance means the client wouldn't block them either way.
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
- **Nothing in the client writes another player's life:** every readout at the crossroads is
  read-only and the vitals pad only ever targets `playerId`, so the damage you dealt is recorded
  by the player who took it. `SET_LIFE` still takes a list of players and "Adjust all life…" in
  `More ⋯` still uses it, which is the one remaining way a total moves for someone else — and it
  moves everyone's at once. The gap this leaves is a disconnected player whose total has drifted:
  nobody can correct it for them.
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
