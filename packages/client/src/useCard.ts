import { useEffect, useState } from 'react';
import { isRedacted, type Card, type ProjectedObject } from '@command-table/common';
import { fetchCard } from './api.js';

export function useCard(obj: ProjectedObject | undefined): Card | null {
  const [card, setCard] = useState<Card | null>(null);
  const scryfallId = obj && !isRedacted(obj) && 'scryfallId' in obj.source ? obj.source.scryfallId : null;

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

  return card;
}
