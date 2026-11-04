import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { PlayerId, ProjectedObject } from '@command-table/common';
import { useStore } from './store.js';
import { useUiStore } from './uiStore.js';
import { CardTile } from './CardTile.js';
import { ContextMenu } from './ContextMenu.js';
import { Plane } from './Plane.js';
import { Board } from './Board.js';
import { SetupStep } from './SetupStep.js';
import { ArrowLayer } from './ArrowLayer.js';
import { combatRelations } from './combat.js';
import { CommanderName, type CommanderRef } from './commanders.js';
import { ActionBar, ManaPad, SelectionBar, VitalsPad } from './ActionBar.js';
import { LogRail, Toasts } from './LogRail.js';
import { ChatRail } from './ChatRail.js';
import { chatEntries, tableEntries } from './logStreams.js';
import { ZoneDock, type DockZone } from './ZoneDock.js';
import { seating } from './seating.js';
import { PASS_TURN_WARNING, turnHighlight, turnLabel } from './turnStatus.js';
import { libraryMoveAction } from './libraryMoves.js';
import { commanderPrompts, spentDismissals } from './commanderPrompt.js';
import { SettingsMenu } from './SettingsMenu.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { HelpButton } from './HelpDialog.js';
import { ManaChoice, type ManaChoicePrompt } from './ManaChoice.js';
import { manaToRemove } from './manaSources.js';
import { undoPromptText, undoTallyText } from './undoPrompt.js';
import { fanOverlap } from './handFan.js';

function isOwnZone(obj: ProjectedObject, playerId: PlayerId, zone: string): boolean {
  return 'playerId' in obj.zone && obj.zone.playerId === playerId && obj.zone.zone === zone;
}

/**
 * How tightly to fan the hand, measured rather than guessed (see handFan.ts).
 *
 * The hand's own width is the width the HUD's grid allotted it, which is exactly the space the
 * fan has to stay inside; `--card-w` and the row's gap are read off the element so the fan
 * follows the card-size steps at narrow windows without repeating their breakpoints here.
 * Observed rather than measured once, because the window is resized mid-game and the flanks
 * either side of the hand grow and shrink with what they are showing.
 *
 * Overlapping narrows the hand, which the observer then re-measures, so this has to be a loop
 * that settles. It does because the column is sized by the grid and not by the hand (see
 * `.hud-row` in styles.css): what is measured is the room available, which the overlap cannot
 * change, so the next measurement asks the same question and gets the same answer. `handFan`'s
 * pixel of slack covers the rounding at the exact boundary.
 */
function useFanOverlap(count: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [overlap, setOverlap] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const style = getComputedStyle(el);
      const cardWidth = parseFloat(style.getPropertyValue('--card-w'));
      setOverlap(fanOverlap(count, cardWidth, parseFloat(style.columnGap), el.clientWidth));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [count]);

  return { ref, overlap };
}

/**
 * Three bands: a status bar that reports and asks (whose turn it is, undo votes, whether a dead
 * commander should go to the command zone), the table itself with the log rail beside it, and
 * your own things — mana, hand, zones, actions — along the bottom where your cursor already is.
 */
export function Table() {
  const tableState = useStore((s) => s.tableState)!;
  const playerId = useStore((s) => s.playerId)!;
  const act = useStore((s) => s.act);
  const pendingUndoRequest = useStore((s) => s.pendingUndoRequest);
  const send = useStore((s) => s.send);
  const roomState = useStore((s) => s.roomState);

  const logRailOpen = useUiStore((s) => s.logRailOpen);
  const toggleLogRail = useUiStore((s) => s.toggleLogRail);
  const chatRailOpen = useUiStore((s) => s.chatRailOpen);
  const toggleChatRail = useUiStore((s) => s.toggleChatRail);
  const setLibraryDirty = useUiStore((s) => s.setLibraryDirty);
  const dismissedCommanders = useUiStore((s) => s.dismissedCommanders);
  const dismissCommander = useUiStore((s) => s.dismissCommander);
  const followActivePlayer = useUiStore((s) => s.followActivePlayer);
  const toggleFollowActivePlayer = useUiStore((s) => s.toggleFollowActivePlayer);
  const dialogOpen = useUiStore((s) => s.openDialogs > 0);
  const bumpMana = useUiStore((s) => s.bumpMana);
  const resetMana = useUiStore((s) => s.resetMana);
  const pointing = useUiStore((s) => s.pointing);
  const cancelPointing = useUiStore((s) => s.cancelPointing);

  // Set by a middle-click on the table: glide to whoever is active *now*. The player is captured
  // rather than read live, so that with following switched off the view stays where it was put
  // instead of chasing the next turn. The nonce lets the same player be asked for twice running.
  const [focusRequest, setFocusRequest] = useState<{ key: PlayerId; nonce: number } | null>(null);

  // Bumped by the F shortcut. Plane already refits whenever its fitKey changes, so asking for a
  // fit is a change to that key — no second channel into the component, and the keyboard guards
  // that keep shortcuts out of dialogs and text fields stay in the one place they live.
  const [fitNonce, setFitNonce] = useState(0);

  const [menu, setMenu] = useState<{ obj: ProjectedObject; x: number; y: number } | null>(null);
  const [manaChoice, setManaChoice] = useState<ManaChoicePrompt | null>(null);
  const openMenu = (obj: ProjectedObject) => (e: React.MouseEvent) => {
    e.preventDefault();
    setMenu({ obj, x: e.clientX, y: e.clientY });
  };

  // Before the host starts the game, whose turn it is doesn't mean anything yet (the pill says
  // "Opening hands"), so nothing may glow at you to end it.
  const isMyTurn = tableState.setupComplete && tableState.turn.activePlayerId === playerId;

  // PASS_TURN advances the table from whoever is active, so out of turn it ends someone else's
  // turn — one dialog in front of both the button and the shortcut (see turnStatus.ts).
  const [confirmingPass, setConfirmingPass] = useState(false);
  // Floating mana does not survive the end of a turn, so passing empties the pad the same way
  // untapping does. It is client-local either way (§8.4), so this is a local reset and not an
  // action — nobody else's pad is anyone's business.
  const passTurn = useCallback(() => {
    act({ t: 'PASS_TURN' });
    resetMana();
  }, [act, resetMana]);
  const requestPassTurn = useCallback(
    () => (isMyTurn ? passTurn() : setConfirmingPass(true)),
    [isMyTurn, passTurn]
  );

  // Untapping everything is the gesture that ends a turn's worth of mana, so it empties the pad
  // with it — floating mana outlives an untap step in no game of Commander. Shared by the button
  // and the `U` shortcut so the two can't drift.
  const untapAll = useCallback(() => {
    act({ t: 'UNTAP_ALL', playerId });
    resetMana();
  }, [act, playerId, resetMana]);

  // Which revision one step back actually is belongs to the server: a revert carries older
  // content under a newer number, so only the history can say (see tableHistory.ts). No
  // confirmation in front of it either — undoing your own last action is the common case and is
  // instant, and anything further back already has the table's vote in front of it.
  const undoLast = useCallback(() => send({ t: 'undo' }), [send]);

  // §16.2 keyboard shortcuts for the high-frequency actions, listed by the `?` in the status bar
  // (HelpDialog). Gated on not-typing-in-an-input so it doesn't fire while the chat box or a
  // dialog's own field has focus.
  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      return target instanceof HTMLElement && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
    }

    function onKeyDown(e: KeyboardEvent) {
      // A dialog answers its own keys; the table's shortcuts stay out of the way while one is up.
      if (e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target) || dialogOpen) return;
      switch (e.key.toLowerCase()) {
        case 'd':
          act({ t: 'DRAW', playerId, count: 1 });
          break;
        case 'u':
          untapAll();
          break;
        case 'p':
          requestPassTurn();
          break;
        case '+':
        case '=':
          act({ t: 'SET_LIFE', playerIds: [playerId], update: { mode: 'delta', amount: 1 } });
          break;
        case '-':
          act({ t: 'SET_LIFE', playerIds: [playerId], update: { mode: 'delta', amount: -1 } });
          break;
        case 'l':
          toggleLogRail();
          break;
        case 'c':
          toggleChatRail();
          break;
        case 'z':
          undoLast();
          break;
        case 'f':
          setFitNonce((n) => n + 1);
          break;
        case 'escape':
          useUiStore.getState().clearSelection();
          // Escape is already "stop what you were about to do"; an armed arrow is that.
          useUiStore.getState().cancelPointing();
          break;
        default:
          return;
      }
      e.preventDefault();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [act, playerId, dialogOpen, requestPassTurn, toggleChatRail, toggleLogRail, undoLast, untapAll]);

  const objects = Object.values(tableState.objects);

  // You are always bottom-left, everyone else clockwise from you in turn order (see seating.ts).
  const seats = useMemo(() => seating(tableState.players, playerId), [tableState.players, playerId]);

  const inZone = (pid: PlayerId, zone: string) => objects.filter((o) => isOwnZone(o, pid, zone));
  const myHand = inZone(playerId, 'hand');
  const fan = useFanOverlap(myHand.length);

  // §12.3: every commander on the table, for the boards' damage badges and the commander
  // prompt; your own HUD only offers the ones that can actually hit you.
  const allCommanders: CommanderRef[] = tableState.players.flatMap((owner) =>
    owner.commanderIds.map((id) => ({
      id,
      ownerId: owner.id,
      ownerName: owner.displayName,
      obj: tableState.objects[id],
    }))
  );

  // Every block and target arrow currently on the table (see combat.ts). Memoised on the objects
  // map so the arrow layer isn't handed a new array on every unrelated re-render.
  const relations = useMemo(() => combatRelations(tableState.objects, playerId), [tableState.objects, playerId]);

  // Split once: each rail and each toast stack reads only the stream it owns.
  const chatLog = useMemo(() => chatEntries(tableState.log), [tableState.log]);
  const tableLog = useMemo(() => tableEntries(tableState.log), [tableState.log]);

  const me = tableState.players.find((p) => p.id === playerId)!;
  const opposingCommanders = allCommanders.filter((c) => c.ownerId !== playerId);

  // §12: your own commanders only — whether one goes to the command zone instead of staying dead
  // is its owner's call, and nobody else's to be nagged about.
  const prompts = commanderPrompts(tableState.objects, me.commanderIds, dismissedCommanders);
  // A "Leave it" lasts as long as the commander stays where it was left (see spentDismissals).
  const forgetDismissals = useUiStore((s) => s.forgetDismissals);
  useEffect(() => {
    const spent = spentDismissals(tableState.objects, dismissedCommanders);
    if (spent.length > 0) forgetDismissals(spent);
  }, [tableState.objects, dismissedCommanders, forgetDismissals]);

  const dockZones: DockZone[] = [
    { key: 'graveyard', label: 'Graveyard', count: inZone(playerId, 'graveyard').length, objects: inZone(playerId, 'graveyard') },
    { key: 'exile', label: 'Exile', count: inZone(playerId, 'exile').length, objects: inZone(playerId, 'exile') },
    {
      key: 'library',
      label: 'Library',
      count: tableState.libraryCounts[playerId],
      // Only cards SEARCH_LIBRARY/PEEK_TOP made visible are in tableState.objects at all —
      // everything else in a library is omitted from the projection entirely (§9.2).
      objects: inZone(playerId, 'library'),
      note: 'Only cards you searched or peeked at are shown.',
      onMove: (move, obj) =>
        act(libraryMoveAction(move, obj.id, playerId, tableState.libraryCounts[playerId])),
      // A search owes the table a shuffle and used to owe it in prose ("remember to shuffle").
      // Closing the popover is the moment the search is over, so that's where it gets paid.
      onClose: () => {
        if (!useUiStore.getState().libraryDirty) return;
        act({ t: 'SHUFFLE_LIBRARY', playerId });
        setLibraryDirty(false);
      },
    },
  ];

  return (
    <div className={`table ${pointing ? 'targeting' : ''}`}>
      <header className="status-bar">
        {/* Leads the bar as a quiet identifier — someone joining late asks for it mid-game, and
            hunting for it shouldn't mean leaving the table. Subdued so it doesn't compete with
            the turn pill, which is what everyone is actually watching. */}
        <span className="room-code">{tableState.roomId}</span>
        {/* Until the host starts the game, whose turn it is doesn't mean anything yet — the pill
            says which moment the table is in instead. The opening-hand step itself is down in
            the HUD, where you can see the hand it is asking about; the pill keeps its slot here
            either way, so nothing shifts when the game begins. */}
        {/* Announced when it changes: whose turn it is was otherwise only ever a colour. */}
        <span className={`turn-pill ${isMyTurn ? 'mine' : ''}`} aria-live="polite">
          {tableState.setupComplete ? turnLabel(tableState.turn, tableState.players, playerId) : 'Opening hands'}
        </span>

        {pendingUndoRequest && (
          <div className="undo-request" role="status">
            <span>{undoPromptText(pendingUndoRequest, tableState.log, tableState.players, playerId)}</span>
            <span className="undo-tally">{undoTallyText(pendingUndoRequest)}</span>
            {/* The requester's approval is counted already; the vote is everyone else's. */}
            {pendingUndoRequest.requesterId !== playerId && (
              <>
                <button className="btn" onClick={() => send({ t: 'undoVote', targetRevision: pendingUndoRequest.targetRevision, approve: true })}>
                  Approve
                </button>
                <button className="btn btn-ghost" onClick={() => send({ t: 'undoVote', targetRevision: pendingUndoRequest.targetRevision, approve: false })}>
                  Reject
                </button>
              </>
            )}
          </div>
        )}

        {/* Sits here with the undo request rather than in the toast rail: the offer is a standing
            state, not a moment. A toast would expire in five seconds and take the choice with it. */}
        {prompts.map((prompt) => (
          <div key={prompt.objectId} className="commander-prompt">
            <span>
              <CommanderName commander={allCommanders.find((c) => c.id === prompt.objectId)!} /> is in your{' '}
              {prompt.zone === 'graveyard' ? 'graveyard' : 'exile'}.
            </span>
            <button
              className="btn"
              onClick={() => act({ t: 'MOVE_OBJECT', objectId: prompt.objectId, toZone: { playerId, zone: 'commandZone' } })}
            >
              To command zone
            </button>
            <button className="btn btn-ghost" onClick={() => dismissCommander(prompt.objectId, prompt.zone)}>
              Leave it
            </button>
          </div>
        ))}

        {/* Pushed to the far end of the bar by its own margin, so whatever the bar is currently
            asking you stays next to the turn pill where you're already looking. */}
        <div className="status-tools">
          <HelpButton />
          <SettingsMenu />
        </div>
      </header>

      <div className="table-main">
        {/* Chat on the left, the log on the right, the table between them — talking and the
            record of play are different things and were sharing one scroll. */}
        <ChatRail
          log={tableState.log}
          players={tableState.players}
          open={chatRailOpen}
          onToggle={toggleChatRail}
          onSend={(text) => act({ t: 'SAY', playerId, text })}
        />

        {/* Refit when the number of boards changes — the plane's size changes then, and a view
            that re-centered itself every time someone played a card would be unusable — or when
            F is pressed, which is the same request made on purpose. */}
        <Plane
          fitKey={`${seats.length}:${fitNonce}`}
          // Following re-aims every turn on its own; a middle-click only ever aims once.
          focus={
            followActivePlayer
              ? { key: tableState.turn.activePlayerId, nonce: focusRequest?.nonce ?? 0 }
              : focusRequest
          }
          onFocusRequest={() =>
            setFocusRequest((prev) => ({ key: tableState.turn.activePlayerId, nonce: (prev?.nonce ?? 0) + 1 }))
          }
          following={followActivePlayer}
          onToggleFollow={toggleFollowActivePlayer}
        >
          <div className={`mats ${seats.length <= 2 ? 'stacked' : 'quad'}`}>
            {seats.map((seat) => {
              const player = tableState.players.find((p) => p.id === seat.playerId);
              if (!player) return null;
              const isSelf = player.id === playerId;
              return (
                <Board
                  key={player.id}
                  player={player}
                  seat={seat}
                  turn={turnHighlight(player.id, tableState.turn, playerId)}
                  // Hand and library are counted by the server (§9.2); graveyard and exile are
                  // public zones and counted off the projection, the same way the dock does it.
                  counts={{
                    hand: tableState.handCounts[player.id],
                    library: tableState.libraryCounts[player.id],
                    graveyard: inZone(player.id, 'graveyard').length,
                    exile: inZone(player.id, 'exile').length,
                  }}
                  battlefield={inZone(player.id, 'battlefield')}
                  commandZone={inZone(player.id, 'commandZone')}
                  allCommanders={allCommanders}
                  commanderCastCount={player.commanderCastCount}
                  // Tapping your own permanent also fills your mana pad with what it makes
                  // (§8.4 — the pad is client-local, so this never leaves the browser). One
                  // symbol goes straight in; a dual asks which, at the cursor.
                  onTapToggle={(obj, produces, e) => {
                    act({ t: obj.tapped ? 'UNTAP' : 'TAP', objectId: obj.id });
                    if (!isSelf || produces.length === 0) return;
                    if (obj.tapped) {
                      // Untapping takes back what tapping put in — clicking a land you didn't
                      // mean to tap should leave the pad where it was. Which colour, when the
                      // source makes several, is read off the pad (see manaToRemove).
                      const color = manaToRemove(produces, useUiStore.getState().manaPad);
                      if (color) bumpMana(color, -1);
                    } else if (produces.length === 1) {
                      bumpMana(produces[0], 1);
                    } else {
                      setManaChoice({ colors: produces, x: e.clientX, y: e.clientY });
                    }
                  }}
                  onCastCommander={
                    isSelf
                      ? (obj) => {
                          // Two steps so §12.2's tax tracking (command zone -> stack) fires; the
                          // doc treats the stack itself as a non-goal (§1.3: "no stack
                          // resolution"), so resolving straight to the battlefield is fair.
                          act({ t: 'MOVE_OBJECT', objectId: obj.id, toZone: { zone: 'stack' } });
                          act({ t: 'MOVE_OBJECT', objectId: obj.id, toZone: { playerId, zone: 'battlefield' } });
                        }
                      : undefined
                  }
                  onObjectContextMenu={openMenu}
                />
              );
            })}

            {/* Last child of the mats so it paints over them, and inside the plane so it moves
                with them. `revision` is what tells it a card may have shifted. */}
            <ArrowLayer relations={relations} revision={tableState.revision} />
          </div>
        </Plane>

        <LogRail
          log={tableState.log}
          players={tableState.players}
          myId={playerId}
          open={logRailOpen}
          onToggle={toggleLogRail}
        />
      </div>

      {/* Fixed chrome, outside the plane: your hand has to stay readable no matter how far the
          table is zoomed out, and the actions you take every turn belong next to it. */}
      <div className={`hud ${isMyTurn ? 'my-turn' : ''}`}>
        {/* A band of its own across the top of the HUD, directly above the cards it is asking
            about: you cannot judge a mulligan without seeing your hand, so the decision sits
            with it rather than in the status bar (where it read as chrome) or in a centred
            modal (which would cover the very thing you are deciding on). */}
        {!tableState.setupComplete && (
          <SetupStep
            players={tableState.players}
            playerId={playerId}
            isHost={roomState?.hostId === playerId}
            handCount={myHand.length}
          />
        )}
        {/* Mana and your zones share the top strip: both are read-and-poke controls that want to
            be near the hand without stealing any of its height. */}
        <div className="hud-top">
          {/* Your life and poison are written here and read off your board: the readouts out on
              the plane are a scoreboard, and only their owner's own HUD changes a row of it. */}
          <VitalsPad
            player={me}
            commanders={opposingCommanders}
            onLifeDelta={(amount) => act({ t: 'SET_LIFE', playerIds: [playerId], update: { mode: 'delta', amount } })}
            onPoisonDelta={(amount) =>
              act({ t: 'SET_PLAYER_COUNTER', playerId, key: 'poison', update: { mode: 'delta', amount } })
            }
            // Commander damage is also life lost (§12.3), and tracking it twice by hand is how
            // the two readouts drift apart. Both halves are separate actions, so one undo reverts
            // one half — acceptable next to always having to remember the second click.
            onCommanderDamageDelta={(fromCommanderObjectId, amount) => {
              act({ t: 'SET_COMMANDER_DAMAGE', toPlayerId: playerId, fromCommanderObjectId, update: { mode: 'delta', amount } });
              act({ t: 'SET_LIFE', playerIds: [playerId], update: { mode: 'delta', amount: -amount } });
            }}
          />
          <ManaPad />
          <ZoneDock zones={dockZones} onObjectContextMenu={openMenu} />
        </div>
        <div className="hud-row">
          <ActionBar
            playerId={playerId}
            isMyTurn={isMyTurn}
            onPassTurn={requestPassTurn}
            onUntapAll={untapAll}
            onUndo={undoLast}
            canUndo={tableState.revision > 0}
          />
          {/* Overlapping fan rather than a second row: a big hand must not steal height from
              the table — and the overlap tightens only as far as it has to, so it doesn't steal
              width from the controls either side of it instead (see handFan.ts). Crowding is
              what the measurement found, not a card count: the hand overlaps exactly when it
              would otherwise wrap, which an opening seven already does. */}
          <div
            ref={fan.ref}
            className={`hand ${fan.overlap > 0 ? 'crowded' : ''}`}
            style={{ '--fan-overlap': fan.overlap } as React.CSSProperties}
          >
            {myHand.map((obj) => (
              <CardTile
                key={obj.id}
                obj={obj}
                // A double-click, per §16.2: playing reveals the card to everyone and can't be taken
                // back, and a single click is how people look at one. Not at all during opening
                // hands — the hand is there to be judged, and a card played then is a misclick.
                onDoubleClick={
                  tableState.setupComplete
                    ? () => act({ t: 'MOVE_OBJECT', objectId: obj.id, toZone: { playerId, zone: 'battlefield' } })
                    : undefined
                }
                onContextMenu={openMenu(obj)}
              />
            ))}
          </div>
        </div>
      </div>

      {/* An armed arrow changes what the next click does, so it has to say so — a crosshair
          cursor alone is too quiet for a mode. It floats above the hand rather than sitting in
          the status bar: the mode is about the next card you click, and your eye is down on the
          board, hundreds of pixels from the top-left corner. */}
      {pointing && (
        <div className="targeting-hint">
          <span>{pointing.kind === 'block' ? 'Click the attacker to block.' : 'Click the card to target.'}</span>
          <button className="btn btn-ghost" onClick={cancelPointing}>
            Cancel (Esc)
          </button>
        </div>
      )}
      <SelectionBar />
      {/* A toast for each stream, beside the rail it belongs to and only while that rail is shut. */}
      <Toasts log={chatLog} players={tableState.players} myId={playerId} side="chat" enabled={!chatRailOpen} />
      <Toasts log={tableLog} players={tableState.players} myId={playerId} side="log" enabled={!logRailOpen} />

      {confirmingPass && (
        <ConfirmDialog
          title="Pass turn"
          message={PASS_TURN_WARNING}
          confirmLabel="Pass turn"
          onConfirm={() => {
            setConfirmingPass(false);
            passTurn();
          }}
          onCancel={() => setConfirmingPass(false)}
        />
      )}

      {manaChoice && (
        <ManaChoice
          prompt={manaChoice}
          onChoose={(color) => bumpMana(color, 1)}
          onClose={() => setManaChoice(null)}
        />
      )}

      {menu && <ContextMenu obj={menu.obj} x={menu.x} y={menu.y} onClose={() => setMenu(null)} />}
    </div>
  );
}
