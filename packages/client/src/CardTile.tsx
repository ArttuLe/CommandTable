import { isRedacted, type Card, type GameObject, type ProjectedObject } from '@command-table/common';
import { useCard } from './useCard.js';
import { counterBadgeText, counterKind } from './counters.js';
import { useUiStore } from './uiStore.js';
import { ATTACKING_MARKER, isAttacking } from './combat.js';

interface CardTileProps {
  obj: ProjectedObject;
  selected?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function CardTile({ obj, selected, onClick, onContextMenu }: CardTileProps) {
  const card = useCard(obj);
  const setHoveredCard = useUiStore((s) => s.setHoveredCard);

  const label = isRedacted(obj) ? null : cardLabel(obj, card);
  // Two ways to be looking at a back: the projection withheld the card from you (§9.2), or the
  // card is face down and you happen to be the one allowed to see it anyway. The second used to
  // render its art as normal, which made TURN_FACE_DOWN look like it had done nothing.
  const showsBack = isRedacted(obj) || obj.faceDown;

  return (
    <div
      className={`card-tile ${obj.tapped ? 'tapped' : ''} ${showsBack ? 'face-down' : ''} ${selected ? 'selected' : ''} ${isAttacking(obj) ? 'attacking' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      // Hover-zoom is left alone: if the projection let you have the card, you are allowed to
      // remind yourself what your own morph is without turning it over for everyone.
      onMouseEnter={() => card && setHoveredCard(card)}
      onMouseLeave={() => setHoveredCard(null)}
      title={label ?? undefined}
    >
      {!showsBack && card?.imageUris ? (
        <img src={card.imageUris.normal} alt={card.name} />
      ) : (
        <div className="card-tile-fallback">{showsBack ? '' : (label ?? '?')}</div>
      )}
      {/* One strip rather than a badge per corner: counters used to be stacked on top of each
          other, so a creature with both a +1/+1 and a stun counter only ever showed one. */}
      {Object.keys(obj.counters).length > 0 && (
        <div className="card-badges">
          {Object.entries(obj.counters).map(([key, value]) => (
            <span key={key} className={`counter-badge counter-${counterKind(key)}`} title={`${key}: ${value}`}>
              {counterBadgeText(key, value)}
            </span>
          ))}
        </div>
      )}
      {/* The attacking marker is the red border, not a badge — see combat.ts. */}
      {obj.markers.filter((marker) => marker !== ATTACKING_MARKER).map((marker) => (
        <span key={marker} className="marker-badge">
          {marker}
        </span>
      ))}
    </div>
  );
}

function cardLabel(obj: GameObject, card: Card | null): string {
  if (card) return card.name;
  if (obj.source.kind === 'token' && obj.source.adhoc) return obj.source.adhoc.name;
  return 'Loading…';
}
