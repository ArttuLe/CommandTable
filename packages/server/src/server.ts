// Phase 1 server: room/lobby over HTTP + WebSocket, per design doc §11 and §14.1.
// Game-table state (§7) doesn't exist yet — 'start' only flips the lobby's `started` flag.

import { createServer } from 'node:http';
import { WebSocketServer, type WebSocket } from 'ws';
import Database from 'better-sqlite3';
import type { ClientMessage, PlayerId, RoomId, ServerMessage } from '@command-table/common';
import { CardIndex } from './cardIndex.js';
import { parseDecklist } from './decklistParser.js';
import { resolveDecklist } from './deckResolver.js';
import { deckStatusFrom } from './deckStatus.js';
import { Room, RoomManager } from './roomManager.js';

const PORT = Number(process.env.PORT ?? 8080);
const DB_PATH = process.env.CARD_DB_PATH ?? './data/cards.sqlite3';

const cardIndex = new CardIndex(new Database(DB_PATH, { readonly: true }));
const roomManager = new RoomManager();
const socketsByRoom = new Map<RoomId, Set<WebSocket>>();

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
  for (const socket of sockets) {
    send(socket, message);
  }
}

function registerSocket(roomId: RoomId, socket: WebSocket): void {
  let sockets = socketsByRoom.get(roomId);
  if (!sockets) {
    sockets = new Set();
    socketsByRoom.set(roomId, sockets);
  }
  sockets.add(socket);
}

function unregisterSocket(roomId: RoomId, socket: WebSocket): void {
  socketsByRoom.get(roomId)?.delete(socket);
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
      registerSocket(room.roomId, socket);
      send(socket, { t: 'joined', roomState: room.toState(), rejoinToken: result.rejoinToken });
      broadcastRoomState(room);
      return;
    }

    case 'deck': {
      const room = requireRoom(socket, state);
      if (!room || !state.playerId) return;
      const parsed = parseDecklist(raw.list);
      const resolved = resolveDecklist(parsed, cardIndex);
      room.setDeckStatus(state.playerId, deckStatusFrom(resolved));
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
      room.start();
      broadcastRoomState(room);
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
      unregisterSocket(state.roomId, socket);
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
