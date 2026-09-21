// "Make another one of those."
//
// §16.3 asks for "create N copies of a token" in one click; retyping the thing into the
// "Create token…" form is not that. Both branches produce a real token rather than a `copy` object:
// CREATE_COPY needs a scryfallId (so it can't reproduce an ad-hoc token at all) and its output
// is a `copy`, which the server then refuses to copy again — a token you can duplicate once but
// not twice is worse than no button.

import { isRedacted, type Action, type PlayerId, type ProjectedObject } from '@command-table/common';

/** Null when there's nothing safe to duplicate — the caller hides the button. */
export function duplicateAction(obj: ProjectedObject, ownerId: PlayerId): Action | null {
  if (isRedacted(obj) || obj.source.kind !== 'token') return null;

  const source = obj.source.adhoc
    ? { adhoc: obj.source.adhoc }
    : obj.source.scryfallId
      ? { scryfallId: obj.source.scryfallId }
      : null;
  if (!source) return null;

  return { t: 'CREATE_TOKEN', ownerId, zone: obj.zone, source, quantity: 1 };
}
