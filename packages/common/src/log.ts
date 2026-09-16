// Game log, per design doc §15.1: "With no engine arbitrating, the log is the referee."

import type { PlayerId } from './ids.js';
import type { Visibility } from './objects.js';

export interface LogEntry {
  revision: number;
  timestamp: number;
  actorId: PlayerId;
  text: string;
  visibility: Visibility;
  undoable: boolean;
}
