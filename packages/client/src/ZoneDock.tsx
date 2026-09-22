// Graveyard / exile / library, next to your hand.
//
// These used to be three lines of static text, so the only way into your own graveyard was to
// right-click a card already sitting in it — which you couldn't see. Each is now a button that
// opens its contents as a card grid, right-clickable like anything else on the table.
//
// The library additionally gets per-card move buttons: a card revealed by a search or a peek
// needs somewhere to go, and "bottom of the library" is not something the generic right-click
// zone list can express.

import { isRedacted, type GameObject, type ProjectedObject } from '@command-table/common';
import { CardTile } from './CardTile.js';
import { useUiStore } from './uiStore.js';
import { LIBRARY_MOVES, type LibraryMove } from './libraryMoves.js';

export interface DockZone {
  key: string;
  label: string;
  count: number;
  objects: ProjectedObject[];
  /** Shown above the grid when the zone can't show everything it holds. */
  note?: string;
  /** Set on the library only: what to offer under each revealed card. */
  onMove?: (move: LibraryMove, obj: GameObject) => void;
  /** Fired however the popover is dismissed — the library shuffles itself here after a search. */
  onClose?: () => void;
}

export function ZoneDock({
  zones,
  onObjectContextMenu,
}: {
  zones: DockZone[];
  onObjectContextMenu: (obj: ProjectedObject) => (e: React.MouseEvent) => void;
}) {
  const openKey = useUiStore((s) => s.openZoneKey);
  const toggleZone = useUiStore((s) => s.toggleZone);
  const closeZone = useUiStore((s) => s.closeZone);
  const open = zones.find((z) => z.key === openKey);

  // Every way out of a popover — backdrop, ×, or clicking another zone's tile — goes through
  // here, since `onClose` is what settles the library's post-search shuffle.
  const close = () => {
    open?.onClose?.();
    closeZone();
  };

  return (
    <div className="zone-dock">
      {zones.map((zone) => (
        <button
          key={zone.key}
          className={`zone-tile ${openKey === zone.key ? 'open' : ''}`}
          disabled={zone.objects.length === 0}
          title={zone.objects.length === 0 ? `${zone.label} — nothing to show` : `Open ${zone.label.toLowerCase()}`}
          onClick={() => {
            if (open) open.onClose?.();
            toggleZone(zone.key);
          }}
        >
          <span className="zone-count">{zone.count}</span>
          <span className="zone-label">{zone.label}</span>
        </button>
      ))}

      {open && (
        <>
          <div className="popover-backdrop" onClick={close} />
          <div className="zone-popover">
            <div className="popover-header">
              <span>
                {open.label} ({open.count})
              </span>
              <button className="icon-button" onClick={close}>
                ×
              </button>
            </div>
            {open.note && <p className="popover-note">{open.note}</p>}
            <div className="zone-grid">
              {open.objects
                .filter((o): o is GameObject => !isRedacted(o))
                .sort((a, b) => a.position - b.position)
                .map((obj) => (
                  <div key={obj.id} className="zone-entry">
                    <CardTile obj={obj} onContextMenu={onObjectContextMenu(obj)} />
                    {open.onMove && (
                      <div className="zone-moves">
                        {LIBRARY_MOVES.map(({ move, label }) => (
                          <button key={move} onClick={() => open.onMove?.(move, obj)}>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
