import { useEffect, useState } from 'react';
import { isRedacted, type Card, type GameObject, type ProjectedObject } from '@command-table/common';
import { fetchCard } from './api.js';

interface CardTileProps {
  obj: ProjectedObject;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function CardTile({ obj, onClick, onContextMenu }: CardTileProps) {
  const [card, setCard] = useState<Card | null>(null);

  const scryfallId = !isRedacted(obj) && 'scryfallId' in obj.source ? obj.source.scryfallId : null;

  useEffect(() => {
    if (!scryfallId) {
      setCard(null);
      return;
    }
    let cancelled = false;
    fetchCard(scryfallId).then((c) => {
      if (!cancelled) setCard(c);
    });
    return () => {
      cancelled = true;
    };
  }, [scryfallId]);

  const label = isRedacted(obj) ? null : cardLabel(obj, card);

  return (
    <div
      className={`card-tile ${obj.tapped ? 'tapped' : ''} ${isRedacted(obj) ? 'face-down' : ''}`}
      onClick={onClick}
      onContextMenu={onContextMenu}
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
