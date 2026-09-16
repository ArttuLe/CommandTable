import { isRedacted, type Card, type GameObject, type ProjectedObject } from '@command-table/common';
import { useCard } from './useCard.js';
import { useUiStore } from './uiStore.js';

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

  return (
    <div
      className={`card-tile ${obj.tapped ? 'tapped' : ''} ${isRedacted(obj) ? 'face-down' : ''} ${selected ? 'selected' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
      onMouseEnter={() => card && setHoveredCard(card)}
      onMouseLeave={() => setHoveredCard(null)}
      title={label ?? undefined}
    >
      {!isRedacted(obj) && card?.imageUris ? (
        <img src={card.imageUris.normal} alt={card.name} />
      ) : (
        <div className="card-tile-fallback">{label ?? '?'}</div>
      )}
      {Object.entries(obj.counters).map(([key, value]) => (
        <span key={key} className="counter-badge">
          {key}: {value}
        </span>
      ))}
      {obj.markers.map((marker) => (
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
