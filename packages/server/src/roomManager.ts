// Lobby room/seat management, per design doc §14.1. A Room holds no card data itself — it
// only tracks who's seated and each seat's deck-resolution status; the resolved decklist and
// its warnings go back to that player only, via a private `deckResult` message (§9's hidden-
// information posture extended to pre-game info the doc doesn't explicitly cover).

import { randomUUID } from 'node:crypto';
import type { PlayerId, ResolvedDecklist, RoomId, RoomState } from '@command-table/common';
import { generateRoomCode } from './roomCode.js';
import { deckStatusFrom } from './deckStatus.js';
import { EMPTY_RESOLVED_DECKLIST } from './deckResolver.js';
import type { SeatSetup } from './tableFactory.js';

const MAX_SEATS = 4;
const MIN_PLAYERS_TO_START = 2;

interface Seat {
  playerId: PlayerId | null;
  displayName: string | null;
  connected: boolean;
  ready: boolean;
  resolvedDeck: ResolvedDecklist | null;
}

export type JoinResult =
  | { ok: true; playerId: PlayerId; seat: number; rejoinToken: string }
  | { ok: false; reason: string };

function emptySeat(): Seat {
  return { playerId: null, displayName: null, connected: false, ready: false, resolvedDeck: null };
}

export class Room {
  readonly roomId: RoomId;
  private seats: Seat[] = Array.from({ length: MAX_SEATS }, emptySeat);
  private seatIndexByPlayer = new Map<PlayerId, number>();
  private playerIdByRejoinToken = new Map<string, PlayerId>();
  private hostId: PlayerId | null = null;
  private started = false;

  constructor(roomId: RoomId) {
    this.roomId = roomId;
  }

  join(params: { displayName: string; seat?: number; rejoinToken?: string }): JoinResult {
    if (params.rejoinToken) {
      return this.rejoin(params.rejoinToken, params.displayName);
    }

    const seatIndex = params.seat !== undefined ? params.seat : this.firstOpenSeat();
    if (seatIndex === undefined || seatIndex < 0 || seatIndex >= MAX_SEATS) {
      return { ok: false, reason: 'invalid seat' };
    }
    if (this.seats[seatIndex].playerId !== null) {
      return { ok: false, reason: 'seat taken' };
    }

    const playerId = randomUUID();
    const rejoinToken = randomUUID();
    this.seats[seatIndex] = {
      playerId,
      displayName: params.displayName,
      connected: true,
      ready: false,
      resolvedDeck: null,
    };
    this.seatIndexByPlayer.set(playerId, seatIndex);
    this.playerIdByRejoinToken.set(rejoinToken, playerId);
    if (this.hostId === null) {
      this.hostId = playerId;
    }

    return { ok: true, playerId, seat: seatIndex, rejoinToken };
  }

  private rejoin(rejoinToken: string, displayName: string): JoinResult {
    const playerId = this.playerIdByRejoinToken.get(rejoinToken);
    if (!playerId) {
      return { ok: false, reason: 'invalid rejoin token' };
    }
    const seatIndex = this.seatIndexByPlayer.get(playerId);
    if (seatIndex === undefined) {
      return { ok: false, reason: 'invalid rejoin token' };
    }
    this.seats[seatIndex].connected = true;
    this.seats[seatIndex].displayName = displayName;
    return { ok: true, playerId, seat: seatIndex, rejoinToken };
  }

  private firstOpenSeat(): number | undefined {
    const index = this.seats.findIndex((s) => s.playerId === null);
    return index === -1 ? undefined : index;
  }

  setConnected(playerId: PlayerId, connected: boolean): void {
    const seat = this.seatFor(playerId);
    if (seat) seat.connected = connected;
  }

  setResolvedDeck(playerId: PlayerId, resolved: ResolvedDecklist): void {
    const seat = this.seatFor(playerId);
    if (seat) seat.resolvedDeck = resolved;
  }

  setReady(playerId: PlayerId, ready: boolean): void {
    const seat = this.seatFor(playerId);
    if (seat) seat.ready = ready;
  }

  isHost(playerId: PlayerId): boolean {
    return this.hostId === playerId;
  }

  occupiedSeatCount(): number {
    return this.seats.filter((s) => s.playerId !== null).length;
  }

  canStart(): boolean {
    return !this.started && this.occupiedSeatCount() >= MIN_PLAYERS_TO_START;
  }

  start(): void {
    this.started = true;
  }

  buildSeatSetups(): SeatSetup[] {
    return this.seats
      .map((seat, index) => ({ seat, index }))
      .filter(({ seat }) => seat.playerId !== null)
      .map(({ seat, index }) => ({
        playerId: seat.playerId as PlayerId,
        displayName: seat.displayName ?? `Seat ${index + 1}`,
        seat: index,
        resolved: seat.resolvedDeck ?? EMPTY_RESOLVED_DECKLIST,
      }));
  }

  private seatFor(playerId: PlayerId): Seat | undefined {
    const index = this.seatIndexByPlayer.get(playerId);
    return index === undefined ? undefined : this.seats[index];
  }

  toState(): RoomState {
    return {
      roomId: this.roomId,
      hostId: this.hostId,
      started: this.started,
      seats: this.seats.map((seat, index) => ({
        seat: index,
        playerId: seat.playerId,
        displayName: seat.displayName,
        connected: seat.connected,
        ready: seat.ready,
        deckStatus: seat.resolvedDeck ? deckStatusFrom(seat.resolvedDeck) : 'none',
      })),
    };
  }
}

export class RoomManager {
  private rooms = new Map<RoomId, Room>();

  createRoom(): Room {
    let roomId = generateRoomCode();
    while (this.rooms.has(roomId)) {
      roomId = generateRoomCode();
    }
    const room = new Room(roomId);
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId: RoomId): Room | undefined {
    return this.rooms.get(roomId);
  }
}
