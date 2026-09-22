// §16.2: "Right-click (or long-press) opens a context menu with every action applicable to
// that object." Freeform play means there's no restriction on *whose* object this can act on
// (§10) — the menu targets the object's controller for zone moves, since that's visible even on
// a redacted (hidden) object, unlike ownerId.

import { useLayoutEffect, useRef, useState } from 'react';
import { isRedacted, type ProjectedObject } from '@command-table/common';
import { useStore } from './store.js';
import { useCard } from './useCard.js';
import { isCreature, typeLineOf } from './battlefieldZones.js';
import { ATTACKING_MARKER, isAttacking } from './combat.js';
import { placeMenu } from './menuPlacement.js';
import { duplicateAction } from './duplicate.js';

interface ContextMenuProps {
  obj: ProjectedObject;
  x: number;
  y: number;
  onClose: () => void;
}

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
        <button
          onClick={() => {
            const key = window.prompt('Counter type (e.g. +1/+1, stun, loyalty):');
            if (!key) return;
            const amountText = window.prompt('Amount to add (negative to remove):', '1');
            const amount = Number(amountText);
            if (!Number.isFinite(amount)) return;
            run(() => act({ t: 'SET_COUNTER', objectId: obj.id, key, update: { mode: 'delta', amount } }));
          }}
        >
          Add counter…
        </button>

        {obj.markers.filter((marker) => marker !== ATTACKING_MARKER).map((marker) => (
          <button key={marker} onClick={() => run(() => act({ t: 'CLEAR_MARKER', objectId: obj.id, marker }))}>
            Remove marker &apos;{marker}&apos;
          </button>
        ))}
        <button
          onClick={() => {
            const marker = window.prompt('Marker to add (e.g. attacking, blocking, goaded):');
            if (!marker) return;
            run(() => act({ t: 'SET_MARKER', objectId: obj.id, marker }));
          }}
        >
          Add marker…
        </button>

        {!isRedacted(obj) && (
          <button
            onClick={() => {
              const annotation = window.prompt('Annotation:', obj.annotation ?? '');
              if (annotation === null) return;
              run(() => act({ t: 'SET_ANNOTATION', objectId: obj.id, annotation: annotation || null }));
            }}
          >
            Set annotation…
          </button>
        )}

        <button
          onClick={() => {
            const name = window.prompt(`Change control to (${players.map((p) => p.displayName).join(', ')}):`);
            const target = players.find((p) => p.displayName.toLowerCase() === name?.toLowerCase());
            if (!target) return;
            run(() => act({ t: 'CHANGE_CONTROLLER', objectId: obj.id, newControllerId: target.id }));
          }}
        >
          Change controller…
        </button>

        {/* §16.3's "create N copies of a token", minus the five prompts. */}
        {duplicate && <button onClick={() => run(() => act(duplicate))}>Duplicate</button>}

        {!isRedacted(obj) && (obj.source.kind === 'token' || obj.source.kind === 'copy') && (
          <button onClick={() => run(() => act({ t: 'DELETE_OBJECT', objectId: obj.id }))}>Delete</button>
        )}
      </div>
    </>
  );
}
