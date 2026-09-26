// A commander as the UI needs it: an id to key damage by, an owner, and the object its card
// data hangs off. Lives on its own because three unrelated places name a commander — the
// boards' damage badges, the HUD's damage pill, and the status bar's "it's in your
// graveyard" prompt — and none of them should have to import from one of the others.

import type { ObjectId, PlayerId, ProjectedObject } from '@command-table/common';
import { useCard } from './useCard.js';

export interface CommanderRef {
  id: ObjectId;
  ownerId: PlayerId;
  ownerName: string;
  obj: ProjectedObject | undefined;
}

/**
 * Card data resolves asynchronously (§4's thin client, no cache warm-up), so a commander needs a
 * name to wear until its card lands — one that still says whose it is.
 */
export function useCommanderName(commander: CommanderRef): string {
  const card = useCard(commander.obj);
  return card ? card.name : `${commander.ownerName}'s commander`;
}

export function CommanderName({ commander }: { commander: CommanderRef }) {
  const name = useCommanderName(commander);
  return <>{name}</>;
}
