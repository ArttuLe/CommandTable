import { useEffect, useMemo, useState } from 'react';
import { isRedacted, type Card, type LogEntry, type ObjectId, type ProjectedObject } from '@command-table/common';
import { fetchCard } from './api.js';
import { faceUp } from './cardFace.js';

/** Which face is up; a redacted object doesn't say, and shows its back anyway. */
function faceOf(obj: ProjectedObject | undefined): number {
  return obj && !isRedacted(obj) ? obj.currentFace : 0;
}

function scryfallIdOf(obj: ProjectedObject | undefined): string | null {
  return (obj && !isRedacted(obj) && 'scryfallId' in obj.source ? obj.source.scryfallId : null) ?? null;
}

export function useCard(obj: ProjectedObject | undefined): Card | null {
  const [card, setCard] = useState<Card | null>(null);
  const scryfallId = scryfallIdOf(obj);

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

  const currentFace = faceOf(obj);
  return useMemo(() => card && faceUp(card, currentFace), [card, currentFace]);
}

/**
 * The same lookup across a whole zone at once.
 *
 * `useCard` is per-object, so it can't be called across a list whose length changes between
 * renders. This resolves every object in a single hook, which is what lets a parent group its
 * cards by type (see `battlefieldZones.ts`) before deciding where to render them. Both hooks go
 * through `fetchCard`'s cache, so asking here costs nothing the tiles weren't already paying.
 */
export function useCards(objects: readonly ProjectedObject[]): Map<ObjectId, Card | null> {
  const [cards, setCards] = useState<Map<ObjectId, Card | null>>(new Map());

  // Keyed on the ids rather than the array itself: the projection is a fresh array on every
  // server revision, and depending on it would refetch the whole battlefield each time.
  const key = objects.map((obj) => `${obj.id}=${scryfallIdOf(obj) ?? ''}@${faceOf(obj)}`).join(',');

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      objects.map(async (obj) => {
        const scryfallId = scryfallIdOf(obj);
        const card = scryfallId ? await fetchCard(scryfallId) : null;
        return [obj.id, card && faceUp(card, faceOf(obj))] as const;
      })
    ).then((entries) => {
      if (!cancelled) setCards(new Map(entries));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` stands in for `objects`.
  }, [key]);

  return cards;
}

/** The name a log line's subject refers to, once resolved (see logText.ts). */
export function useSubjectName(subject: LogEntry['subject']): string | null {
  const scryfallId = subject && 'scryfallId' in subject ? subject.scryfallId : null;
  const [fetched, setFetched] = useState<string | null>(null);
  useEffect(() => {
    if (!scryfallId) return;
    let cancelled = false;
    fetchCard(scryfallId).then((card) => {
      if (!cancelled) setFetched(card?.name ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [scryfallId]);
  if (subject && 'name' in subject) return subject.name;
  return scryfallId ? fetched : null;
}
