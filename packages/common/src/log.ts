// Game log, per design doc §15.1: "With no engine arbitrating, the log is the referee."

import type { PlayerId } from './ids.js';
import type { Visibility } from './objects.js';

// Most entries describe an action and need no kind. Chat and random results are called out so the
// client can style them apart and surface them while the log rail is collapsed.
export type LogKind = 'chat' | 'random';

export interface LogEntry {
  revision: number;
  timestamp: number;
  actorId: PlayerId;
  text: string;
  visibility: Visibility;
  undoable: boolean;
  kind?: LogKind;
}
