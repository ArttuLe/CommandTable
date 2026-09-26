// Dev-only: a whole started table in one HTTP request, so a change can be looked at without a
// room code, four decklist pastes and a host start (see the `/devtest` route in server.ts).
//
// Everything here goes through the machinery a real game uses — parseDecklist/resolveDecklist
// for the decks, createTableState for the deal, applyAction for keep-and-begin — so the fixture
// cannot drift from what starting a game normally produces. The only thing it invents is
// pressing those buttons on the players' behalf.

import { readFileSync } from 'node:fs';
import type { PlayerId, TableState } from '@command-table/common';
import { parseDecklist } from '../decklistParser.js';
import { resolveDecklist, type CardLookup } from '../deckResolver.js';
import { applyAction, type ApplyResult } from '../actionApplier.js';
import { createTableState } from '../tableFactory.js';
import type { Room, RoomManager } from '../roomManager.js';

/** Seat names, in seat order. Four is MAX_SEATS (roomManager.ts). */
export const DEV_PLAYER_NAMES = ['Alice', 'Bob', 'Carol', 'Dave'] as const;

/** Matches MIN_PLAYERS_TO_START / MAX_SEATS in roomManager.ts. */
export const MIN_DEV_PLAYERS = 2;
export const MAX_DEV_PLAYERS = DEV_PLAYER_NAMES.length;

const DECK_FILES = ['atraxa.txt', 'edgar-markov.txt', 'ur-dragon.txt', 'chulane.txt'];

// Read from src rather than dist: `tsc` does not copy .txt, and devtest only ever runs under
// tsx (`npm run dev`), never from a built server.
export function devDeckTexts(): string[] {
  return DECK_FILES.map((file) => readFileSync(new URL(`./decks/${file}`, import.meta.url), 'utf8'));
}

export interface DevTable {
  room: Room;
  table: TableState;
  /** Seat name → rejoin token, which is how a browser at /devtest/N/Name takes its seat. */
  rejoinTokensByName: Map<string, string>;
}

export function buildDevTable(
  playerAmount: number,
  deps: { roomManager: RoomManager; cardIndex: CardLookup; deckTexts?: string[] }
): DevTable {
  const deckTexts = deps.deckTexts ?? devDeckTexts();
  const room = deps.roomManager.createRoom();
  const rejoinTokensByName = new Map<string, string>();
  const playerIds: PlayerId[] = [];

  for (let seat = 0; seat < playerAmount; seat++) {
    const displayName = DEV_PLAYER_NAMES[seat];
    const joined = room.join({ displayName, seat });
    if (!joined.ok) throw new Error(`dev seat ${seat} could not be filled: ${joined.reason}`);
    room.setResolvedDeck(joined.playerId, resolveDecklist(parseDecklist(deckTexts[seat % deckTexts.length]), deps.cardIndex));
    room.setReady(joined.playerId, true);
    rejoinTokensByName.set(displayName, joined.rejoinToken);
    playerIds.push(joined.playerId);
  }

  room.start();
  let table = createTableState({ roomId: room.roomId, seats: room.buildSeatSetups() });
  // Past the opening-hand step: nobody is here to mulligan, and the point is to land on a board.
  for (const playerId of playerIds) {
    table = expectOk(applyAction(table, { t: 'KEEP_HAND', playerId }, playerId));
  }
  table = expectOk(applyAction(table, { t: 'BEGIN_PLAY' }, playerIds[0]));

  return { room, table, rejoinTokensByName };
}

function expectOk(result: ApplyResult): TableState {
  if (!result.ok) throw new Error(`dev table setup rejected: ${result.reason}`);
  return result.state;
}

/** The seat a `/devtest/:playerAmount/:playerName` URL is asking for, or undefined if there is none. */
export function devSeatName(playerAmount: number, playerName: string): string | undefined {
  const wanted = playerName.trim().toLowerCase();
  return DEV_PLAYER_NAMES.slice(0, playerAmount).find((name) => name.toLowerCase() === wanted);
}
