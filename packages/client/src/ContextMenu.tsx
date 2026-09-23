// §16.2: "Right-click (or long-press) opens a context menu with every action applicable to
// that object." Freeform play means there's no restriction on *whose* object this can act on
// (§10) — the menu targets the object's controller for zone moves, since that's visible even on
// a redacted (hidden) object, unlike ownerId.

import { useLayoutEffect, useRef, useState } from 'react';
import { blockMarker, isRedacted, parseTargetMarker, targetMarker, type Action, type PlayerState, type ProjectedObject } from '@command-table/common';
import { useStore } from './store.js';
import { ATTACKING_MARKER, blocksOf, isAttacking, isLabelMarker } from './combat.js';
import { useCard } from './useCard.js';
import { useUiStore } from './uiStore.js';
import { isCreature, typeLineOf } from './battlefieldZones.js';
import { placeMenu } from './menuPlacement.js';
import { duplicateAction } from './duplicate.js';
import { Dialog } from './Dialog.js';
import { TextDialog } from './TextDialog.js';
import { LABEL_PRESETS, labelTone } from './labels.js';

interface ContextMenuProps {
  obj: ProjectedObject;
  x: number;
  y: number;
  onClose: () => void;
}

/** The items that ask a question before they act. */
type MenuDialog = 'marker' | 'annotation' | 'controller' | null;

/**
 * The counter with no name. Four zombie tokens are one token tile reading `4`, and that is the
 * common case by a mile — naming a counter put a dialog in front of the first click for a word
 * the badge never showed anyway. Anything that does need a word of its own is a label
 * (see labels.ts).
 */
const GENERIC_COUNTER = 'counter';

export function ContextMenu({ obj, x, y, onClose }: ContextMenuProps) {
  const act = useStore((s) => s.act);
  const players = useStore((s) => s.tableState?.players ?? []);
  // `obj` is the snapshot taken when the menu opened. The counter and label rows stay on screen
  // while you use them, so those two read from the live object instead; it falls back to the
  // snapshot for an object that has since left the table.
  const live = useStore((s) => s.tableState?.objects[obj.id]) ?? obj;
  const startPointing = useUiStore((s) => s.startPointing);
  const card = useCard(obj);
  const attacking = isAttacking(obj);
  const blocks = blocksOf(live);
  const targets = live.markers.map(parseTargetMarker).filter((id) => id !== null);
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
    return (
      <MenuDialogs
        which={dialog}
        obj={obj}
        players={players}
        act={act}
        onDone={onClose}
      />
    );
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
        {/* Blocking needs to say *which* attacker, unlike attacking, so it points at one — the
            same click-the-card gesture as targeting below, rather than a list of the declared
            attackers. The arrows are drawn from what it writes (see combat.ts, ArrowLayer.tsx). */}
        {isCreature(typeLineOf(obj, card)) && (
          <>
            {blocks.length > 0 && (
              <button
                onClick={() =>
                  run(() => {
                    for (const attackerId of blocks) {
                      act({ t: 'CLEAR_MARKER', objectId: obj.id, marker: blockMarker(attackerId) });
                    }
                  })
                }
              >
                Stop blocking
              </button>
            )}
            <button onClick={() => run(() => startPointing(obj.id, 'block'))}>Blocking…</button>
          </>
        )}
        {/* Not creature-only: the thing doing the targeting is usually a spell on the stack. */}
        {targets.length > 0 ? (
          <button
            onClick={() =>
              run(() => {
                for (const targetId of targets) {
                  act({ t: 'CLEAR_MARKER', objectId: obj.id, marker: targetMarker(targetId) });
                }
              })
            }
          >
            Clear target
          </button>
        ) : (
          <button onClick={() => run(() => startPointing(obj.id, 'target'))}>Target…</button>
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
        {/* Three steppers, always there, none of them behind a dialog: the two counters that come
            up every turn, and the nameless one that counts whatever this card is standing in for.
            The server drops a counter that reaches zero, so "−" on the last one clears the badge. */}
        <CounterStepper counterKey="+1/+1" obj={obj} act={act} />
        <CounterStepper counterKey="-1/-1" obj={obj} act={act} />
        <CounterStepper counterKey={GENERIC_COUNTER} label="Counter" obj={obj} act={act} />
        {/* Anything else the object is still carrying — a named counter from before there was a
            nameless one — so it can still be taken off where it is read. */}
        {Object.keys(live.counters)
          .filter((key) => key !== '+1/+1' && key !== '-1/-1' && key !== GENERIC_COUNTER)
          .map((key) => (
            <CounterStepper key={key} counterKey={key} obj={obj} act={act} />
          ))}

        {live.markers.filter(isLabelMarker).map((marker) => (
          <button key={marker} onClick={() => run(() => act({ t: 'CLEAR_MARKER', objectId: obj.id, marker }))}>
            Remove label &apos;{marker}&apos;
          </button>
        ))}
        <button onClick={() => setDialog('marker')}>Add label…</button>

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
 * The label picker. A label is on or off, so there is no "how many" to ask — and the pills are
 * drawn in the colour they will have on the card, so the list doubles as the legend for what you
 * are about to see (see labels.ts).
 */
function PickLabel({ onSubmit, onCancel }: { onSubmit: (marker: string) => void; onCancel: () => void }) {
  const [custom, setCustom] = useState(false);

  if (custom) {
    return (
      <TextDialog
        title="Add label"
        label="Label"
        placeholder="anything the table agrees on"
        submitLabel="Add"
        onSubmit={onSubmit}
        onCancel={onCancel}
      />
    );
  }

  return (
    <Dialog title="Add label" onCancel={onCancel}>
      <div className="dialog-choices label-choices">
        {LABEL_PRESETS.map((preset) => (
          <button key={preset} className={`label-pill label-${labelTone(preset)}`} onClick={() => onSubmit(preset)}>
            {preset}
          </button>
        ))}
      </div>
      <div className="dialog-actions">
        <button type="button" className="btn btn-ghost" onClick={() => setCustom(true)}>
          Custom…
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Dialog>
  );
}

/**
 * One counter type, with the count and a way to change it in both directions.
 *
 * A row rather than two menu items, because the menu is already long and "+1/+1" and "remove a
 * +1/+1" as separate lines read as two unrelated things rather than one dial.
 */
function CounterStepper({
  counterKey,
  label = counterKey,
  obj,
  act,
}: {
  counterKey: string;
  /** What the row reads, when the key itself isn't it — the nameless counter says "Counter". */
  label?: string;
  obj: ProjectedObject;
  act: (action: Action) => void;
}) {
  // Read live rather than off `obj`, which is the snapshot taken when the menu opened: the menu
  // deliberately stays up while you click, so the count has to keep up with the clicking.
  const value = useStore((s) => s.tableState?.objects[obj.id]?.counters[counterKey] ?? 0);
  const bump = (amount: number) =>
    act({ t: 'SET_COUNTER', objectId: obj.id, key: counterKey, update: { mode: 'delta', amount } });

  return (
    <div className="menu-stepper">
      <span className="menu-stepper-label">{label}</span>
      {/* Nothing to take away at zero — and the server would ignore it anyway. */}
      <button onClick={() => bump(-1)} disabled={value === 0} title={`Remove a ${label} counter`}>
        −
      </button>
      <span className="menu-stepper-value">{value}</span>
      <button onClick={() => bump(1)} title={`Add a ${label} counter`}>
        +
      </button>
    </div>
  );
}

/**
 * The items that ask something first. Each one used to be a window.prompt — browser-styled and
 * outside the table's own keyboard handling.
 *
 * Rendered *instead of* the menu rather than beside it: the menu's backdrop would otherwise sit
 * between the dialog and the table, and one click would close both.
 *
 * `onDone` puts the menu away, which is what all of these want — you moved the object, or named
 * its new controller, and there is nothing left to say.
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
    case 'marker':
      return (
        <PickLabel
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
