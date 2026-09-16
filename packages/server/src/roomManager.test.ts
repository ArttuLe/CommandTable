import { describe, expect, it } from 'vitest';
import { RoomManager } from './roomManager.js';

describe('RoomManager', () => {
  it('creates a room with 4 open seats and no host', () => {
    const manager = new RoomManager();
    const room = manager.createRoom();

    expect(room.toState().seats).toHaveLength(4);
    expect(room.toState().seats.every((s) => s.playerId === null)).toBe(true);
    expect(room.toState().hostId).toBeNull();
  });

  it('first player to join becomes host and claims seat 0 by default', () => {
    const manager = new RoomManager();
    const room = manager.createRoom();

    const result = room.join({ displayName: 'Alice' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.seat).toBe(0);
    expect(room.toState().hostId).toBe(result.playerId);
  });

  it('lets a player claim a specific open seat', () => {
    const manager = new RoomManager();
    const room = manager.createRoom();

    const result = room.join({ displayName: 'Bob', seat: 2 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.seat).toBe(2);
    expect(room.toState().seats[2].displayName).toBe('Bob');
  });

  it('rejects claiming a seat that is already taken', () => {
    const manager = new RoomManager();
    const room = manager.createRoom();
    room.join({ displayName: 'Alice', seat: 0 });

    const result = room.join({ displayName: 'Bob', seat: 0 });

    expect(result.ok).toBe(false);
  });

  it('rejects joining a room with no open seats', () => {
    const manager = new RoomManager();
    const room = manager.createRoom();
    room.join({ displayName: 'A' });
    room.join({ displayName: 'B' });
    room.join({ displayName: 'C' });
    room.join({ displayName: 'D' });

    const result = room.join({ displayName: 'E' });

    expect(result.ok).toBe(false);
  });

  it('rejoins an existing seat given a valid rejoin token, without freeing it in between', () => {
    const manager = new RoomManager();
    const room = manager.createRoom();
    const joined = room.join({ displayName: 'Alice' });
    if (!joined.ok) throw new Error('unreachable');

    room.setConnected(joined.playerId, false);
    expect(room.toState().seats[0].connected).toBe(false);

    const rejoined = room.join({ displayName: 'Alice', rejoinToken: joined.rejoinToken });

    expect(rejoined.ok).toBe(true);
    if (!rejoined.ok) throw new Error('unreachable');
    expect(rejoined.playerId).toBe(joined.playerId);
    expect(room.toState().seats[0].connected).toBe(true);
  });

  it('rejects an invalid rejoin token', () => {
    const manager = new RoomManager();
    const room = manager.createRoom();

    const result = room.join({ displayName: 'Alice', rejoinToken: 'not-a-real-token' });

    expect(result.ok).toBe(false);
  });

  it('setDeckStatus updates only the given seat', () => {
    const manager = new RoomManager();
    const room = manager.createRoom();
    const alice = room.join({ displayName: 'Alice' });
    const bob = room.join({ displayName: 'Bob' });
    if (!alice.ok || !bob.ok) throw new Error('unreachable');

    room.setDeckStatus(alice.playerId, 'ok');

    expect(room.toState().seats[0].deckStatus).toBe('ok');
    expect(room.toState().seats[1].deckStatus).toBe('none');
  });

  it('setReady toggles a seat readiness', () => {
    const manager = new RoomManager();
    const room = manager.createRoom();
    const alice = room.join({ displayName: 'Alice' });
    if (!alice.ok) throw new Error('unreachable');

    room.setReady(alice.playerId, true);

    expect(room.toState().seats[0].ready).toBe(true);
  });

  it('disconnect marks the seat disconnected but keeps it claimed', () => {
    const manager = new RoomManager();
    const room = manager.createRoom();
    const alice = room.join({ displayName: 'Alice' });
    if (!alice.ok) throw new Error('unreachable');

    room.setConnected(alice.playerId, false);

    const seat = room.toState().seats[0];
    expect(seat.connected).toBe(false);
    expect(seat.playerId).toBe(alice.playerId);
  });

  it('getRoom returns undefined for an unknown room id', () => {
    const manager = new RoomManager();
    expect(manager.getRoom('NOPE12')).toBeUndefined();
  });

  it('creates rooms with unguessable, distinct codes', () => {
    const manager = new RoomManager();
    const ids = new Set(Array.from({ length: 20 }, () => manager.createRoom().roomId));
    expect(ids.size).toBe(20);
  });
});
