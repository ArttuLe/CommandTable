// §16.2: "Right-click (or long-press) opens a context menu with every action applicable to
// that object." Freeform play means there's no restriction on *whose* object this can act on
// (§10) — the menu targets the object's controller for zone moves, since that's visible even on
// a redacted (hidden) object, unlike ownerId.

import { isRedacted, type ProjectedObject } from '@command-table/common';
import { useStore } from './store.js';

interface ContextMenuProps {
  obj: ProjectedObject;
  x: number;
  y: number;
  onClose: () => void;
}

export function ContextMenu({ obj, x, y, onClose }: ContextMenuProps) {
  const act = useStore((s) => s.act);
  const players = useStore((s) => s.tableState?.players ?? []);

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
      <div className="context-menu" style={{ left: x, top: y }}>
        <button onClick={() => run(() => act({ t: obj.tapped ? 'UNTAP' : 'TAP', objectId: obj.id }))}>
          {obj.tapped ? 'Untap' : 'Tap'}
        </button>
        <button onClick={() => run(() => act({ t: 'TRANSFORM', objectId: obj.id }))}>Transform</button>
        <button onClick={() => run(() => act({ t: 'TURN_FACE_DOWN', objectId: obj.id }))}>Turn face down</button>
        <button onClick={() => run(() => act({ t: 'TURN_FACE_UP', objectId: obj.id }))}>Turn face up</button>

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

        {obj.markers.map((marker) => (
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

        {!isRedacted(obj) && (obj.source.kind === 'token' || obj.source.kind === 'copy') && (
          <button onClick={() => run(() => act({ t: 'DELETE_OBJECT', objectId: obj.id }))}>Delete</button>
        )}
      </div>
    </>
  );
}
