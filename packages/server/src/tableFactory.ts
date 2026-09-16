// Builds the initial TableState when the host starts the game, per design doc §12.1 (commanders
// start in the command zone), §12.5 (life 40, turn order randomized), §13 (server-side RNG), and
// §14.1 step 5 (opening hand of 7). Sideboard/maybeboard lines are reference-only and never make
// it to the table.

import { randomInt as cryptoRandomInt, randomUUID } from 'node:crypto';
import type { Card, GameObject, PlayerId, PlayerState, ResolvedDeckLine, ResolvedDecklist, TableState } from '@command-table/common';
import { fisherYatesShuffle } from './shuffle.js';

export interface SeatSetup {
  playerId: PlayerId;
  displayName: string;
  seat: number;
  resolved: ResolvedDecklist;
}

interface CreateTableParams {
  roomId: string;
  seats: SeatSetup[];
}

interface CreateTableDeps {
  randomInt: (exclusiveMax: number) => number;
}

const defaultDeps: CreateTableDeps = { randomInt: cryptoRandomInt };
const OPENING_HAND_SIZE = 7;

export function createTableState(params: CreateTableParams, deps: CreateTableDeps = defaultDeps): TableState {
  const objects: Record<string, GameObject> = {};
  const players: PlayerState[] = [];

  for (const seat of params.seats) {
    const commanderObjects = seat.resolved.commanders.map((line) =>
      makeObject(line.card, seat.playerId, { playerId: seat.playerId, zone: 'commandZone' }, { kind: 'all' })
    );

    const libraryObjects = expandLines(seat.resolved.deck).map((card) =>
      makeObject(card, seat.playerId, { playerId: seat.playerId, zone: 'library' }, { kind: 'none' })
    );
    const shuffledLibrary = fisherYatesShuffle(libraryObjects, deps.randomInt);

    // §14.1 step 5: "Opening hands: each player draws 7." A too-small deck just deals what's
    // there, same as DRAW does mid-game rather than erroring.
    const handSize = Math.min(OPENING_HAND_SIZE, shuffledLibrary.length);
    const hand = shuffledLibrary.splice(0, handSize).map((obj) => ({
      ...obj,
      zone: { playerId: seat.playerId, zone: 'hand' as const },
      faceVisibility: { kind: 'players' as const, ids: [seat.playerId] },
      position: 0,
    }));
    shuffledLibrary.forEach((obj, index) => {
      obj.position = index;
    });

    for (const obj of [...commanderObjects, ...hand, ...shuffledLibrary]) {
      objects[obj.id] = obj;
    }

    players.push({
      id: seat.playerId,
      displayName: seat.displayName,
      seat: seat.seat,
      connected: true,
      life: 40,
      counters: {},
      commanderDamageTaken: {},
      commanderCastCount: {},
      commanderIds: commanderObjects.map((o) => o.id),
      status: 'active',
    });
  }

  const turnOrder = fisherYatesShuffle(players, deps.randomInt);

  return {
    roomId: params.roomId,
    objects,
    players: turnOrder,
    turn: { turnNumber: 1, activePlayerId: turnOrder[0].id, phase: 'main' },
    log: [],
    revision: 0,
    createdAt: Date.now(),
  };
}

function expandLines(lines: ResolvedDeckLine[]): Card[] {
  const cards: Card[] = [];
  for (const { line, card } of lines) {
    for (let i = 0; i < line.quantity; i++) {
      cards.push(card);
    }
  }
  return cards;
}

function makeObject(
  card: Card,
  ownerId: PlayerId,
  zone: GameObject['zone'],
  faceVisibility: GameObject['faceVisibility']
): GameObject {
  return {
    id: randomUUID(),
    ownerId,
    controllerId: ownerId,
    source: { kind: 'card', scryfallId: card.scryfallId, oracleId: card.oracleId },
    zone,
    position: 0,
    faceVisibility,
    faceDown: false,
    currentFace: 0,
    tapped: false,
    flipped: false,
    counters: {},
    attachedTo: null,
    annotation: null,
    markers: [],
  };
}
