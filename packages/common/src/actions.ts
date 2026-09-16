// Player action catalog, per design doc §8 and §10. Phase 2 subset only: the MOVE_OBJECT
// primitive plus shuffle/draw and turn advancement. The rest of §8 (counters, tokens,
// attachments, markers, reveal/peek/search, life, dice, etc.) is Phase 3+.

import type { PlayerId } from './ids.js';
import type { ObjectId, ZoneRef } from './objects.js';

export type Action =
  | { t: 'MOVE_OBJECT'; objectId: ObjectId; toZone: ZoneRef; toPosition?: number; faceDown?: boolean }
  | { t: 'SHUFFLE_LIBRARY'; playerId: PlayerId }
  | { t: 'DRAW'; playerId: PlayerId; count: number }
  | { t: 'PASS_TURN' };
