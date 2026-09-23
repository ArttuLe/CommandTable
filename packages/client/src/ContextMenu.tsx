// §16.2: "Right-click (or long-press) opens a context menu with every action applicable to
// that object." Freeform play means there's no restriction on *whose* object this can act on
// (§10) — the menu targets the object's controller for zone moves, since that's visible even on
// a redacted (hidden) object, unlike ownerId.

import { useLayoutEffect, useRef, useState } from 'react';
import { isRedacted, type Action, type PlayerState, type ProjectedObject } from '@command-table/common';
import { useStore } from './store.js';
import { useCard } from './useCard.js';
import { isCreature, typeLineOf } from './battlefieldZones.js';
import { ATTACKING_MARKER, isAttacking } from './combat.js';
import { placeMenu } from './menuPlacement.js';
import { duplicateAction } from './duplicate.js';
import { Dialog } from './Dialog.js';
import { TextDialog } from './TextDialog.js';
import { CounterDialog } from './CounterDialog.js';

interface ContextMenuProps {
  obj: ProjectedObject;
  x: number;
  y: number;
  onClose: () => void;
}

/** The four items that ask a question before they act. */
type MenuDialog = 'counter' | 'marker' | 'annotation' | 'controller' | null;

export function ContextMenu({ obj, x, y, onClose }: ContextMenuProps) {
  const act = useStore((s) => s.act);
  const players = useStore((s) => s.tableState?.players ?? []);
  const card = useCard(obj);
  const attacking = isAttacking(obj);
  const duplicate = isRedacted(obj) ? null : duplicateAction(obj, obj.ownerId);

  // Measure, then place: the menu's height depends on which items this object gets, so there's
  // nothing to flip against until it has rendered once. Hidden for that first frame rather than
  // drawn at the cursor and yanked (see placeMenu).
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  // Which of this menu's dialogs is up, if any. The menu hides itself while one is open but
  // stays mounted — unmounting it (via onClose) would take the dialog down with it.
  const [dialog, setDialog] = useState<MenuDialog>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos(placeMenu({ x, y }, { width, height }, { width: window.innerWidth, height: window.innerHeight }));
  }, [x, y, card, attacking, Boolean(duplicate)]);

  function run(fn: () => void) {
    fn();
    onClose();
  }

  const toZone = (zone: 'hand' | 'graveyard' | 'exile' | 'library' | 'battlefield' | 'commandZone') => ({
    playerId: obj.controllerId,
    zone,
  });

  if (dialog) {
    return <MenuDialogs which={dialog} obj={obj} players={players} act={act} onDone={onClose} />;
  }

  return (
    <>
      <div className="context-menu-backdrop" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        ref={ref}
        className="context-menu"
        style={{ left: pos?.left ?? x, top: pos?.top ?? y, visibility: pos ? 'visible' : 'hidden' }}
      >
        <button onClick={() => run(() => act({ t: obj.tapped ? 'UNTAP' : 'TAP', objectId: obj.id }))}>
          {obj.tapped ? 'Untap' : 'Tap'}
        </button>
        {/* Attacking is the one marker the whole table reads at a glance, so it gets its own
            toggle and a red border on the tile instead of living behind "Add marker…". Only
            creatures can attack, so only creatures are offered it. */}
        {isCreature(typeLineOf(obj, card)) && (
          <button
            onClick={() =>
              run(() =>
                act(
                  attacking
                    ? { t: 'CLEAR_MARKER', objectId: obj.id, marker: ATTACKING_MARKER }
                    : { t: 'SET_MARKER', objectId: obj.id, marker: ATTACKING_MARKER }
                )
              )
            }
          >
            {attacking ? 'Not attacking' : 'Attacking'}
          </button>
        )}
        <button onClick={() => run(() => act({ t: 'TRANSFORM', objectId: obj.id }))}>Transform</button>
        {/* One toggle where the object tells us which way it is facing. A redacted object doesn't
            carry `faceDown` (§9.2 omits it), so there both directions stay on offer. */}
        {isRedacted(obj) ? (
          <>
            <button onClick={() => run(() => act({ t: 'TURN_FACE_DOWN', objectId: obj.id }))}>Turn face down</button>
            <button onClick={() => run(() => act({ t: 'TURN_FACE_UP', objectId: obj.id }))}>Turn face up</button>
          </>
        ) : (
          <button onClick={() => run(() => act({ t: obj.faceDown ? 'TURN_FACE_UP' : 'TURN_FACE_DOWN', objectId: obj.id }))}>
            {obj.faceDown ? 'Turn face up' : 'Turn face down'}
          </button>
        )}

        <hr />
        <button onClick={() => run(() => act({ t: 'MOVE_OBJECT', objectId: obj.id, toZone: toZone('hand') }))}>Move to hand</button>
        <button onClick={() => run(() => act({ t: 'MOVE_OBJECT', objectId: obj.id, toZone: toZone('graveyard') }))}>Move to graveyard</button>
        <button onClick={() => run(() => act({ t: 'MOVE_OBJECT', objectId: obj.id, toZone: toZone('exile') }))}>Move to exile</button>
        <button onClick={() => run(() => act({ t: 'MOVE_OBJECT', objectId: obj.id, toZone: toZone('battlefield') }))}>Move to battlefield</button>
        <button onClick={() => run(() => act({ t: 'MOVE_OBJECT', objectId: obj.id, toZone: toZone('commandZone') }))}>Move to command zone</button>
        <button onClick={() => run(() => act({ t: 'MOVE_OBJECT', objectId: obj.id, toZone: toZone('library'), toPosition: 0 }))}>
          Move to top of library
        </button>

        <hr />
        {/* One-click buttons for the two counter types that come up on nearly every turn — the
            generic "Add counter…" below still covers everything else (loyalty, stun, etc.) and
            adding more than one at a time. */}
        <button onClick={() => run(() => act({ t: 'SET_COUNTER', objectId: obj.id, key: '+1/+1', update: { mode: 'delta', amount: 1 } }))}>
          +1/+1 counter
        </button>
        <button onClick={() => run(() => act({ t: 'SET_COUNTER', objectId: obj.id, key: '-1/-1', update: { mode: 'delta', amount: 1 } }))}>
          -1/-1 counter
        </button>
        <button onClick={() => setDialog('counter')}>Add counter…</button>

        {obj.markers.filter((marker) => marker !== ATTACKING_MARKER).map((marker) => (
          <button key={marker} onClick={() => run(() => act({ t: 'CLEAR_MARKER', objectId: obj.id, marker }))}>
            Remove marker &apos;{marker}&apos;
          </button>
        ))}
        <button onClick={() => setDialog('marker')}>Add marker…</button>

        {!isRedacted(obj) && <button onClick={() => setDialog('annotation')}>Set annotation…</button>}

        <button onClick={() => setDialog('controller')}>Change controller…</button>

        {/* §16.3's "create N copies of a token", minus the five prompts. */}
        {duplicate && <button onClick={() => run(() => act(duplicate))}>Duplicate</button>}

        {!isRedacted(obj) && (obj.source.kind === 'token' || obj.source.kind === 'copy') && (
          <button onClick={() => run(() => act({ t: 'DELETE_OBJECT', objectId: obj.id }))}>Delete</button>
        )}
      </div>
    </>
  );
}

/**
 * The four items that ask something first. Each one used to be a window.prompt — browser-styled,
 * outside the table's own keyboard handling, and in the counter's case two of them in a row where
 * cancelling the second threw the first away.
 *
 * Rendered *instead of* the menu rather than beside it: the menu's backdrop would otherwise sit
 * between the dialog and the table, and one click would close both.
 */
function MenuDialogs({
  which,
  obj,
  players,
  act,
  onDone,
}: {
  which: Exclude<MenuDialog, null>;
  obj: ProjectedObject;
  players: PlayerState[];
  act: (action: Action) => void;
  onDone: () => void;
}) {
  const submit = (action: Action) => {
    act(action);
    onDone();
  };

  switch (which) {
    case 'counter':
      return (
        <CounterDialog
          onSubmit={(key, amount) => submit({ t: 'SET_COUNTER', objectId: obj.id, key, update: { mode: 'delta', amount } })}
          onCancel={onDone}
        />
      );

    case 'marker':
      return (
        <TextDialog
          title="Add marker"
          label="Marker"
          placeholder="blocking, goaded, monarch…"
          submitLabel="Add"
          onSubmit={(marker) => submit({ t: 'SET_MARKER', objectId: obj.id, marker })}
          onCancel={onDone}
        />
      );

    case 'annotation':
      return (
        <TextDialog
          title="Set annotation"
          label="Annotation"
          initialValue={(!isRedacted(obj) && obj.annotation) || ''}
          placeholder="A note everyone can read"
          // Submitting an empty field is how an annotation is cleared, so it isn't "no answer".
          allowEmpty
          submitLabel="Save"
          onSubmit={(annotation) => submit({ t: 'SET_ANNOTATION', objectId: obj.id, annotation: annotation || null })}
          onCancel={onDone}
        />
      );

    case 'controller':
      // A list, not a typed name: the old prompt compared what you typed against every display
      // name and silently did nothing when it didn't match.
      return (
        <Dialog title="Change controller" onCancel={onDone}>
          <div className="dialog-choices">
            {players.map((player) => (
              <button
                key={player.id}
                className={`btn ${player.id === obj.controllerId ? 'btn-primary' : ''}`}
                onClick={() => submit({ t: 'CHANGE_CONTROLLER', objectId: obj.id, newControllerId: player.id })}
              >
                {player.displayName}
                {player.id === obj.controllerId && ' (controls it now)'}
              </button>
            ))}
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onDone}>
              Cancel
            </button>
          </div>
        </Dialog>
      );
  }
}
