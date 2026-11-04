// The player's own control strip, sitting with their hand rather than in a global toolbar.
//
// Actions are ranked by how often they're used, not grouped by category: the four you reach for
// every turn get real buttons next to your cards, and the ten you take a few times a game live
// behind one "More ⋯" menu (playerActions.ts). Previously all thirteen sat in one wrapping row at
// equal weight, which made "Pass turn" no easier to find than "Concede".

import { Fragment, useEffect, useRef, useState } from 'react';
import type { Action, PlayerId, PlayerState } from '@command-table/common';
import { useStore } from './store.js';
import { useUiStore, type ManaColor } from './uiStore.js';
import { libraryDirtiedBy, type LibraryLook } from './libraryMoves.js';
import { clearSweepMessage } from './clearSweep.js';
import { useCloseOnEscape } from './useCloseOnEscape.js';
import { NumberDialog } from './NumberDialog.js';
import { CommanderName, type CommanderRef } from './commanders.js';
import { isLethalCommanderDamage, isLethalLife, isLethalPoison, worstDamageTaken } from './vitals.js';
import { TokenDialog } from './TokenDialog.js';
import { ConfirmDialog } from './ConfirmDialog.js';
import { playerActionGroups, type PlayerDialog } from './playerActions.js';

interface ActionBarProps {
  playerId: PlayerId;
  isMyTurn: boolean;
  /** Owned by Table: passing out of turn has a dialog in front of it (see ConfirmDialog). */
  onPassTurn: () => void;
  /** Also owned by Table: untapping everything empties the mana pad with it. */
  onUntapAll: () => void;
  /** Table's too: the rewind is a table-wide thing, not one of your own actions. */
  onUndo: () => void;
  /** False at revision 0, where there is nothing behind the table to go back to. */
  canUndo: boolean;
}

export function ActionBar({ playerId, isMyTurn, onPassTurn, onUntapAll, onUndo, canUndo }: ActionBarProps) {
  const act = useStore((s) => s.act);

  return (
    <div className="action-bar">
      <button className="btn btn-lg" title="Shortcut: D" onClick={() => act({ t: 'DRAW', playerId, count: 1 })}>
        Draw
      </button>
      {/* Out here rather than in the menu: it is the control you reach for the instant you
          notice a mistake, and a mistake is exactly when hunting through a popover is worst. */}
      <button
        className="btn btn-lg"
        title="Take back the last action — instant if it was yours, otherwise the table votes"
        disabled={!canUndo}
        onClick={onUndo}
      >
        Undo
      </button>
      <button className="btn btn-lg" title="Shortcut: U" onClick={onUntapAll}>
        Untap all
      </button>
      <button
        className={`btn btn-lg btn-primary ${isMyTurn ? 'urgent' : ''}`}
        title="Shortcut: P"
        onClick={onPassTurn}
      >
        Pass turn
      </button>
      <MoreMenu playerId={playerId} act={act} />
    </div>
  );
}

/** Every popover down here dismisses the same way; only the two that own one need to know it. */
function useCloseOnOutsideClick(open: boolean, ref: React.RefObject<HTMLElement>, close: () => void) {
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) close();
    }
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
    // `close` is a fresh closure each render; the effect only needs to be re-armed when it opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, ref]);
}

/** The catalog, the dialog it currently has open, and that dialog's JSX, in one place. */
function usePlayerActions(playerId: PlayerId, act: (action: Action) => void) {
  const [dialog, setDialog] = useState<PlayerDialog | null>(null);
  const openZone = useUiStore((s) => s.openZone);
  const setLibraryDirty = useUiStore((s) => s.setLibraryDirty);
  const objects = useStore((s) => s.tableState?.objects);

  // Both of the library looks open it for you; only a search leaves it owing a shuffle, which is
  // paid when the popover closes (libraryDirtiedBy, and Table's dockZones).
  const lookAtLibrary = (look: LibraryLook) => {
    openZone('library');
    if (libraryDirtiedBy(look)) setLibraryDirty(true);
  };

  const groups = playerActionGroups({ playerId, act, openDialog: setDialog, lookAtLibrary });
  const close = () => setDialog(null);

  const dialogs = (
    <>
      {dialog === 'peek' && (
        <NumberDialog
          title="Peek / Scry the top of your library"
          label="How many cards?"
          initialValue={1}
          min={1}
          submitLabel="Look"
          onSubmit={(count) => {
            close();
            act({ t: 'PEEK_TOP', playerId, count });
            lookAtLibrary('peek');
          }}
          onCancel={close}
        />
      )}

      {dialog === 'mill' && (
        <NumberDialog
          title="Mill"
          label="How many cards?"
          initialValue={1}
          min={1}
          submitLabel="Mill"
          onSubmit={(count) => {
            close();
            act({ t: 'MILL', playerId, count });
          }}
          onCancel={close}
        />
      )}

      {dialog === 'dice' && (
        <NumberDialog
          title="Roll dice"
          label="How many sides?"
          initialValue={6}
          min={2}
          submitLabel="Roll"
          onSubmit={(sides) => {
            close();
            act({ t: 'ROLL_DICE', playerId, sides });
          }}
          onCancel={close}
        />
      )}

      {dialog === 'concede' && (
        <ConfirmDialog
          title="Concede"
          message="You will be out of the game. Your cards stay on the table for everyone to see."
          confirmLabel="Concede"
          onConfirm={() => {
            close();
            act({ t: 'CONCEDE', playerId });
          }}
          onCancel={close}
        />
      )}

      {dialog === 'mulligan' && (
        <ConfirmDialog
          title="Mulligan"
          message="Your hand is shuffled back into your library and you draw a new seven, in the middle of the game."
          confirmLabel="Mulligan"
          onConfirm={() => {
            close();
            act({ t: 'MULLIGAN', playerId });
          }}
          onCancel={close}
        />
      )}

      {dialog === 'clear' && (
        <ConfirmDialog
          title="Clear markers & counters"
          message={clearSweepMessage(Object.values(objects ?? {}))}
          confirmLabel="Clear"
          onConfirm={() => {
            close();
            act({ t: 'CLEAR_MARKERS_AND_COUNTERS' });
          }}
          onCancel={close}
        />
      )}

      {dialog === 'token' && (
        <TokenDialog
          onCreate={(draft) => {
            close();
            act({
              t: 'CREATE_TOKEN',
              ownerId: playerId,
              zone: { playerId, zone: 'battlefield' },
              source: { adhoc: draft.adhoc },
              quantity: draft.quantity,
            });
          }}
          onCancel={close}
        />
      )}
    </>
  );

  return { groups, dialogs };
}

function MoreMenu({
  playerId,
  act,
}: {
  playerId: PlayerId;
  act: (action: Action) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { groups, dialogs } = usePlayerActions(playerId, act);

  useCloseOnOutsideClick(open, ref, () => setOpen(false));
  useCloseOnEscape(open, () => setOpen(false));

  // Every item closes the menu; the dialogs some of them open are modal anyway, so closing first
  // keeps the menu from hanging open behind one.
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="more-menu" ref={ref}>
      <button className="btn btn-lg" onClick={() => setOpen((o) => !o)}>
        More ⋯
      </button>
      {open && (
        <div className="more-popover">
          {groups.map((group, i) => (
            <Fragment key={group.title ?? 'tail'}>
              {i > 0 && <hr />}
              {group.title && <p className="popover-group">{group.title}</p>}
              {group.items.map((item) => (
                <button key={item.label} className={item.danger ? 'danger' : ''} onClick={run(item.run)}>
                  {item.label}
                </button>
              ))}
            </Fragment>
          ))}
        </div>
      )}
      {dialogs}
    </div>
  );
}

// §8.3 life and poison, and §12.3 commander damage, for yourself. The readouts in the board
// headers (Board.tsx) are the scoreboard everyone reads; this is the one place you write to your
// own row of it, sat with the hand where your cursor already is rather than out on the plane.
export function VitalsPad({
  player,
  commanders,
  onLifeDelta,
  onPoisonDelta,
  onCommanderDamageDelta,
}: {
  player: PlayerState;
  /** The commanders that can hit you — everyone else's (see Table). */
  commanders: CommanderRef[];
  onLifeDelta: (delta: number) => void;
  onPoisonDelta: (delta: number) => void;
  onCommanderDamageDelta: (fromCommanderObjectId: string, delta: number) => void;
}) {
  const [adjusting, setAdjusting] = useState(false);
  const poison = player.counters.poison ?? 0;

  return (
    <div className="vitals-pad">
      <span className={`vital ${isLethalLife(player.life) ? 'lethal' : ''}`}>
        <b className="vital-symbol">❤</b>
        {/* The number is the button for any jump bigger than one. As a loose "±N…" beside the
            pill it read as a third vital; inside the pill it is plainly life's own control, and
            it is the thing you are already looking at when you need to change it by six. */}
        <button className="vital-count" title="Set your life by any amount" onClick={() => setAdjusting(true)}>
          {player.life}
        </button>
        <button title="Lose 1 life (shortcut: −)" aria-label="Lose 1 life" onClick={() => onLifeDelta(-1)}>
          −
        </button>
        <button title="Gain 1 life (shortcut: +)" aria-label="Gain 1 life" onClick={() => onLifeDelta(1)}>
          +
        </button>
      </span>

      <VitalPill symbol="☠" value={poison} lethal={isLethalPoison(poison)} title="Poison counters" onDelta={onPoisonDelta} />

      <CommanderDamage player={player} commanders={commanders} onDelta={onCommanderDamageDelta} />

      {adjusting && (
        <NumberDialog
          title="Adjust your life"
          label="By how much? (negative to lose life)"
          initialValue={0}
          submitLabel="Apply"
          onSubmit={(amount) => {
            setAdjusting(false);
            if (amount !== 0) onLifeDelta(amount);
          }}
          onCancel={() => setAdjusting(false)}
        />
      )}
    </div>
  );
}

/**
 * Poison and commander damage: the symbol, the number, and −/+. One component because they are
 * the same control twice, and reading alike is the point — the two sit beside life in one strip.
 * Life itself is not one of these: its number is also a button (see VitalsPad).
 */
function VitalPill({
  symbol,
  value,
  lethal,
  title,
  onDelta,
}: {
  symbol: string;
  value: number;
  lethal: boolean;
  title: string;
  onDelta: (delta: number) => void;
}) {
  return (
    <span className={`vital ${lethal ? 'lethal' : ''}`} title={title}>
      <b className="vital-symbol">{symbol}</b>
      <span className="vital-count">{value}</span>
      {/* The server adds the delta as given (applyCounterUpdate), so the floor is held here. */}
      <button disabled={value === 0} aria-label={`${title}: one fewer`} onClick={() => onDelta(-1)}>
        −
      </button>
      <button aria-label={`${title}: one more`} onClick={() => onDelta(1)}>
        +
      </button>
    </span>
  );
}

/**
 * §12.3 commander damage, from the side that takes it.
 *
 * With one opponent there is only ever one commander the damage can be coming from, so asking
 * which is a question with one answer: the pill takes −/+ directly and is the poison pill in
 * every other respect. A bigger table has a real question to ask, and keeps the list — the
 * button then wears your worst single total, so the one number the 21 rule turns on is readable
 * without opening anything.
 *
 * Nothing at all while no other commander is on the table: a pill whose buttons have nowhere to
 * put the damage is worse than no pill.
 */
function CommanderDamage({
  player,
  commanders,
  onDelta,
}: {
  player: PlayerState;
  commanders: CommanderRef[];
  onDelta: (fromCommanderObjectId: string, delta: number) => void;
}) {
  const [sole] = commanders;
  if (!sole) return null;

  if (commanders.length === 1) {
    const damage = player.commanderDamageTaken[sole.id] ?? 0;
    return (
      <VitalPill
        symbol="⚔"
        value={damage}
        lethal={isLethalCommanderDamage(damage)}
        title="Commander damage taken"
        // Each click also moves life (see Table) — commander damage *is* life lost.
        onDelta={(delta) => onDelta(sole.id, delta)}
      />
    );
  }

  return <CommanderDamageMenu player={player} commanders={commanders} onDelta={onDelta} />;
}

function CommanderDamageMenu({
  player,
  commanders,
  onDelta,
}: {
  player: PlayerState;
  commanders: CommanderRef[];
  onDelta: (fromCommanderObjectId: string, delta: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const worst = worstDamageTaken(player);

  useCloseOnOutsideClick(open, ref, () => setOpen(false));
  useCloseOnEscape(open, () => setOpen(false));

  return (
    <div className="damage-menu" ref={ref}>
      <button
        className={`vital ${isLethalCommanderDamage(worst) ? 'lethal' : ''}`}
        title="Commander damage taken"
        onClick={() => setOpen((o) => !o)}
      >
        <b className="vital-symbol">⚔</b>
        <span className="vital-count">{worst}</span>
      </button>

      {open && (
        <div className="more-popover">
          <p className="popover-group">Commander damage taken</p>
          {commanders.map((commander) => {
            const damage = player.commanderDamageTaken[commander.id] ?? 0;
            return (
              <div key={commander.id} className="damage-row">
                <span className="damage-name">
                  <CommanderName commander={commander} />
                </span>
                {/* Each click also moves life (see Table) — commander damage *is* life lost. */}
                <button disabled={damage === 0} aria-label="One less commander damage" onClick={() => onDelta(commander.id, -1)}>
                  −
                </button>
                <span className={`damage-value ${isLethalCommanderDamage(damage) ? 'lethal' : ''}`}>{damage}</span>
                <button aria-label="One more commander damage" onClick={() => onDelta(commander.id, 1)}>
                  +
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const MANA_COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];
/** What the steppers are called aloud: a lone "W" and two unlabelled "−"/"+" said nothing. */
const MANA_NAMES: Record<ManaColor, string> = { W: 'white', U: 'blue', B: 'black', R: 'red', G: 'green', C: 'colourless' };

// §8.4 client-local mana pad: bumped as lands are tapped, spent as spells are cast, reset at
// will. Purely client-side (uiStore) — the server has no concept of mana, per the doc.
export function ManaPad() {
  const manaPad = useUiStore((s) => s.manaPad);
  const bumpMana = useUiStore((s) => s.bumpMana);
  const resetMana = useUiStore((s) => s.resetMana);
  const total = MANA_COLORS.reduce((sum, color) => sum + manaPad[color], 0);

  return (
    <div className="mana-pad">
      {MANA_COLORS.map((color) => (
        <span key={color} className={`mana-pip mana-${color} ${manaPad[color] > 0 ? 'has-mana' : ''}`}>
          <button aria-label={`Remove one ${MANA_NAMES[color]} mana`} onClick={() => bumpMana(color, -1)}>
            −
          </button>
          <b className="mana-symbol" aria-hidden="true">
            {color}
          </b>
          <span className="mana-count" aria-label={`${manaPad[color]} ${MANA_NAMES[color]}`}>
            {manaPad[color]}
          </span>
          <button aria-label={`Add one ${MANA_NAMES[color]} mana`} onClick={() => bumpMana(color, 1)}>
            +
          </button>
        </span>
      ))}
      {/* What you can actually spend, next to the Reset that clears it. Counting six pips in
          your head is the one sum the pad was meant to save you. */}
      <span className={`mana-pip mana-total ${total > 0 ? 'has-mana' : ''}`} title="Total mana in your pool">
        <b className="mana-symbol">Σ</b>
        <span className="mana-count">{total}</span>
      </span>
      <button className="btn btn-ghost" disabled={total === 0} onClick={resetMana}>
        Reset
      </button>
    </div>
  );
}

// §16.2 multi-select: shift-click a battlefield object to toggle it into the selection, then
// apply a bulk action — "tap five lands" or "sacrifice all my tokens" (§16.3) as one gesture.
// Floats over the table instead of living in the layout, so its appearance doesn't shove the
// other controls sideways mid-game.
export function SelectionBar() {
  const selectedIds = useUiStore((s) => s.selectedIds);
  const clearSelection = useUiStore((s) => s.clearSelection);
  const act = useStore((s) => s.act);
  const objects = useStore((s) => s.tableState?.objects ?? {});

  if (selectedIds.size === 0) return null;

  // Clears afterwards like the graveyard button below: the selection was made for this one
  // gesture, and leaving it up means the next shift-click extends a selection you'd forgotten.
  function setTappedAll(tapped: boolean) {
    selectedIds.forEach((id) => act({ t: tapped ? 'TAP' : 'UNTAP', objectId: id }));
    clearSelection();
  }

  // Each object keeps its own controller for the graveyard move, matching the single-object
  // context menu (§10: freeform play has no restriction on whose object an action targets).
  function graveyardAll() {
    selectedIds.forEach((id) => {
      const obj = objects[id];
      if (!obj) return;
      act({ t: 'MOVE_OBJECT', objectId: id, toZone: { playerId: obj.controllerId, zone: 'graveyard' } });
    });
    clearSelection();
  }

  return (
    <div className="selection-bar">
      <span className="selection-count">{selectedIds.size} selected</span>
      <button className="btn" onClick={() => setTappedAll(true)}>
        Tap
      </button>
      <button className="btn" onClick={() => setTappedAll(false)}>
        Untap
      </button>
      <button className="btn" onClick={graveyardAll}>
        To graveyard
      </button>
      <button className="btn btn-ghost" onClick={clearSelection}>
        Clear (Esc)
      </button>
    </div>
  );
}
