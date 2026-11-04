// Game log, per design doc §15.1: "With no engine arbitrating, the log is the referee."

import type { PlayerId } from './ids.js';
import type { Visibility } from './objects.js';

// Most entries describe an action and need no kind. Chat and random results are called out so the
// client can style them apart and surface them while the log rail is collapsed.
export type LogKind = 'chat' | 'random';

/**
 * The actor on entries the table itself wrote rather than a player — currently just the setup
 * line at the top of a new game. It is a PlayerId no player can hold, and the client already
 * falls back to printing an unrecognised actorId verbatim, so this needs no rendering special
 * case: the line reads "Table shuffled every library…".
 */
export const SYSTEM_ACTOR: PlayerId = 'Table';

export interface LogEntry {
  revision: number;
  timestamp: number;
  actorId: PlayerId;
  text: string;
  visibility: Visibility;
  undoable: boolean;
  kind?: LogKind;
  /**
   * The card the line is about, when everyone could see it — so the client can say "moved Sol Ring
   * to a graveyard" where the text says "a card". The server deliberately keeps card names out of
   * the action layer (see actionDescriptions.ts), so this is a reference the client resolves, never a name it
   * was told: a printing, or a token's own typed name. Absent for anything hidden from anyone.
   */
  subject?: { scryfallId: string } | { name: string };
}
