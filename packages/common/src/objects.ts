// The table's core model, per design doc §7.1-7.2. Everything on the table is a GameObject;
// zones are a field on the object, not arrays objects are spliced between (§7.1's rationale:
// this makes zone changes a single-field write and eliminates duplicate-on-move bugs).

import type { PlayerId } from './ids.js';

export type ObjectId = string;

export type Visibility =
  | { kind: 'all' }
  | { kind: 'none' }
  | { kind: 'players'; ids: PlayerId[] };

export type ZoneKind = 'library' | 'hand' | 'battlefield' | 'graveyard' | 'exile' | 'commandZone';

export type ZoneRef =
  | { playerId: PlayerId; zone: ZoneKind }
  | { zone: 'stack' | 'limbo' };

export type ObjectSource =
  | { kind: 'card'; scryfallId: string; oracleId: string }
  | { kind: 'token'; scryfallId?: string; adhoc?: AdhocFace }
  | { kind: 'copy'; ofObjectId: ObjectId; scryfallId: string };

export interface AdhocFace {
  name: string;
  typeLine: string;
  power?: string;
  toughness?: string;
  text?: string;
  colors?: string[];
  artFromScryfallId?: string;
}

export interface GameObject {
  id: ObjectId;
  ownerId: PlayerId;
  controllerId: PlayerId;

  source: ObjectSource;

  zone: ZoneRef;
  position: number;

  faceVisibility: Visibility;
  faceDown: boolean;
  currentFace: number;

  tapped: boolean;
  flipped: boolean;
  counters: Record<string, number>;
  attachedTo: ObjectId | null;
  annotation: string | null;
  markers: string[];
}
