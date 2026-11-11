import { describe, expect, it } from 'vitest';
import { Room, RoomManager } from './roomManager.js';
import { EMPTY_RESOLVED_DECKLIST } from './deckResolver.js';

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

  it('setResolvedDeck updates only the given seat\'s deck status', () => {
    const manager = new RoomManager();
    const room = manager.createRoom();
    const alice = room.join({ displayName: 'Alice' });
    const bob = room.join({ displayName: 'Bob' });
    if (!alice.ok || !bob.ok) throw new Error('unreachable');

    room.setResolvedDeck(alice.playerId, { commanders: [], deck: [], sideboard: [], maybeboard: [], unresolved: [], warnings: [] });

    expect(room.toState().seats[0].deckStatus).toBe('ok');
    expect(room.toState().seats[1].deckStatus).toBe('none');
  });

  it('buildSeatSetups includes only occupied seats with their resolved decks', () => {
    const manager = new RoomManager();
    const room = manager.createRoom();
    const alice = room.join({ displayName: 'Alice', seat: 0 });
    room.join({ displayName: 'Bob', seat: 2 });
    if (!alice.ok) throw new Error('unreachable');
    const resolved = { commanders: [], deck: [], sideboard: [], maybeboard: [], unresolved: [], warnings: [] };
    room.setResolvedDeck(alice.playerId, resolved);

    const setups = room.buildSeatSetups();

    expect(setups).toHaveLength(2);
    expect(setups.find((s) => s.displayName === 'Alice')?.resolved).toBe(resolved);
  });

  it('canStart requires at least two seated players and refuses once started', () => {
    const manager = new RoomManager();
    const room = manager.createRoom();
    expect(room.canStart()).toBe(false);
    room.join({ displayName: 'Alice' });
    expect(room.canStart()).toBe(false);
    room.join({ displayName: 'Bob' });
    expect(room.canStart()).toBe(true);
    room.start();
    expect(room.canStart()).toBe(false);
  });

  // A started game is closed to new seats. An open seat used to take anyone with the
  // passphrase, who was then counted in — and could decide — the table's undo votes.
  it('refuses a new seat once the game has started, but still lets a seated player back in', () => {
    const room = new RoomManager().createRoom();
    const alice = room.join({ displayName: 'Alice' });
    room.join({ displayName: 'Bob' });
    room.start();

    expect(room.join({ displayName: 'Mallory' })).toMatchObject({ ok: false });
    if (!alice.ok) throw new Error('unreachable');
    expect(room.join({ displayName: 'Alice', rejoinToken: alice.rejoinToken })).toMatchObject({ ok: true });
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

describe('Room persistence', () => {
  function seatedRoom() {
    const manager = new RoomManager();
    const room = manager.createRoom();
    const alice = room.join({ displayName: 'Alice' });
    const bob = room.join({ displayName: 'Bob' });
    if (!alice.ok || !bob.ok) throw new Error('unreachable');
    return { manager, room, alice, bob };
  }

  it('round-trips seats, host and started through a snapshot', () => {
    const { room, alice } = seatedRoom();
    room.setResolvedDeck(alice.playerId, { ...EMPTY_RESOLVED_DECKLIST, warnings: [{ kind: 'wrong_deck_size', expected: 100, actual: 99 }] });
    room.start();

    const restored = Room.fromSnapshot(JSON.parse(JSON.stringify(room.toSnapshot())));
    const state = restored.toState();

    expect(restored.roomId).toBe(room.roomId);
    expect(state.hostId).toBe(alice.playerId);
    expect(state.started).toBe(true);
    expect(state.seats[0].displayName).toBe('Alice');
    expect(state.seats[1].displayName).toBe('Bob');
    expect(restored.buildSeatSetups()[0].resolved.warnings).toEqual([{ kind: 'wrong_deck_size', expected: 100, actual: 99 }]);
  });

  it('a rejoin token still works after a snapshot round-trip', () => {
    const { room, bob } = seatedRoom();

    const restored = Room.fromSnapshot(JSON.parse(JSON.stringify(room.toSnapshot())));
    const result = restored.join({ displayName: 'Bob', rejoinToken: bob.rejoinToken });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.playerId).toBe(bob.playerId);
    expect(result.seat).toBe(1);
  });

  // Nobody is connected to a process that just booted, however the snapshot was taken.
  it('restores every seat as disconnected', () => {
    const { room } = seatedRoom();

    const restored = Room.fromSnapshot(room.toSnapshot());

    expect(restored.toState().seats.every((s) => !s.connected)).toBe(true);
  });

  it('RoomManager.restore makes rooms reachable by id again', () => {
    const { room } = seatedRoom();
    const manager = new RoomManager();

    manager.restore([room.toSnapshot()]);

    expect(manager.getRoom(room.roomId)?.toState().seats[0].displayName).toBe('Alice');
  });
});

describe('Room.endGame', () => {
  function startedRoom() {
    const manager = new RoomManager();
    const room = manager.createRoom();
    const alice = room.join({ displayName: 'Alice' });
    const bob = room.join({ displayName: 'Bob' });
    if (!alice.ok || !bob.ok) throw new Error('unreachable');
    room.setResolvedDeck(alice.playerId, EMPTY_RESOLVED_DECKLIST);
    room.setReady(alice.playerId, true);
    room.setReady(bob.playerId, true);
    room.start();
    return { room, alice, bob };
  }

  it('reopens the room for another game', () => {
    const { room } = startedRoom();
    expect(room.canStart()).toBe(false);

    room.endGame();

    expect(room.toState().started).toBe(false);
    expect(room.canStart()).toBe(true);
  });

  // Otherwise the next game could start off confirmations given for the previous one.
  it('clears ready flags so the next game needs a fresh ready check', () => {
    const { room } = startedRoom();

    room.endGame();

    expect(room.toState().seats.every((s) => !s.ready)).toBe(true);
  });

  it('keeps seats and host, so nobody has to rejoin', () => {
    const { room, alice } = startedRoom();

    room.endGame();

    const state = room.toState();
    expect(state.hostId).toBe(alice.playerId);
    expect(state.seats[0].playerId).toBe(alice.playerId);
    expect(state.seats[1].displayName).toBe('Bob');
    expect(room.buildSeatSetups()).toHaveLength(2);
  });

  // The lobby is a fresh slate for the next game, and a deck still showing "ok" from the last one
  // is the most misleading part of it — nobody can tell whether it is this game's deck. The
  // client keeps the decklist *text* in localStorage, so re-submitting is a click, not a re-paste.
  it('un-submits every deck, so the next game is deliberately confirmed', () => {
    const { room } = startedRoom();

    room.endGame();

    expect(room.toState().seats.every((s) => s.deckStatus === 'none')).toBe(true);
  });

  it('leaves rejoin tokens valid', () => {
    const { room, bob } = startedRoom();

    room.endGame();

    expect(room.join({ displayName: 'Bob', rejoinToken: bob.rejoinToken }).ok).toBe(true);
  });
});

// Without this, losing your rejoin token (different browser, cleared storage, or just typing the
// room code fresh) means your old seat becomes a permanent ghost: it keeps your name, your ready
// flag and your decklist, and buildSeatSetups would deal a phantom player into the game.
describe('reclaiming a seat by name', () => {
  function lobbyWithDisconnectedBob() {
    const room = new Room('ABC123');
    const alice = room.join({ displayName: 'Alice' });
    const bob = room.join({ displayName: 'Bob' });
    if (!alice.ok || !bob.ok) throw new Error('unreachable');
    room.setResolvedDeck(bob.playerId, EMPTY_RESOLVED_DECKLIST);
    room.setReady(bob.playerId, true);
    room.setConnected(bob.playerId, false);
    return { room, alice, bob };
  }

  it('returns a disconnected player to their own seat instead of opening a new one', () => {
    const { room, bob } = lobbyWithDisconnectedBob();

    const result = room.join({ displayName: 'Bob' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.seat).toBe(1);
    expect(room.occupiedSeatCount()).toBe(2);
    expect(room.toState().seats[1].connected).toBe(true);
  });

  it('issues a working rejoin token to the reclaimed seat', () => {
    const { room } = lobbyWithDisconnectedBob();

    const reclaimed = room.join({ displayName: 'Bob' });
    if (!reclaimed.ok) throw new Error('unreachable');
    room.setConnected(reclaimed.playerId, false);
    const again = room.join({ displayName: 'Bob', rejoinToken: reclaimed.rejoinToken });

    expect(again.ok).toBe(true);
    if (!again.ok) throw new Error('unreachable');
    expect(again.seat).toBe(1);
  });

  it('keeps the decklist that seat had already submitted', () => {
    const { room } = lobbyWithDisconnectedBob();

    room.join({ displayName: 'Bob' });

    expect(room.toState().seats[1].deckStatus).not.toBe('none');
  });

  it('matches names case- and whitespace-insensitively', () => {
    const { room } = lobbyWithDisconnectedBob();

    const result = room.join({ displayName: '  bob ' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.seat).toBe(1);
  });

  // A second, genuinely different Bob must not evict the one who is sitting there.
  it('does not take a seat whose player is still connected', () => {
    const { room } = lobbyWithDisconnectedBob();

    const result = room.join({ displayName: 'Alice' });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.seat).toBe(2);
  });

  // Mid-game a disconnected seat is sacred: the board stays and play continues, so
  // handing it to whoever types the right name would be a way to take over someone's position.
  it('does not reclaim by name once the game has started', () => {
    const { room } = lobbyWithDisconnectedBob();
    room.start();

    // Refused outright: a started game takes no new seats, and a name never reclaims one.
    const result = room.join({ displayName: 'Bob' });

    expect(result.ok).toBe(false);
  });

  it('still prefers an explicitly requested seat over a name match', () => {
    const { room } = lobbyWithDisconnectedBob();

    const result = room.join({ displayName: 'Bob', seat: 3 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.seat).toBe(3);
  });
});

describe('freeing a seat', () => {
  function lobby() {
    const room = new Room('ABC123');
    const alice = room.join({ displayName: 'Alice' });
    const bob = room.join({ displayName: 'Bob' });
    if (!alice.ok || !bob.ok) throw new Error('unreachable');
    room.setConnected(bob.playerId, false);
    return { room, alice, bob };
  }

  it('opens a disconnected seat and drops its deck and ready flag', () => {
    const { room, bob } = lobby();

    expect(room.freeSeat(1)).toBe(true);

    const seat = room.toState().seats[1];
    expect(seat.playerId).toBeNull();
    expect(seat.displayName).toBeNull();
    expect(seat.ready).toBe(false);
    expect(seat.deckStatus).toBe('none');
    expect(room.occupiedSeatCount()).toBe(1);
    expect(room.join({ displayName: 'Bob', rejoinToken: bob.rejoinToken }).ok).toBe(false);
  });

  it('refuses to free a seat whose player is connected', () => {
    const { room } = lobby();
    expect(room.freeSeat(0)).toBe(false);
    expect(room.toState().seats[0].displayName).toBe('Alice');
  });

  it('refuses to free an already-open seat or one out of range', () => {
    const { room } = lobby();
    expect(room.freeSeat(2)).toBe(false);
    expect(room.freeSeat(9)).toBe(false);
  });

  // Freeing the host's own seat would leave the room with no one able to start or free anything.
  it('hands the host role to a remaining player when the host seat is freed', () => {
    const { room, alice, bob } = lobby();
    room.setConnected(alice.playerId, false);

    expect(room.freeSeat(0)).toBe(true);

    expect(room.toState().hostId).toBe(bob.playerId);
  });
});
