import type { DeckStatus, ResolvedDecklist } from '@command-table/common';

export function deckStatusFrom(resolved: ResolvedDecklist): DeckStatus {
  return resolved.warnings.length > 0 || resolved.unresolved.length > 0 ? 'warnings' : 'ok';
}
