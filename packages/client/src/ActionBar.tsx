// The player's own control strip, sitting with their hand rather than in a global toolbar.
//
// Actions are split by how often they're used, not by category: the three you take every turn get
// real buttons next to your cards, and the ten you take a few times a game live behind one
// overflow menu. Previously all thirteen sat in one wrapping row at equal weight, which made
// "Pass turn" no easier to find than "Concede".

import { useEffect, useRef, useState } from 'react';
import type { Action, PlayerId, PlayerState } from '@command-table/common';
import { useStore } from './store.js';
import { useUiStore, type ManaColor } from './uiStore.js';
import { libraryDirtiedBy, type LibraryLook } from './libraryMoves.js';
import { NumberDialog } from './NumberDialog.js';
import { CommanderName, type CommanderRef } from './commanders.js';
import { isLethalCommanderDamage, isLethalLife, isLethalPoison, worstDamageTaken } from './vitals.js';
import { TokenDialog } from './TokenDialog.js';

interface ActionBarProps {
  playerId: PlayerId;
  players: PlayerState[];
  isMyTurn: boolean;
  /** Owned by Table: passing out of turn has a dialog in front of it (see ConfirmDialog). */
  onPassTurn: () => void;
}

export function ActionBar({ playerId, players, isMyTurn, onPassTurn }: ActionBarProps) {
  const act = useStore((s) => s.act);

  return (
    <div className="action-bar">
      <button className="btn btn-lg" title="Shortcut: D" onClick={() => act({ t: 'DRAW', playerId, count: 1 })}>
        Draw
      </button>
      <button className="btn btn-lg" title="Shortcut: U" onClick={() => act({ t: 'UNTAP_ALL', playerId })}>
        Untap all
      </button>
      <button
        className={`btn btn-lg btn-primary ${isMyTurn ? 'urgent' : ''}`}
        title="Shortcut: P"
        onClick={onPassTurn}
      >
        Pass turn
      </button>
      <MoreMenu playerId={playerId} players={players} act={act} />
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

function MoreMenu({
  playerId,
  players,
  act,
}: {
  playerId: PlayerId;
  players: PlayerState[];
  act: (action: Action) => void;
}) {
  const [open, setOpen] = useState(false);
  // Which of this menu's dialogs is up, if any. The menu itself closes as one opens.
  const [dialog, setDialog] = useState<'peek' | 'token' | 'dice' | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const openZone = useUiStore((s) => s.openZone);
  const setLibraryDirty = useUiStore((s) => s.setLibraryDirty);

  // Both of these open the library for you; only a search leaves it owing a shuffle, which is
  // paid when the popover closes (libraryDirtiedBy, and Table's dockZones).
  const lookAtLibrary = (look: LibraryLook) => {
    openZone('library');
    if (libraryDirtiedBy(look)) setLibraryDirty(true);
  };

  useCloseOnOutsideClick(open, ref, () => setOpen(false));

  // Every item closes the menu; the prompts these open are blocking anyway, so closing first
  // keeps the menu from hanging open behind a native dialog.
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
          <p className="popover-group">Library</p>
          <button onClick={run(() => act({ t: 'SHUFFLE_LIBRARY', playerId }))}>Shuffle</button>
          {/* Both of these only flip card visibility server-side, which is invisible until you
              go and open the library yourself. Opening it for you is the feedback — and it is
              where the follow-up (to hand, to bottom, …) happens anyway. */}
          <button
            onClick={run(() => {
              act({ t: 'SEARCH_LIBRARY', playerId });
              lookAtLibrary('search');
            })}
          >
            Search library
          </button>
          <button onClick={run(() => setDialog('peek'))}>Peek top…</button>
          <button onClick={run(() => act({ t: 'MULLIGAN', playerId }))}>Mulligan</button>

          <hr />
          <p className="popover-group">Table</p>
          <button
            onClick={run(() => {
              const amount = Number(window.prompt("Adjust ALL players' life by how much?", '0'));
              if (Number.isFinite(amount) && amount !== 0) {
                act({ t: 'SET_LIFE', playerIds: players.map((p) => p.id), update: { mode: 'delta', amount } });
              }
            })}
          >
            Adjust all life…
          </button>
          <button onClick={run(() => act({ t: 'CLEAR_ALL_MARKERS' }))}>Clear all markers</button>
          <button onClick={run(() => setDialog('token'))}>Create token…</button>

          <hr />
          <p className="popover-group">Random</p>
          <button onClick={run(() => setDialog('dice'))}>Roll dice…</button>
          <button onClick={run(() => act({ t: 'FLIP_COIN', playerId }))}>Flip coin</button>

          <hr />
          <button
            className="danger"
            onClick={run(() => {
              if (window.confirm('Concede the game?')) act({ t: 'CONCEDE', playerId });
            })}
          >
            Concede
          </button>
        </div>
      )}

      {dialog === 'peek' && (
        <NumberDialog
          title="Peek at the top of your library"
          label="How many cards?"
          initialValue={1}
          min={1}
          submitLabel="Peek"
          onSubmit={(count) => {
            setDialog(null);
            act({ t: 'PEEK_TOP', playerId, count });
            lookAtLibrary('peek');
          }}
          onCancel={() => setDialog(null)}
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
            setDialog(null);
            act({ t: 'ROLL_DICE', playerId, sides });
          }}
          onCancel={() => setDialog(null)}
        />
      )}

      {dialog === 'token' && (
        <TokenDialog
          onCreate={(draft) => {
            setDialog(null);
            act({
              t: 'CREATE_TOKEN',
              ownerId: playerId,
              zone: { playerId, zone: 'battlefield' },
              source: { adhoc: draft.adhoc },
              quantity: draft.quantity,
            });
          }}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  );
}

// §8.3 life and poison, and §12.3 commander damage, for yourself. The crossroads readouts
// (CrossroadsHub) are the scoreboard everyone reads; this is the one place you write to your own
// row of it, sat with the hand where your cursor already is rather than out on the plane.
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
        <button title="Shortcut: −" onClick={() => onLifeDelta(-1)}>
          −
        </button>
        <button title="Shortcut: +" onClick={() => onLifeDelta(1)}>
          +
        </button>
      </span>

      <span className={`vital ${isLethalPoison(poison) ? 'lethal' : ''}`}>
        <b className="vital-symbol">☠</b>
        <span className="vital-count">{poison}</span>
        {/* The server adds the delta as given (applyCounterUpdate), so the floor is held here. */}
        <button disabled={poison === 0} onClick={() => onPoisonDelta(-1)}>
          −
        </button>
        <button onClick={() => onPoisonDelta(1)}>
          +
        </button>
      </span>

      <CommanderDamageMenu player={player} commanders={commanders} onDelta={onCommanderDamageDelta} />

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
 * §12.3 commander damage, from the side that takes it. Behind a button rather than out in the
 * pad because it is consulted a few times a game where life is consulted constantly — and a
 * four-player table would otherwise park three permanent rows of zeroes in the strip.
 *
 * The button wears your worst single total, so the one number the 21 rule turns on is readable
 * without opening anything.
 */
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
          {commanders.length === 0 ? (
            <p className="popover-note">No other commanders on the table.</p>
          ) : (
            commanders.map((commander) => {
              const damage = player.commanderDamageTaken[commander.id] ?? 0;
              return (
                <div key={commander.id} className="damage-row">
                  <span className="damage-name">
                    <CommanderName commander={commander} />
                  </span>
                  {/* Each click also moves life (see Table) — commander damage *is* life lost. */}
                  <button disabled={damage === 0} onClick={() => onDelta(commander.id, -1)}>
                    −
                  </button>
                  <span className={`damage-value ${isLethalCommanderDamage(damage) ? 'lethal' : ''}`}>{damage}</span>
                  <button onClick={() => onDelta(commander.id, 1)}>+</button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

const MANA_COLORS: ManaColor[] = ['W', 'U', 'B', 'R', 'G', 'C'];

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
          <button onClick={() => bumpMana(color, -1)}>−</button>
          <b className="mana-symbol">{color}</b>
          <span className="mana-count">{manaPad[color]}</span>
          <button onClick={() => bumpMana(color, 1)}>+</button>
        </span>
      ))}
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
