# UX review — November 2026 (temporary)

A working document for this round of UX fixes. Delete it once the round is done; anything worth
keeping belongs in the README, HOW-TO-PLAY.md or the code.

Source: an Impeccable critique of `packages/client`, played live on the 2-, 3- and 4-seat dev
tables at 1440×900, 1280×800 and 1024×700. Score **24/40 (Acceptable)**, up from 23 on 4 Nov.
Focus: making the table intuitive to use.

## Work

Status: ☐ to do · ◐ in progress · ☑ done · ✕ not this round

| # | Fix | From | Status |
|---|-----|------|--------|
| 1 | Lay the mats out in turn order | P0 | ☑ |
| 2 | Action bar follows the game state: turn actions off during opening hands, Keep the only primary, Start the game primary once everyone has kept, Pass turn primary only on your turn | P1 | ☐ |
| 3 | Undo names what it will take back, and asks before turning into a vote on someone else's action | P1 | ☐ |
| 4 | Life, poison and commander damage log with amounts and results ("lost 3 life (40 → 37)") | P1 | ☐ |
| 5 | Safe confirms: Cancel focused on destructive ones, Concede copy corrected, the out-of-turn pass warning names the player | P1 | ☐ |
| 6 | Opening-hand step: your mulligan count and where the extra cards go; "waiting for the host" for everyone else | P2 | ☐ |
| 7 | `?` opens help; help traps focus; Enter and Shift+F10 in the shortcut list; no doubled "…." | P2/P3 | ☐ |
| 8 | Commander-damage button named for screen readers; mana chooser shows emblems, not letters | P2 | ☐ |
| 9 | Room-code field labelled; unread badge at least 11px; game over tells a non-host what happens next | P3 | ☐ |
| — | Attack or target a *player* (needs `/impeccable shape` first) | P2 | ✕ |
| — | Rebalance the HUD against the table; own mat larger than opponents' | P2 | ✕ |
| — | Card menu as a real ARIA menu with arrow keys | P2 | ✕ |
| — | Merge consecutive life-change toasts | P3 | ✕ |

### Done

- **#1** `seating.ts` lays the mats out in `players` order, which is the turn order: the server
  shuffles that list at deal time and leaves each lobby `seat` as it was. `seating.test.ts` pins
  it, and the new `e2e/turn-order.spec.ts` passes the turn round a 4-seat table checking that the
  lit mat moves clockwise. With the fix reverted it failed 3 runs out of 3; by chance a broken
  layout passes one run in six. `e2e/player-rail.spec.ts` found Carol by name, assuming she was
  top-right, so it now finds the top-right mat by position.

### Notes for the remaining fixes

Found while reading the code; check them before relying on them.

- **#2:** Pass turn's gold is the `urgent` class in `ActionBar.tsx`. In `SetupStep.tsx`, Start the
  game is always `btn-primary`; give it `urgent` only once everyone has kept, as it already does
  for its title. `Table.tsx` already knows `setupComplete` and `isMyTurn`.
- **#3:** The client can't work out what Undo reverts. After a revert, the server's
  `TableHistory` tracks *content* revisions, and the log doesn't show which one the table is
  sitting on (`undoTarget`, `canSelfUndo` in `tableHistory.ts`). The likely fix is for the server
  to send it with each `state` message: the revision of the action being reverted and its actor.
  There are two send sites in `server.ts` (`broadcastTableState`, and the join path at about
  line 178). The client can then name it with `undoneEntry` and `namedLogText` (`undoPrompt.ts`,
  `logText.ts`), ask before a vote when the actor isn't you, and replace `canUndo` (currently
  `revision > 0`). Z goes through the same `undoLast` in `Table.tsx`.
- **#4:** `describeAction(action)` (`actionDescriptions.ts`) sees only the action, but
  `applyAction` (`actionApplier.ts`, around line 71) holds the state both before and after: pass
  them in. To name the commander in commander-damage lines, extend `subjectOf` to read
  `fromCommanderObjectId`. The client then writes the name over "a card" (`logText.ts`). Update
  `actionDescriptions.test.ts`.
- **#5:** `ConfirmDialog.tsx` always focuses the confirm button. Add a prop to focus Cancel
  instead, and use it for Concede, Mulligan, Clear and the out-of-turn pass. On concede the
  server moves your cards to limbo and returns borrowed permanents (`metaActions.ts`). The
  Concede copy is in `ActionBar.tsx`. `PASS_TURN_WARNING` in `turnStatus.ts` is a constant; turn
  it into a function of the active player's name.
- **#6:** The mulligan count is in `PlayerState.counters.mulligan` (`playerActions.ts`). A hand
  card's menu already offers Bottom (`cardMenu.ts`). The host is `roomState.hostId`.
- **#7:** `HelpButton` owns its open state, while keyboard shortcuts and their guards live in
  `Table.tsx`'s key switch, so lift the state to make `?` open help. Add the focus trap in
  `Dialog.tsx`, which every dialog uses. The doubled "…." is in `HOW_TOS` in `shortcuts.ts`.
- **#8:** The commander-damage menu button is `CommanderDamageMenu` in `ActionBar.tsx`.
  `ManaChoice.tsx` renders letters; use `ManaEmblem` from `icons.tsx`.
- **e2e:** follow the seat-count buckets in `e2e/seat.ts`. Find mats by position, not by name,
  because turn order is shuffled at every deal.

## Design health

| # | Heuristic | Score | Key issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 2 | Undo doesn't say what it will take back; life changes log as "changed a life total"; opponents' rail counts ~3px on screen at Fit |
| 2 | Match with the real world | 2 | The mats aren't in turn order; you can't attack or target a player |
| 3 | User control and freedom | 3 | Undo vote, Esc, untap-refunds-mana are solid; Undo hits the table's last action, which may be someone else's |
| 4 | Consistency and standards | 2 | Primary changes meaning (blue → gold); mana chooser uses letters, the pad uses emblems; Concede copy contradicts help and server |
| 5 | Error prevention | 2 | Enter confirms Concede; P then Enter ends someone else's turn; Draw, Untap all and Pass turn live during opening hands |
| 6 | Recognition rather than recall | 2 | Attack, block, target and counters only behind right-click; mulligan count only on the ~3px rail |
| 7 | Flexibility and efficiency | 3 | Good single-key shortcuts and bulk select; `?` doesn't open help; no "attack with these" |
| 8 | Aesthetic and minimalist design | 3 | Calm, coherent HUD; ~17 live controls around a binary Mulligan/Keep decision |
| 9 | Error recovery | 2 | Undo outcomes announced; Home disables buttons without saying why; "reverted the game to an earlier point" says nothing |
| 10 | Help and documentation | 3 | The task-first "How do I…" tab is genuinely good; help doesn't trap focus; `?` does nothing |

## What's working

1. **The decision sits on what you're deciding about.** The opening-hand step is right above the
   hand, and "Still deciding: Carol, Dave" means nobody has to ask out loud.
2. **Undo is a visible social protocol.** The vote, the tally, the announced outcome and the
   seen-information note turn a source of friction into something everyone can read.
3. **The mana pad follows your hands.** Tapping fills it, untapping refunds it, a dual asks at the
   cursor, and an empty pad says "No mana — tap a land".

## Priority issues

**[P0] The mats aren't laid out in turn order.** `tableFactory.ts` shuffles `players` to set turn
order but keeps each player's lobby `seat`; `passTurn` follows the array, while `seating.ts`
sorts the mats by `seat`. In the 4-seat test the turn went from Alice (bottom-left) to Carol (top-right).
Everyone reads "who's next" off the table.

**[P1] The action bar's emphasis ignores the game state.** Three primary buttons during opening
hands (Keep, Start the game, Pass turn), with Draw, Untap all and Pass turn live. Pass turn turns
gold "urgent" the moment your turn begins, and stays blue primary on other players' turns, when it
is the button you should not press.

**[P1] Undo doesn't say what it will take back.** After a misclick, if anyone acts first, Undo
asks the table to undo *their* action — in testing, Alice's Undo became a vote on Bob's draw.

**[P1] The log names the kind of action, not what changed.** "changed a life total" and "updated
commander damage" record no amount and no result. The log is the referee, and life totals are what
tables argue about.

**[P1] The highest-stakes confirms are the least safe.** Every confirm focuses its confirm button,
so Enter concedes, and P then Enter ends someone else's turn. The Concede copy says "your cards
stay on the table"; the server moves them out of the game, and the help says they leave.

## Personas

- **Alex (power user):** no "attack with these"; the life dialog takes a change, not a value;
  Undo can't target "mine"; `?` doesn't open help; five life clicks make five vague toasts.
- **Jordan (new to the app, knows Magic):** nothing says right-click is how you attack; a gold
  Pass turn greets the start of the turn; the mulligan band reads the same after a mulligan, with
  no word about putting cards on the bottom; after keeping, a non-host isn't told they're waiting
  for the host.
- **Sam (keyboard, screen reader, low vision):** help doesn't trap focus; the commander-damage menu
  button is named by its number; the mana chooser uses letters; the card menu has no menu role or
  arrow keys.

## Minor observations

- [P2] The HUD takes ~35% of the height at 1280×800; hand cards are 4× the size of battlefield cards.
- [P2] The hover preview anchors over your own bottom-left mat.
- [P2] After conceding, the loser's HUD stays live.
- [P3] In a 3-player game the empty fourth quadrant wastes a quarter of the table.
- [P3] The detector's live scan flags `nested-cards` on the mats' zone bands (deliberate) and on
  the rails (the outer "card" is the pan/zoom frame — false positive).
- [P3] Fresh checkouts without the card index fail `deckResolver.integration.test.ts`: its
  `describe.skipIf` still runs the body, and `new Database(DB_PATH)` throws when `data/` is missing.

## Questions

1. The app refuses to enforce rules — so why should its loudest button be the one that ends your turn?
2. In a 4-player game, should Undo mean "mine", with a table rewind as a separate, deliberate act?
3. If the log is the referee, shouldn't every life change say from what to what?
4. Should your own mat be larger than your opponents'?
