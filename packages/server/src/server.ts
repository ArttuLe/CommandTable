// Server: lobby (Phase 1, §11/§14.1) plus in-game table state (Phase 2, §7-§9). 'start' builds
// the initial TableState from each seat's resolved decklist; 'action' applies §8 actions to it.
// Every outbound table snapshot goes through projectFor (§9.1) — never send a TableState raw.

import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import Database from 'better-sqlite3';
import type { ClientMessage, PlayerId, RoomId, ServerMessage, TableState } from '@command-table/common';
import { CardIndex } from './cardIndex.js';
import { parseDecklist } from './decklistParser.js';
import { resolveDecklist } from './deckResolver.js';
import { Room, RoomManager } from './roomManager.js';
import { createTableState } from './tableFactory.js';
import { applyAction } from './actionApplier.js';
import { projectFor } from './projection.js';

const PORT = Number(process.env.PORT ?? 8080);
const DB_PATH = process.env.CARD_DB_PATH ?? './data/cards.sqlite3';

const cardIndex = new CardIndex(new Database(DB_PATH, { readonly: true }));
const roomManager = new RoomManager();
const socketsByRoom = new Map<RoomId, Map<PlayerId, WebSocket>>();
const tablesByRoom = new Map<RoomId, TableState>();

interface ConnectionState {
  roomId: RoomId | null;
  playerId: PlayerId | null;
}

function send(socket: WebSocket, message: ServerMessage): void {
  socket.send(JSON.stringify(message));
}

function broadcastRoomState(room: Room): void {
  const sockets = socketsByRoom.get(room.roomId);
  if (!sockets) return;
  const message: ServerMessage = { t: 'room', roomState: room.toState() };
  for (const socket of sockets.values()) {
    send(socket, message);
  }
}

function broadcastTableState(roomId: RoomId): void {
  const table = tablesByRoom.get(roomId);
  const sockets = socketsByRoom.get(roomId);
  if (!table || !sockets) return;
  for (const [playerId, socket] of sockets) {
    send(socket, { t: 'state', state: projectFor(table, playerId) });
  }
}

function registerSocket(roomId: RoomId, playerId: PlayerId, socket: WebSocket): void {
  let sockets = socketsByRoom.get(roomId);
  if (!sockets) {
    sockets = new Map();
    socketsByRoom.set(roomId, sockets);
  }
  sockets.set(playerId, socket);
}

function unregisterSocket(roomId: RoomId, playerId: PlayerId, socket: WebSocket): void {
  const sockets = socketsByRoom.get(roomId);
  if (sockets?.get(playerId) === socket) {
    sockets.delete(playerId);
  }
}

function handleMessage(socket: WebSocket, state: ConnectionState, raw: ClientMessage): void {
  switch (raw.t) {
    case 'join': {
      const room = roomManager.getRoom(raw.roomId);
      if (!room) {
        send(socket, { t: 'error', message: 'room not found' });
        return;
      }
      const result = room.join({ displayName: raw.displayName, seat: raw.seat, rejoinToken: raw.rejoinToken });
      if (!result.ok) {
        send(socket, { t: 'error', message: result.reason });
        return;
      }
      state.roomId = room.roomId;
      state.playerId = result.playerId;
      registerSocket(room.roomId, result.playerId, socket);
      send(socket, { t: 'joined', roomState: room.toState(), rejoinToken: result.rejoinToken });
      broadcastRoomState(room);
      if (tablesByRoom.has(room.roomId)) {
        send(socket, { t: 'state', state: projectFor(tablesByRoom.get(room.roomId)!, result.playerId) });
      }
      return;
    }

    case 'deck': {
      const room = requireRoom(socket, state);
      if (!room || !state.playerId) return;
      const parsed = parseDecklist(raw.list);
      const resolved = resolveDecklist(parsed, cardIndex);
      room.setResolvedDeck(state.playerId, resolved);
      send(socket, { t: 'deckResult', warnings: resolved.warnings, unresolved: resolved.unresolved });
      broadcastRoomState(room);
      return;
    }

    case 'ready': {
      const room = requireRoom(socket, state);
      if (!room || !state.playerId) return;
      room.setReady(state.playerId, raw.ready);
      broadcastRoomState(room);
      return;
    }

    case 'start': {
      const room = requireRoom(socket, state);
      if (!room || !state.playerId) return;
      if (!room.isHost(state.playerId)) {
        send(socket, { t: 'error', message: 'only the host can start the game' });
        return;
      }
      if (!room.canStart()) {
        send(socket, { t: 'error', message: 'need at least 2 seated players to start' });
        return;
      }
      const table = createTableState({ roomId: room.roomId, seats: room.buildSeatSetups() });
      tablesByRoom.set(room.roomId, table);
      room.start();
      broadcastRoomState(room);
      broadcastTableState(room.roomId);
      return;
    }

    case 'action': {
      const room = requireRoom(socket, state);
      if (!room || !state.playerId) return;
      const table = tablesByRoom.get(room.roomId);
      if (!table) {
        send(socket, { t: 'rejected', clientSeq: raw.clientSeq, reason: 'game has not started' });
        return;
      }
      const result = applyAction(table, raw.action);
      if (!result.ok) {
        send(socket, { t: 'rejected', clientSeq: raw.clientSeq, reason: result.reason });
        return;
      }
      tablesByRoom.set(room.roomId, result.state);
      broadcastTableState(room.roomId);
      return;
    }

    case 'ping': {
      send(socket, { t: 'pong' });
      return;
    }
  }
}

function requireRoom(socket: WebSocket, state: ConnectionState): Room | undefined {
  if (!state.roomId) {
    send(socket, { t: 'error', message: 'not in a room' });
    return undefined;
  }
  const room = roomManager.getRoom(state.roomId);
  if (!room) {
    send(socket, { t: 'error', message: 'room not found' });
    return undefined;
  }
  return room;
}

const httpServer = createServer((req, res) => {
  if (req.method === 'POST' && req.url === '/api/rooms') {
    const room = roomManager.createRoom();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ roomId: room.roomId }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

wss.on('connection', (socket) => {
  const state: ConnectionState = { roomId: null, playerId: null };

  socket.on('message', (data) => {
    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(data.toString());
    } catch {
      send(socket, { t: 'error', message: 'malformed message' });
      return;
    }
    handleMessage(socket, state, parsed);
  });

  socket.on('close', () => {
    if (state.roomId && state.playerId) {
      const room = roomManager.getRoom(state.roomId);
      unregisterSocket(state.roomId, state.playerId, socket);
      if (room) {
        room.setConnected(state.playerId, false);
        broadcastRoomState(room);
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`Command Table server listening on :${PORT}`);
});
