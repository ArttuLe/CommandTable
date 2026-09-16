# Design Document: Commander-Only MTG Web Client (Codename "Command Table")

**Version:** 0.2 (Draft)
**Supersedes:** v0.1
**Author:** Solo/duo hobby project — design drafted with Claude
**Scope:** Web application, Commander format only, friends-only play, freeform (non-enforcing) rules model, no user persistence

---

## 0. What Changed From v0.1

v0.1 specified a full Comprehensive-Rules engine. Review found that choice inconsistent with the project's own constraints: a rules engine requires executable logic per card, Commander is legal for 20,000+ cards, and a solo/duo team shipping a curated 150–300 card subset would produce a client where essentially every real decklist fails to import. The engine was also the single largest cost in the document by a wide margin.

**v0.2 adopts a freeform model instead** (the Cockatrice / Untap.in / "digital tabletop" approach). The server tracks objects, zones, and visibility. It does not enforce rules. Players resolve interactions themselves, exactly as they would at a physical table.

Consequences, in short:

| | v0.1 (rules engine) | v0.2 (freeform) |
|---|---|---|
| Card coverage | 150–300 at launch, grows slowly | All ~20,000+ on day one |
| Largest cost | Rules engine + per-card logic | Client UX and interaction design |
| Rules correctness | Engine's responsibility | Players' responsibility |
| Time to first playable game | Very long | Short |
| Cards that "don't work" | Many, indefinitely | None |

This document also fixes several rules errors and fills subsystem gaps found in v0.1 review (mana, tokens, player elimination, game log, randomness, undo, protocol, timers, mulligans).

---

## 1. Overview

Command Table is a web-based digital tabletop for playing Magic: The Gathering's Commander format with a trusted friend group. It provides the things a physical table can't — shuffled hidden libraries, automatic card lookup, remote play, a shared action log — and deliberately does *not* provide rules enforcement, because rules enforcement is what makes a client like this cost years instead of months.

The mental model to hold throughout: **this is a table with cards on it, not a referee.** If a player taps a land, the server records "that permanent is now tapped." It does not check whether they were allowed to, whether they had priority, or what the mana was spent on.

### 1.1 Design Philosophy

Three principles, in priority order:

1. **Never block a legal play.** Because the server doesn't know the rules, any restriction it imposes is a guess, and a wrong guess makes a card unplayable with no workaround. Every object must be movable to any zone, every counter type must be arbitrary, every value must be directly editable. When in doubt, permit it.
2. **Optimize for the number of clicks in a real game.** Freeform play lives or dies on tedium. Untapping eleven permanents one at a time, or manually adjusting life four times after a Blasphemous Act, is how these clients lose to paper. Bulk operations and sensible defaults are the core feature, not polish.
3. **Make state legible to everyone.** With no engine to arbitrate, the shared game log and clear board visualization *are* the dispute-resolution mechanism. They're load-bearing, not nice-to-have.

### 1.2 Goals

- 2–4 player free-for-all Commander in a browser, in real time.
- Every Commander-legal card usable immediately, via Scryfall card data.
- Zero-friction start: open link, name yourself, paste decklist, play.
- Correct hidden-information handling (hands, library order, face-down cards) — the one thing players genuinely cannot do for themselves over a video call.
- Fast, low-tedium manipulation of board state.

### 1.3 Non-Goals (v1)

- Rules enforcement of any kind: no priority, no stack resolution, no state-based actions, no layers, no targeting validation, no cost payment, no timing restrictions.
- Deck legality validation (singleton, color identity, banlist) — trusted.
- Formats other than Commander; variants other than free-for-all (no Two-Headed Giant, Planechase, Archenemy).
- Accounts, persistent collections, match history, ranking.
- Packs or any card economy (deferred — see §19).
- Anti-cheat. Hidden information is protected from *casual* observation by server-side scoping, not from a determined adversary.
- Native apps, spectator mode, replays, voice chat (assume players use Discord alongside).

---

## 2. Card Data and IP

Card names, Oracle text, mana costs, and art are Wizards of the Coast / Hasbro intellectual property. This design assumes:

- **Data source:** the [Scryfall API](https://scryfall.com/docs/api). Read their current API guidelines before building — in particular their rate limits, their required custom `User-Agent` and `Accept` headers, and their guidance to use bulk data rather than crawling.
- **Images:** prefer caching Scryfall's images locally for your group rather than hotlinking at scale. Do not redistribute WotC art in a public repo.
- **Scope:** private, non-commercial, known friend group. This is not a product and must not be sold, monetized, or publicly distributed. If that ever changes, licensing needs to be revisited before anything else.

---

## 3. Architecture

```
┌─────────────┐      WebSocket (JSON)       ┌────────────────────────────┐
│  Browser A  │◄───────────────────────────►│                             │
├─────────────┤                             │      Game Server (Node)     │
│  Browser B  │◄───────────────────────────►│  ┌───────────────────────┐  │
├─────────────┤                             │  │ Room Manager          │  │
│  Browser C  │◄───────────────────────────►│  ├───────────────────────┤  │
├─────────────┤                             │  │ Table State (per room)│  │
│  Browser D  │◄───────────────────────────►│  │  + action applier     │  │
└─────────────┘                             │  │  + visibility scoping │  │
                                            │  │  + undo snapshots     │  │
                                            │  │  + RNG (shuffle)      │  │
                                            │  ├───────────────────────┤  │
                                            │  │ Card Index (SQLite)   │  │
                                            │  └───────────────────────┘  │
                                            └─────────────┬───────────────┘
                                                          │ HTTPS (bulk sync, cache misses)
                                                          ▼
                                                    Scryfall API
```

**Server-authoritative, in-memory, non-enforcing.**

The server is authoritative for exactly two reasons, neither of which is anti-cheat:

1. **Hidden information.** Hands, library order, and face-down cards must never be sent to clients that shouldn't see them. A peer-to-peer or client-authoritative model can't provide this without real cryptography. A dumb honest server is by far the cheapest correct answer. (§9)
2. **Conflict resolution.** Four players clicking simultaneously need a single serialization point so everyone converges on the same state.

The server validates only *structural* legality of an action ("does this object exist", "is this zone real", "is this actor seated"), never *rules* legality.

### 3.1 State transport

Broadcast **full player-scoped state snapshots**, not deltas.

A Commander table is at most ~400 card objects plus scalars — well under a megabyte of JSON, and only changing at human click-speed. Deltas would add reconciliation complexity, ordering bugs, and a whole class of desync failures for no measurable benefit at this scale. If snapshot size ever becomes a problem, add compression before adding deltas.

Clients render the last snapshot received and apply **no optimistic updates**. Round-trip latency to a nearby VPS is tens of milliseconds; optimistic UI buys nothing here and introduces rollback bugs.

### 3.2 Why a web app is the right call

Confirmed from v0.1 — no install, link-shareable, WebSockets are more than adequate for turn-paced play. The freeform decision *strengthens* this: with no engine, the app is essentially a real-time collaborative document, which is a problem the web platform is unusually good at.

---

## 4. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| Frontend | React + TypeScript, Vite | Fast iteration; shared types with server |
| Client state | Zustand (or equivalent) | Thin mirror of server snapshots; no complex local logic needed |
| Rendering | DOM + CSS transforms for the battlefield | Card counts are low (hundreds). DOM gives free text rendering, accessibility, and hit-testing. Canvas is unnecessary complexity here. |
| Transport | WebSocket (`ws`) with a hand-rolled JSON message protocol | §11 |
| Backend | Node.js + TypeScript, single process | Shared `@common` package of type definitions is a large win |
| Card index | SQLite (file on disk, via `better-sqlite3`) | §5.2 — avoids holding a large JSON blob in RAM |
| Hosting | One small VPS or container host | No DB service, no auth service, no scaling requirements |
| User/game persistence | **None** (in memory, discarded on room close) | Per requirements |

**Clarifying a v0.1 ambiguity:** "no persistence" means *no user or game persistence* — no accounts, no saved decks, no match history. The **card reference index is persisted on disk**, because it's static public reference data, not user state. These are different things and v0.1 conflated them.

---

## 5. Card Data Pipeline

### 5.1 Model

Since there's no collection and no rules engine, card data is **display data only**: what to draw on the card face, plus a few fields used for sorting and informational hints. Nothing in the pipeline needs to understand what a card *does*.

Fields to store per card:

| Field | Use |
|---|---|
| `oracle_id`, `scryfall_id` | identity, printing selection |
| `name`, `mana_cost`, `cmc`, `type_line`, `oracle_text` | card face rendering, search |
| `power`, `toughness`, `loyalty`, `defense` | face rendering |
| `colors`, `color_identity` | commander identity hint (§12.4), deck display |
| `card_faces[]` | MDFC / transform / split / adventure / flip — must handle all layouts |
| `layout` | determines how the card is drawn and whether it can flip/transform |
| `image_uris` (normal + art_crop) | face rendering; art_crop for compact battlefield view |
| `set`, `collector_number` | printing selection from decklist |

### 5.2 Ingestion

Scryfall publishes [bulk data files](https://scryfall.com/docs/api/bulk-data). Two are relevant:

- **Oracle Cards** — one entry per distinct card. Smaller. Sufficient if you don't care which printing/art players get.
- **Default Cards** — one entry per printing. Substantially larger. Needed if players want their specific arts/sets honoured from decklists.

Both are large enough (hundreds of MB uncompressed JSON, and growing every set) that v0.1's "load it into an in-memory map on a small VPS" was a bad idea. **Check the actual current sizes at the `/bulk-data` endpoint before sizing your host** — they change with every release.

Recommended ingestion:

1. On first run, and thereafter on a weekly job, fetch the bulk file.
2. Stream-parse it (do not `JSON.parse` the whole file — it will blow the heap) and insert into SQLite with indices on lowercase name, and on `(set, collector_number)`.
3. Keep a small in-memory LRU cache for cards actively in play, since a given game touches at most ~400 distinct cards.
4. Live API fallback (`/cards/named?fuzzy=`) only for names absent from the index — covers cards from a set released since the last sync, and typo correction.

Store the bulk file's `updated_at` so you can skip re-ingestion when nothing changed.

### 5.3 Images

Two viable strategies:

- **Proxy-and-cache (recommended):** server fetches a card image on first request, stores it on disk, serves it thereafter. Bounded by how many distinct cards your group actually plays — likely a few thousand images, which is modest.
- **Hotlink:** simplest, zero storage, but couples game sessions to Scryfall availability and puts your traffic on their bandwidth.

Cache images by `scryfall_id` so different printings coexist.

---

## 6. Deck Import

### 6.1 Format

Accept the plain-text format exported by Moxfield / Archidekt / MTGGoldfish:

```
Commander
1 Atraxa, Praetors' Voice

Deck
1 Sol Ring
1 Command Tower
...
```

Parser requirements:
- `<qty> <name>` as the base form.
- Optional set/collector hints: `1 Sol Ring (LTC) 284` — honour them when present, fall back to any printing when absent.
- Section headers (`Commander`, `Deck`, `Sideboard`, `Maybeboard`) recognized case-insensitively. **A `Commander` section is required** — auto-detecting commanders from legendary creatures is unreliable with Partner, Backgrounds, and Doctor's Companion, and guessing wrong is worse than asking.
- 1–2 commanders supported.
- Ignore blank lines, `//` comments, and category tags some exporters emit.

### 6.2 Validation posture

**Warn, never block.** Per §1.1, the client's job is not to be right about legality.

Surface as non-blocking warnings: deck size not equal to 100 total (98+2 with partners, 99+1 otherwise), duplicate non-basic cards, unresolved card names. Unresolved names are the only genuinely important one — offer fuzzy-match suggestions and let the player correct or force-add the line.

A player may always start with a malformed deck if they choose to. This also means the "99 cards" assumption baked into v0.1's data model is gone; library size is simply whatever imported.

---

## 7. Core Model

This replaces v0.1 §7 (rules engine) and §9.4 (data model) entirely.

### 7.1 Objects, not cards

Everything on the table is a `GameObject`. Some originate from a decklist; some (tokens, copies) are created during play and have no decklist provenance. v0.1's model couldn't represent the latter — this one can.

```ts
type Visibility =
  | { kind: 'all' }                       // battlefield face-up, graveyard
  | { kind: 'none' }                      // library, face-down exile
  | { kind: 'players'; ids: PlayerId[] };  // hand (owner), peeked cards, revealed-to-some

interface GameObject {
  id: ObjectId;                 // unique for this table, stable across zone changes
  ownerId: PlayerId;            // who brought it / who it returns to. NEVER changes.
  controllerId: PlayerId;       // who currently manipulates it. CAN change.

  source:
    | { kind: 'card'; scryfallId: string; oracleId: string }
    | { kind: 'token'; scryfallId?: string; adhoc?: AdhocFace }
    | { kind: 'copy'; ofObjectId: ObjectId; scryfallId: string };

  zone: ZoneRef;                // { playerId, zone: 'library' | 'hand' | ... }
  position: number;             // ordering within zone (library order, stack order)

  faceVisibility: Visibility;   // who may see this object's front face
  faceDown: boolean;            // rendered as a card back to anyone not in faceVisibility
  currentFace: number;          // 0 or 1, for transform/MDFC/flip

  tapped: boolean;
  flipped: boolean;             // 180° rotation (phasing/"upside down" conventions)
  counters: Record<string, number>;  // ARBITRARY keys: '+1/+1', 'loyalty', 'stun', 'brick', ...
  attachedTo: ObjectId | null;  // auras, equipment, fortifications, "goad" markers etc.
  annotation: string | null;    // free-text note the players agree on
  markers: string[];            // ad-hoc flags: 'attacking', 'blocking', 'summoning-sick', 'monarch'
}
```

Key decisions and why:

- **`ownerId` vs `controllerId` are separate.** v0.1 conflated them by nesting cards inside player objects. Commander needs owner specifically (commander returns to its *owner's* command zone), and control-change effects like Mind Control are common.
- **`counters` is an open string map.** Never enumerate counter types. Magic has hundreds and prints new ones constantly. The UI offers common ones and a free-text field.
- **`markers` is an open string array.** Attacking, blocking, summoning sickness, goaded, monarch — all player-managed labels with no enforcement behind them.
- **`annotation`** covers the long tail: "cast for its adventure", "chose blue", "X=4", "exiled with Cascade". This single field absorbs an enormous number of cases a rules engine would need bespoke code for.
- **Objects live in a flat table-level collection**, keyed by `id`, with `zone` as a field. Zones are *views* computed by filtering, not arrays that objects are spliced between. This makes zone changes a single-field write and eliminates the entire class of "card duplicated because it was added before being removed" bugs.

### 7.2 Ad-hoc faces (tokens without a Scryfall entry)

```ts
interface AdhocFace {
  name: string;
  typeLine: string;
  power?: string;
  toughness?: string;
  text?: string;
  colors?: string[];
  artFromScryfallId?: string;   // borrow art from any card
}
```

Most tokens exist as real Scryfall objects and should be found via token search. `AdhocFace` is the escape hatch for copies with modifications, unusual token-makers, and emblems.

### 7.3 Table state

```ts
interface TableState {
  roomId: string;
  objects: Record<ObjectId, GameObject>;
  players: PlayerState[];        // 2-4, in turn order
  turn: TurnTracker;             // advisory only, §10
  log: LogEntry[];
  revision: number;              // increments per applied action
  createdAt: number;
}

interface PlayerState {
  id: PlayerId;
  displayName: string;
  seat: number;
  connected: boolean;

  life: number;                  // starts at 40
  counters: Record<string, number>;   // 'poison', 'experience', 'energy', 'rad', 'ticket', ...

  // Commander damage: FROM a specific commander object, TO this player.
  // Keyed by commander ObjectId only — object IDs are already globally unique,
  // so v0.1's nested Record<PlayerId, Record<...>> was redundant and confusing.
  commanderDamageTaken: Record<ObjectId, number>;

  // Cast count per commander object, for the tax hint (§12.2)
  commanderCastCount: Record<ObjectId, number>;

  commanderIds: ObjectId[];      // 1-2
  status: 'active' | 'conceded' | 'eliminated';
}
```

Zones per player: `library`, `hand`, `battlefield`, `graveyard`, `exile`, `commandZone`. Plus one table-level `stack` zone (shared, since the stack is a single shared zone in real Magic) and a table-level `limbo` zone for objects in transit / "outside the game".

**No mana pool in the model.** See §8.3 — mana is handled as an ephemeral client-side counter, not table state.

**No combat state in the model.** Attackers and blockers are `markers` on objects, set and cleared by players. There is no damage assignment system; players apply damage counters or adjust life directly.

---

## 8. Player Actions

The action catalog is the actual API surface of the product. Every action is structurally validated and applied atomically, then logged.

### 8.1 Object actions

| Action | Notes |
|---|---|
| `MOVE_OBJECT` | to any zone, any position (top/bottom/Nth of library), optionally changing face-down state. The universal primitive. |
| `TAP` / `UNTAP` | single object |
| `UNTAP_ALL` | **all your permanents**, one click — the single highest-value convenience in the app |
| `SET_COUNTER` | arbitrary key, absolute or delta |
| `ATTACH` / `UNATTACH` | sets `attachedTo` |
| `SET_MARKER` / `CLEAR_MARKER` | attacking, blocking, etc. |
| `CLEAR_ALL_MARKERS` | end-of-combat cleanup, one click |
| `TRANSFORM` | toggles `currentFace` |
| `TURN_FACE_DOWN` / `TURN_FACE_UP` | morph, manifest, cloaked, disguised |
| `SET_ANNOTATION` | free text |
| `CHANGE_CONTROLLER` | sets `controllerId`; object visually moves to that player's battlefield area |
| `CREATE_TOKEN` | from Scryfall token search or `AdhocFace`; supports quantity |
| `CREATE_COPY` | clones an object's source into a new object |
| `DELETE_OBJECT` | removes tokens/copies from the table |

### 8.2 Zone actions

| Action | Notes |
|---|---|
| `SHUFFLE_LIBRARY` | server-side RNG, §13 |
| `DRAW` | N cards, library top → hand |
| `MILL` | N cards, library top → graveyard |
| `SCRY` / `SURVEIL` / `PEEK_TOP` | reveals top N to the owner only (sets `faceVisibility` to that player), then owner reorders/distributes |
| `REVEAL` | set `faceVisibility` to all, or to specific players, without changing zone — covers "reveal from hand", "reveal top card" |
| `HIDE` | revert visibility |
| `SEARCH_LIBRARY` | opens a private browser of the owner's library; **must be followed by a shuffle prompt** |
| `MOVE_ALL` | e.g. dump hand to graveyard, exile a whole graveyard — bulk board wipe support |

### 8.3 Player actions

| Action | Notes |
|---|---|
| `SET_LIFE` | delta or absolute; **must support bulk** (Blasphemous Act hitting four players) |
| `SET_PLAYER_COUNTER` | poison, experience, energy, rad, tickets, arbitrary |
| `SET_COMMANDER_DAMAGE` | from a chosen commander object |
| `ROLL_DICE` / `FLIP_COIN` | server RNG, logged publicly, §13 |
| `CONCEDE` | §14.3 |
| `MULLIGAN` | §14.1 |
| `SAY` | table chat line into the log |

### 8.4 Mana

Deliberately **not** table state. Mana pools are ephemeral, emptied constantly, and tracking them server-side would create sync noise and add nothing — no one else at the table needs to see your floating mana, and no engine is checking payment.

Provide instead a **client-local mana pad**: a small WUBRGC counter widget the player bumps as they tap lands and spends as they cast. It resets at will and never leaves their browser. Players who don't want it can ignore it entirely.

This also disposes of v0.1's error about color identity (CR 903.11, mana produced outside your commander's identity becomes colorless): in freeform there is no mana enforcement at all, so it's purely a player-side consideration. The commander's color identity is *displayed* prominently (§12.4) so players can self-police.

---

## 9. Hidden Information

v0.1 named this as important and never designed it. It is the single most security-relevant part of the server, so it gets a concrete design.

### 9.1 Single projection boundary

There is exactly one function:

```ts
function projectFor(state: TableState, viewer: PlayerId): ClientTableState
```

Every outbound message passes through it. No other code path may serialize a `GameObject`. This is the rule that prevents leaks — scattered visibility logic is how these bugs happen.

### 9.2 Projection rules

For each object, evaluate `faceVisibility` against `viewer`:

- **Visible** → send the full object including `source`, so the client can render the card face.
- **Not visible** → send a redacted object: `id`, `zone`, `controllerId`, `tapped`, `counters`, `attachedTo`, `markers`, and a `hidden: true` flag. **Omit `source`, `ownerId`, and `annotation` entirely.** Not "send it with a flag" — omit the fields, so a client-side bug or an open dev-tools panel can't reveal them.

Zone-level rules:

- **Library:** all objects `{ kind: 'none' }`. Additionally, **do not send library object IDs in order** — send only a count, plus IDs for any objects currently peeked/revealed. Sending ordered IDs of a hidden library leaks shuffle order across a `SEARCH_LIBRARY`, which is a subtle and real leak.
- **Hand:** `{ kind: 'players', ids: [owner] }` by default. Others see a count.
- **Face-down battlefield/exile:** `{ kind: 'players', ids: [controller] }` typically, but a player may set it to `none` (for "exile face down, look at it later") or to specific players.
- **Stack, graveyard, battlefield face-up, command zone:** `{ kind: 'all' }`.

### 9.3 Why this isn't anti-cheat

A player can still lie about what they peeked, or take back information they shouldn't have. That's fine — you've stated the group is trusted. The projection boundary exists so that *no one accidentally sees something* and so that opening dev tools doesn't trivially spoil a game. It is not, and does not claim to be, a defense against a motivated adversary.

---

## 10. Turn Tracker (Advisory)

There is no priority system and no enforced turn structure. But a 4-player game still needs a shared sense of whose turn it is.

```ts
interface TurnTracker {
  turnNumber: number;
  activePlayerId: PlayerId;
  phase: Phase;   // advisory label only
}
```

- A `PASS_TURN` action advances `activePlayerId` to the next non-eliminated seat and increments `turnNumber`.
- Phase is a simple stepper the active player can advance; it's a label for the table, nothing more.
- **On turn pass, offer (do not force) an untap-all + clear-combat-markers bundle** for the incoming active player. One click, most common action in the game.
- The tracker is purely a coordination aid. Anyone can take any action at any time regardless of whose turn it is — which is correct, because instants exist and the server has no concept of priority.

---

## 11. Protocol

### 11.1 Message shapes

```ts
// Client → Server
type ClientMessage =
  | { t: 'join';   roomId: string; displayName: string; seat?: number; rejoinToken?: string }
  | { t: 'deck';   list: string }                         // raw decklist text
  | { t: 'ready';  ready: boolean }
  | { t: 'start' }                                        // host only
  | { t: 'action'; action: Action; clientSeq: number }
  | { t: 'undo';   targetRevision: number }
  | { t: 'ping' };

// Server → Client
type ServerMessage =
  | { t: 'state';    state: ClientTableState; revision: number }
  | { t: 'deckResult'; warnings: DeckWarning[]; unresolved: UnresolvedLine[] }
  | { t: 'rejected'; clientSeq: number; reason: string }
  | { t: 'log';      entries: LogEntry[] }                // incremental log append
  | { t: 'undoRequest'; requesterId: PlayerId; targetRevision: number; describes: string }
  | { t: 'error';    message: string }
  | { t: 'pong' };
```

### 11.2 Ordering and rejection

- Server processes actions in arrival order per room, single-threaded. `revision` increments on each applied action.
- `clientSeq` lets a client correlate a rejection with the action that caused it. Rejections are rare (structural only) — stale object ID, unseated actor, malformed payload.
- Since there are no optimistic updates (§3.1), a rejection requires no rollback. The client simply surfaces a toast and keeps rendering the last authoritative snapshot.
- Full state is rebroadcast to all players after every applied action. The log is sent incrementally to avoid resending history.

---

## 12. Commander Affordances

With no engine, these become *tracking and display* features rather than enforced rules. Each still needs deliberate UI.

### 12.1 Command zone

A first-class zone per player, always visible to everyone, rendered prominently. Commanders start here. `MOVE_OBJECT` handles casting from it, and handles the CR 903.9 replacement effect (commander going to command zone instead of graveyard, exile, **hand, or library** — v0.1 omitted the last two) as simply "move it to the command zone," which works from any zone without special-casing.

### 12.2 Commander tax

`commanderCastCount` increments when a commander object moves from command zone → stack. Display the resulting tax next to the commander (`+{4}` after two casts). It's a hint; the player pays it themselves, and can correct the count if they move a card around by accident.

### 12.3 Commander damage

A per-player grid: rows = each commander on the table, columns = damage dealt to you. Editable directly. When a player crosses 21 from a single commander, **highlight it** — don't end the game. Same for life ≤ 0 and poison ≥ 10. The table decides what happens; the app just makes it impossible to miss.

### 12.4 Color identity

Displayed on each commander from Scryfall's `color_identity`. Shown in the deck-import summary alongside any imported cards whose identity falls outside it, as a **warning only** (§6.2). At runtime, this is informational — see §8.4.

### 12.5 Starting state

Life 40. No mulligan enforcement. Turn order randomized at start (§13), or host-assigned.

---

## 13. Randomness

v0.1 never specified where randomness lived. All randomness is **server-side**, using `crypto.randomInt`:

- **Shuffling:** Fisher-Yates over the library's `position` values. Never exposed to clients in any form.
- **Dice and coin flips:** results go into the public log with the requester's name, so they're verifiable by the table.
- **Turn order:** randomized at game start, logged.

Client-side RNG would be both unverifiable and pointlessly leak-prone.

---

## 14. Session Lifecycle

### 14.1 Lobby

1. Player opens the app, enters a display name (browser-local, not persisted server-side beyond the session), creates a room (short code) or joins one.
2. **Seat claiming:** joining takes a specific seat, which locks. Room codes are unguessable (not sequential), and a room can be marked closed once all expected players have joined — prevents a stray link-holder from taking a seat mid-setup.
3. Each player pastes a decklist; server resolves it (§5, §6) and returns warnings. Player may fix and resubmit, or proceed anyway.
4. Ready check. Host starts. Turn order randomized.
5. **Opening hands:** each player draws 7. A `MULLIGAN` action shuffles hand into library, reshuffles, draws 7, and increments a mulligan counter shown to the table — London mulligan's "put N on the bottom" is done manually by the player via `MOVE_OBJECT`. The starting player skipping their first draw, and any free-first-mulligan house rule, are left to the players. (v0.1 omitted mulligans entirely.)

### 14.2 Disconnects and rejoining

- On join, the server issues a `rejoinToken`; the client stores it in `sessionStorage`. Reconnecting with a valid token restores that seat and pushes current state.
- A disconnected player's seat is held. Their board stays on the table untouched. Because there's no priority system, **the game simply continues** — other players can keep acting. This is a genuine advantage of the freeform model over v0.1, which needed an auto-pass mechanism that would have been rules-incorrect anyway.
- Show a clear "disconnected" badge on their seat.

### 14.3 Concede and elimination

A conceding player sets `status: 'conceded'`. The server then:
- Moves all objects they **own** to `limbo` (removed from the table).
- For objects they **control but don't own**, flags them for the owner to resolve — control reverts on player departure (CR 800.4a) but which player it reverts to is context-dependent, so prompt rather than guess.
- Removes their seat from turn rotation.
- Leaves their life/counters visible in the log for reference.

Their client switches to an observer view of the remaining game rather than being ejected. (v0.1 skipped player elimination entirely, despite specifying a 4-player format where it happens in most games.)

### 14.4 Timers

Not enforced. Assume players are on voice chat, where "are you still there?" costs nothing. An optional per-turn elapsed-time display is a reasonable low-cost addition; a shot clock is not, and would be actively annoying in Commander.

### 14.5 Server restarts destroy games

A consequence of no persistence that v0.1 never stated: **deploying the server ends every in-flight game.** Mitigations, in ascending effort:
- Don't deploy while friends are playing. (Realistically sufficient.)
- Show a connected-player count on a health endpoint before deploying.
- Optionally, periodically write `TableState` snapshots to a local file so a crash or deploy can restore rooms. This is a small amount of work and doesn't require a database or violate the "no user persistence" requirement, since it's transient operational state with a short TTL. Worth doing if games get long.

---

## 15. Game Log and Undo

With no engine arbitrating, **the log is the referee.** It is a core feature.

### 15.1 Log

```ts
interface LogEntry {
  revision: number;
  timestamp: number;
  actorId: PlayerId;
  text: string;                 // "Alice untapped 6 permanents"
  visibility: Visibility;       // private entries ("Alice looked at top 3") shown only to Alice
  undoable: boolean;
}
```

- Every action produces an entry. Entries are human-readable, not raw action dumps.
- **Private entries are projected** like objects — everyone sees "Alice searched her library," only Alice sees which cards she looked at.
- The log panel is always visible, scrollable, and filterable by player. In a 4-player game where three things happen at once, it's the only way to reconstruct what happened.

### 15.2 Undo

Misclicks are frequent in freeform play and there's no engine to prevent them, so undo is not optional.

- Server keeps a bounded ring buffer (say 50) of full `TableState` snapshots. Snapshots are small enough that this is trivially cheap and avoids the bug surface of inverse-action undo.
- **Self-undo:** a player may undo their own most recent action with no consent needed, provided no other player has acted since.
- **Rewind:** rolling back further, or undoing after others have acted, broadcasts an `undoRequest` describing what would be reverted; it applies on majority consent of connected players.
- **Undo cannot un-reveal information.** If an undo would restore hidden state a player has already seen, note it in the log ("Bob has seen the top card") — the information leak is real and unfixable, and the honest move is to surface it rather than pretend.

---

## 16. UI/UX

This is now the largest and most important part of the build. It is where the project succeeds or fails.

### 16.1 Layout

- Local player along the bottom: hand fanned at the very bottom edge, battlefield above it, split into a **lands row** and a **nonlands area** (this split alone removes enormous visual noise).
- 1–3 opponents arranged across the top and sides, scaled down but showing board state, life, and zone counts.
- Right sidebar: tabbed game log / chat, plus the commander damage grid.
- Left or floating: the client-local mana pad (§8.4), phase tracker, and pass-turn button.
- **Zoom-on-hover:** hovering any card shows it full-size with readable Oracle text. Non-negotiable — players need to read cards constantly and there's no engine to explain what anything does.

### 16.2 Interaction

- **Click to select, click to act.** Right-click (or long-press) opens a context menu with every action applicable to that object.
- **Drag-and-drop between zones** is worth building here, unlike in v0.1's design, because zone movement is the single most common operation in freeform play and menu-diving for it gets old immediately.
- **Double-click = most common action for that zone**: battlefield → tap/untap; hand → play to battlefield (lands) or stack (spells).
- **Multi-select** with shift-click or drag-box, so "tap five lands" or "sacrifice all my tokens" is one gesture.
- **Keyboard shortcuts** for the high-frequency actions: untap all, draw, pass turn, life +/-, mana pad.

### 16.3 The tedium checklist

Every one of these should be one click or less. This list is effectively the acceptance criteria for the UI:

- Untap all my permanents
- Draw a card
- Adjust any player's life by ±1 (and by an arbitrary amount)
- Adjust *all* players' life simultaneously
- Put a +1/+1 counter on a creature
- Create N copies of a token
- Clear all combat markers
- Move a card to graveyard from anywhere
- Search my library and shuffle
- Pass turn (with untap bundle)

---

## 17. Development Phases

Freeform changes the sequencing completely — there's a playable game far earlier.

**Phase 1 — Skeleton.** Room/lobby, WebSocket plumbing, seat claiming, Scryfall ingestion into SQLite, decklist parsing and resolution. Deliverable: four people can join a room and see each other's resolved decks.

**Phase 2 — Table core.** `GameObject` model, zones, the `MOVE_OBJECT` primitive, projection boundary (§9), shuffle/draw, full-state broadcast. Deliverable: **a playable, ugly game.** This is the milestone that matters — everything after it is improvement, not enablement.

**Phase 3 — Action catalog.** The rest of §8: counters, tokens, attachments, markers, reveal/peek/search, bulk life changes, dice. Deliverable: no interaction requires a workaround.

**Phase 4 — Log and undo.** §15. Deliverable: disputes are resolvable and misclicks are survivable.

**Phase 5 — Commander affordances.** §12: command zone UI, tax hints, commander damage grid, threshold highlighting.

**Phase 6 — UX pass.** §16.3 checklist, drag-and-drop, multi-select, keyboard shortcuts, hover zoom. Deliverable: pleasant rather than merely possible. Budget real time here; it's the product.

**Phase 7 — Ongoing.** Layout handling for weird card types (MDFC, flip, adventure, sagas, classes), token search quality, mobile/tablet responsiveness.

---

## 18. Testing

Far lighter than v0.1 required, since there's no rules logic to verify. Concentrate it where correctness actually matters:

- **Projection boundary (§9)** — the one place worth thorough testing. Property-style tests: for any state and any viewer, assert that no hidden object's `source` appears anywhere in the projected output. This catches leaks structurally rather than case-by-case.
- **Decklist parser** — table-driven tests against real exports from Moxfield, Archidekt, MTGGoldfish, and hand-written lists, including split/MDFC/adventure card names with weird punctuation (`Fire // Ice`, `Kongming, "Sleeping Dragon"`).
- **Action applier** — each action produces the expected state diff; unknown/stale object IDs are rejected cleanly.
- **Undo** — snapshot restore round-trips exactly.
- **Ingestion** — streams a large bulk file without exhausting heap.

Everything else is UI, verified by playing.

---

## 19. Deferred: Automation, Packs, Persistence

**Optional automation layer (most valuable future work).** The freeform model leaves room for opt-in, per-card convenience without ever becoming a rules engine: a card could declare "when this enters, its controller may draw a card" as a *suggested* action the client offers as a one-click button, which the player accepts or ignores. This is strictly additive, degrades gracefully to full manual, and can cover the top few hundred played cards without any obligation to cover the rest. If the project has a v2, this is it.

**Packs and persistence.** Unchanged from v0.1 — requires accounts and a collection store, both currently out of scope. A "pack" would be a random draw from the card index into a persisted collection, with no currency, as a collection-building feature rather than a monetization one. The decklist import path should remain regardless, since it's strictly faster for people who already have decks built elsewhere.

---

## 20. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| **UX tedium makes it worse than paper/webcam** | Project fails despite working correctly. This is now the #1 risk. | §16.3 checklist treated as acceptance criteria, not polish; Phase 6 gets real budget |
| Hidden information leak | Spoils games silently | Single projection boundary (§9.1), omit rather than flag hidden fields, property-based tests (§18) |
| Scryfall dependency / bulk data growth | Ingestion breaks or outgrows the host | Stream-parse into SQLite, check current bulk sizes before sizing, cache images locally |
| Odd card layouts render wrong | MDFCs, sagas, adventures, flip cards are common in Commander | Handle `layout` and `card_faces` from Phase 2, not as a late add |
| Rules disputes with no arbiter | Arguments, stalled games | The log (§15) is the referee; it's a core feature, not a nice-to-have |
| Server restart kills games | Frustration | §14.5 — at minimum, don't deploy during play; optionally snapshot to disk |
| Solo/duo bandwidth | Stalls | Phase 2 produces a genuinely playable game; everything after is incremental and independently shippable |

**Risks deleted from v0.1:** card coverage, rules-engine correctness, layers/replacement-effect bugs. These were the largest items in the previous document and the freeform decision removes all three outright.

---

## 21. Open Questions

1. **Printing fidelity:** do players care about getting their specific arts/sets from decklists? Yes → Default Cards bulk file and more storage. No → Oracle Cards, meaningfully smaller and simpler.
2. **Automation appetite:** is the group happy with fully manual play, or should the §19 suggested-action layer be pulled forward into v1 for the most-played cards?
3. **Snapshot-to-disk for server restarts (§14.5):** worth the small effort, or just avoid deploying during game nights?
4. **Tablet support:** is anyone playing on an iPad? It changes the interaction design (no hover, so zoom needs a different trigger) and is much cheaper to account for in Phase 6 than to retrofit.
5. **Room lifetime:** should an empty room be destroyed immediately, or held for a grace period so a table that all disconnects at once can resume?
