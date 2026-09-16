# Checkpoint — Command Table implementation status

Written at the end of a long implementation session. This is a snapshot, not a permanent doc —
delete it once you've absorbed the state, or fold anything still relevant into README.md.

## Where things stand

**Repo:** `github.com:ArttuLe/CommandTable`, pushed via SSH (key already registered on GitHub as
`ArttuLe`). `main` is at commit `8842e41`. One feature branch is open on top of it:
`feature/keyboard-shortcuts-and-lands-split` (commit `60e93f1`), pushed but **not merged** —
GitHub will offer a "Create pull request" link for it, or merge it yourself if you're happy with
the diff. Going forward, per your instruction, new work happens on feature branches rather than
directly on `main`.

## What's built

All of design doc Phases 1–4, most of Phase 5, and a real chunk of Phase 6:

- **Phase 1 (lobby):** room/seat management with rejoin tokens, Scryfall Oracle Cards ingestion
  into SQLite, decklist parsing and resolution with warn-never-block validation.
- **Phase 2 (table core):** the `GameObject`/zone model, `MOVE_OBJECT`, the hidden-information
  projection boundary (the doc's most safety-critical piece — property-tested per §18), draw/
  shuffle, per-player state broadcast.
- **Phase 3 (action catalog):** effectively the whole of §8 — tap/untap, counters, attach,
  markers, transform, face-down/up, annotations, control changes, tokens, copies, deletion,
  mill, peek, reveal/hide, library search, bulk moves, bulk life, commander damage, mulligan.
- **Phase 4 (log + undo):** every action logs a human-readable entry; a 50-snapshot ring buffer
  backs self-undo (instant) and majority-vote rewind; undo flags information leaks rather than
  hiding them.
- **Phase 5 (commander affordances):** tax tracking, a live commander-damage grid, life/poison
  lethal highlighting.
- **Phase 6 (client, started early):** a real React/Vite/Zustand client — lobby, table view,
  hover-zoom, a right-click context menu covering most of the action catalog, chat, dice/coin,
  token creation, library search with a revealed-card viewer, and (just landed, on the feature
  branch) a lands/nonlands battlefield split.

**Test coverage:** 143 automated tests (`npm test` from the repo root), all passing. Plus
extensive live verification in real two-tab browser sessions against real Scryfall data —
covered in detail in the git log and README.md, not repeated here.

## What's genuinely not done

- **Keyboard shortcuts** (§16.2) — was the other half of the in-progress feature branch; not
  implemented. Straightforward to add (a keydown listener gated on not-typing-in-an-input,
  mapped to draw/untap-all/pass-turn/life ±1) if you want to pick it back up.
- **Drag-and-drop, multi-select** (§16.2) — not started.
- **`ROLL_DICE`/`FLIP_COIN`/`CONCEDE`/`SAY`** are implemented and wired into the client, but
  `CONCEDE`'s "prompt rather than guess" control-reversion behavior (§14.3) is simplified to
  "revert to owner automatically, note it in the log" rather than an actual prompt — there's no
  prompt UI for it.
- **Phase 7 items:** MDFC/saga/adventure layout rendering nuance, mobile/tablet support, token
  search quality, server restart persistence (§14.5).
- **No deployment story.** The client is hardcoded to `localhost:8080` (`packages/client/src/api.ts`).
  Fine for local dev, not fine for actually hosting this for your friend group yet.

## Judgment calls worth knowing about

The README's "Notable deviations from the design doc" section (grown throughout this session)
is the authoritative list — it covers real surprises (Scryfall's bulk format changed since the
doc was written; Oracle Cards stores double-faced cards under a combined name the parser has to
alias around) and deliberate simplifications (SET_LIFE takes a player-id array for bulk support;
`window.prompt()` used instead of custom modals; casting a commander goes straight through the
stack to the battlefield in one client-side click since the doc treats the stack as a non-goal).
Read that section before assuming something is a bug rather than a documented choice.

## How to pick this back up

```
npm install
npm run ingest --workspace @command-table/server   # needs network access to api.scryfall.com
npm test                                             # 143 tests, should all pass
npm run dev --workspace @command-table/server        # :8080
npm run dev --workspace @command-table/client         # :5173
```

Then either finish the open feature branch (keyboard shortcuts), open more feature branches for
Phase 6/7 polish, or just play a game and see what's annoying in practice — that's the doc's own
recommended way to find what to build next (§18: "Everything else is UI, verified by playing").
