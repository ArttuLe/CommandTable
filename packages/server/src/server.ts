// Server: lobby plus in-game table state. 'start' builds the initial TableState from each seat's
// resolved decklist; 'action' applies actions to it. Every outbound table snapshot goes through
// projectFor — never send a TableState raw.

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
import { TableHistory } from './tableHistory.js';
import { applyUndo, tallyUndoVotes } from './undo.js';
import { checkSecret, resolveHostSecret } from './hostSecret.js';
import { SESSION_TTL_MS, SessionStore, type SessionEntry } from './sessionStore.js';
import { buildDevTable, devSeatName, MAX_DEV_PLAYERS, MIN_DEV_PLAYERS } from './devtest/devTable.js';
import { parseClientMessage } from './clientMessage.js';
import { SUPERSEDED } from '@command-table/common';

const PORT = Number(process.env.PORT ?? 8080);
const DB_PATH = process.env.CARD_DB_PATH ?? './data/cards.sqlite3';
const SESSION_PATH = process.env.SESSION_PATH ?? './data/sessions.json';
// Set only by `npm run dev` (scripts/dev.ts). It drops the passphrase and opens /api/devtest —
// both things that must never be true on a machine hosting a real game.
const DEV_MODE = process.env.DEV_MODE === '1';

const cardIndex = new CardIndex(new Database(DB_PATH, { readonly: true }));
const roomManager = new RoomManager();
const socketsByRoom = new Map<RoomId, Map<PlayerId, WebSocket>>();
const tablesByRoom = new Map<RoomId, TableState>();
const historiesByRoom = new Map<RoomId, TableHistory>();
// When anyone in each room last did anything: what a saved room's age is measured by, and what
// the sweep below forgets idle rooms by.
const lastActivityByRoom = new Map<RoomId, number>();

// Saved games. The callback is what gets written on every markDirty — the whole file is
// rewritten from live state each time, so there is nothing to keep in sync by hand.
const sessions = new SessionStore(SESSION_PATH, () => ({
  hostSecret: HOST_SECRET,
  entries: [...roomManager.allRooms()].map((room): SessionEntry => ({
    room,
    table: tablesByRoom.get(room.roomId) ?? null,
    lastActivityAt: lastActivityByRoom.get(room.roomId) ?? Date.now(),
  })),
}));

// Loading has to come before the secret is resolved: the passphrase a previous run generated is
// saved alongside the games, and reusing it is what makes a restart invisible to the players
// still holding it.
const restored = sessions.load();
const HOST_SECRET = resolveHostSecret(process.env, restored?.hostSecret);

if (restored) {
  roomManager.restore(Object.values(restored.sessions).map((s) => s.room));
  for (const saved of Object.values(restored.sessions)) lastActivityByRoom.set(saved.room.roomId, saved.savedAt);
  for (const saved of Object.values(restored.sessions)) {
    if (!saved.table) continue;
    tablesByRoom.set(saved.room.roomId, saved.table);
    // History starts fresh from the restore point — snapshots aren't persisted (see
    // sessionStore.ts), so you can undo back to the restart but not past it.
    historiesByRoom.set(saved.room.roomId, new TableHistory(saved.table));
  }
}

// A rewind (rolling back further, or after others have acted) needs majority consent of
// connected players: the `undoRequest` broadcast puts it to the table, and `votes` collects the
// answers (see protocol.ts's `undoVote`/`undoResolved`).
interface PendingUndo {
  targetRevision: number;
  requesterId: PlayerId;
  votes: Map<PlayerId, boolean>;
}
const pendingUndosByRoom = new Map<RoomId, PendingUndo>();

// Rooms nobody has touched for a day, with nobody connected, are forgotten: from memory as well as
// from the save file, which only skips them (sessionStore.ts). Rooms used to live for as long as
// the process did.
setInterval(() => {
  const now = Date.now();
  for (const room of [...roomManager.allRooms()]) {
    const idle = now - (lastActivityByRoom.get(room.roomId) ?? now) > SESSION_TTL_MS;
    if (!idle || (socketsByRoom.get(room.roomId)?.size ?? 0) > 0) continue;
    roomManager.removeRoom(room.roomId);
    for (const byRoom of [tablesByRoom, historiesByRoom, pendingUndosByRoom, socketsByRoom, lastActivityByRoom]) byRoom.delete(room.roomId);
    sessions.markDirty();
  }
}, 60 * 60 * 1000).unref();

// One shared dev table per player count, so a second tab at /devtest/4/Bob sits down with the
// /devtest/4/Alice already open rather than at a table of its own.
const devRoomsByCount = new Map<number, { roomId: RoomId; rejoinTokensByName: Map<string, string> }>();

function authorized(provided: string | undefined): boolean {
  return DEV_MODE || checkSecret(HOST_SECRET, provided);
}

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
  // One socket per seat. The one being replaced — a laptop's half-open socket from before it
  // slept, or the same seat open in another tab — is closed with SUPERSEDED rather than left
  // open: left alone it closed minutes later and marked the live seat disconnected, and the
  // client treats this code as "stop", so two tabs don't take the seat back and forth.
  const previous = sockets.get(playerId);
  if (previous && previous !== socket) previous.close(SUPERSEDED, 'seat opened elsewhere');
  sockets.set(playerId, socket);
}

/** Whether `socket` was the seat's live one. A superseded socket closing says nothing about the seat. */
function unregisterSocket(roomId: RoomId, playerId: PlayerId, socket: WebSocket): boolean {
  const sockets = socketsByRoom.get(roomId);
  if (sockets?.get(playerId) !== socket) return false;
  sockets.delete(playerId);
  return true;
}

function handleMessage(socket: WebSocket, state: ConnectionState, raw: ClientMessage): void {
  switch (raw.t) {
    case 'join': {
      if (!authorized(raw.secret)) {
        send(socket, { t: 'error', message: 'That passphrase isn’t this table’s. Ask whoever is hosting for it.' });
        return;
      }
      const room = roomManager.getRoom(raw.roomId);
      if (!room) {
        // Tagged only when they were trying to resume: a client holding a stale token needs to
        // clear it and start over, where someone mistyping a room code just needs the toast.
        send(socket, { t: 'error', message: 'No room has that code. Check it with whoever is hosting.', code: raw.rejoinToken ? 'rejoin-failed' : undefined });
        return;
      }
      const result = room.join({ displayName: raw.displayName, seat: raw.seat, rejoinToken: raw.rejoinToken });
      if (!result.ok) {
        send(socket, { t: 'error', message: result.reason, code: raw.rejoinToken ? 'rejoin-failed' : undefined });
        return;
      }
      state.roomId = room.roomId;
      state.playerId = result.playerId;
      lastActivityByRoom.set(room.roomId, Date.now());
      registerSocket(room.roomId, result.playerId, socket);
      send(socket, { t: 'joined', playerId: result.playerId, roomState: room.toState(), rejoinToken: result.rejoinToken });
      broadcastRoomState(room);
      sessions.markDirty();
      if (tablesByRoom.has(room.roomId)) {
        send(socket, { t: 'state', state: projectFor(tablesByRoom.get(room.roomId)!, result.playerId) });
      }
      // A returning player changes the tally, and has to be shown a vote that opened while they
      // were away — or nobody can vote on it, and the requester can't ask again until someone acts.
      progressUndo(room);
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
      sessions.markDirty();
      return;
    }

    case 'ready': {
      const room = requireRoom(socket, state);
      if (!room || !state.playerId) return;
      room.setReady(state.playerId, raw.ready);
      broadcastRoomState(room);
      sessions.markDirty();
      return;
    }

    case 'start': {
      const room = requireRoom(socket, state);
      if (!room || !state.playerId) return;
      if (!room.isHost(state.playerId)) {
        send(socket, { t: 'error', message: 'Only the host can start the game.' });
        return;
      }
      if (!room.canStart()) {
        send(socket, { t: 'error', message: 'Two players need to be seated before the game can start.' });
        return;
      }
      const table = createTableState({ roomId: room.roomId, seats: room.buildSeatSetups() });
      tablesByRoom.set(room.roomId, table);
      historiesByRoom.set(room.roomId, new TableHistory(table));
      room.start();
      broadcastRoomState(room);
      broadcastTableState(room.roomId);
      sessions.markDirty();
      return;
    }

    case 'action': {
      const room = requireRoom(socket, state);
      if (!room || !state.playerId) return;
      const table = tablesByRoom.get(room.roomId);
      const history = historiesByRoom.get(room.roomId);
      if (!table || !history) {
        send(socket, { t: 'rejected', clientSeq: raw.clientSeq, reason: 'game has not started' });
        return;
      }
      const result = applyAction(table, raw.action, state.playerId);
      if (!result.ok) {
        send(socket, { t: 'rejected', clientSeq: raw.clientSeq, reason: result.reason });
        return;
      }
      // Nothing changed, so there is nothing to record, broadcast or save (see applyAction).
      if (result.state === table) return;
      tablesByRoom.set(room.roomId, result.state);
      history.record(state.playerId, result.state);
      // A pending rewind was aimed at a revision older than this action; letting it resolve later
      // would silently discard this action too. Cancel the vote instead of moving its target.
      cancelPendingUndo(room.roomId);
      broadcastTableState(room.roomId);
      sessions.markDirty();
      return;
    }

    case 'undo': {
      const room = requireRoom(socket, state);
      if (!room || !state.playerId) return;
      const table = tablesByRoom.get(room.roomId);
      const history = historiesByRoom.get(room.roomId);
      if (!table || !history) {
        send(socket, { t: 'error', message: 'The game hasn’t started yet.' });
        return;
      }
      // One question at a time: a second rewind would either overwrite the pending one — leaving
      // the other players voting on a prompt whose votes no longer count — or have to be computed
      // against a target the pending vote is about to move. Saying no is the honest answer.
      if (pendingUndosByRoom.has(room.roomId)) {
        send(socket, { t: 'error', message: 'An undo vote is already under way. Wait for the table to settle it first.' });
        return;
      }

      // Where one step back lands is the history's to answer, not the client's: a revert carries
      // older content under a newer revision number (see tableHistory.ts).
      const targetRevision = history.undoTarget();
      if (targetRevision < history.initialRevision()) {
        send(socket, { t: 'error', message: 'There’s nothing left to undo.' });
        return;
      }
      const target = history.snapshotAt(targetRevision);
      if (!target) {
        send(socket, { t: 'error', message: 'That’s further back than undo can reach.' });
        return;
      }

      if (history.canSelfUndo(state.playerId)) {
        performUndo(room, table, target, state.playerId);
        return;
      }

      pendingUndosByRoom.set(room.roomId, {
        targetRevision,
        requesterId: state.playerId,
        votes: new Map([[state.playerId, true]]),
      });
      progressUndo(room);
      return;
    }

    case 'undoVote': {
      const room = requireRoom(socket, state);
      if (!room || !state.playerId) return;
      const pending = pendingUndosByRoom.get(room.roomId);
      if (!pending || pending.targetRevision !== raw.targetRevision) return;

      pending.votes.set(state.playerId, raw.approve);
      progressUndo(room);
      return;
    }

    // Ends the game, not the room. Everyone stays seated with their resolved decklist and drops
    // back to this room's lobby, so the same table can start another game without re-entering a
    // room code, passphrase, or decklist.
    case 'endGame': {
      const room = requireRoom(socket, state);
      if (!room || !state.playerId) return;
      if (!room.isHost(state.playerId)) {
        send(socket, { t: 'error', message: 'Only the host can end the game.' });
        return;
      }
      room.endGame();
      tablesByRoom.delete(room.roomId);
      historiesByRoom.delete(room.roomId);
      pendingUndosByRoom.delete(room.roomId);
      broadcastRoomState(room);
      broadcastToRoom(room.roomId, { t: 'gameEnded' });
      sessions.markDirty();
      return;
    }

    // Host's escape hatch for a seat left behind by someone who is not coming back under the
    // same name. Lobby only — mid-game a disconnected seat is sacred.
    case 'freeSeat': {
      const room = requireRoom(socket, state);
      if (!room || !state.playerId) return;
      if (!room.isHost(state.playerId)) {
        send(socket, { t: 'error', message: 'Only the host can free a seat.' });
        return;
      }
      if (room.toState().started) {
        send(socket, { t: 'error', message: 'Seats can’t be freed once the game has started.' });
        return;
      }
      if (!room.freeSeat(raw.seat)) {
        send(socket, { t: 'error', message: 'Only a disconnected player’s seat can be freed.' });
        return;
      }
      broadcastRoomState(room);
      sessions.markDirty();
      return;
    }

    case 'ping': {
      send(socket, { t: 'pong' });
      return;
    }
  }
}

function performUndo(room: Room, current: TableState, target: TableState, actorId: PlayerId): void {
  const outcome = applyUndo(current, target, actorId);
  tablesByRoom.set(room.roomId, outcome.state);
  historiesByRoom.get(room.roomId)?.recordRevert(actorId, outcome.state, target.revision);
  broadcastTableState(room.roomId);
  broadcastToRoom(room.roomId, { t: 'undoResolved', targetRevision: target.revision, outcome: 'applied' });
  sessions.markDirty();
}

/**
 * Settles a pending rewind if its ballots now decide it, and otherwise tells the whole table where
 * it stands — the requester too, who used to be sent nothing and could only guess. Run when the
 * vote opens as well as on every ballot: the requester's own approval can already be a majority.
 */
function progressUndo(room: Room): void {
  const pending = pendingUndosByRoom.get(room.roomId);
  if (!pending) return;
  const connected = new Set(room.toState().seats.flatMap((s) => (s.connected && s.playerId ? [s.playerId] : [])));
  // A vote whose requester has left has nobody to want it any more.
  if (!connected.has(pending.requesterId)) {
    pendingUndosByRoom.delete(room.roomId);
    broadcastToRoom(room.roomId, { t: 'undoResolved', targetRevision: pending.targetRevision, outcome: 'cancelled' });
    return;
  }
  const { approvals, needed, outcome } = tallyUndoVotes(pending.votes, connected);

  if (outcome === 'pending') {
    broadcastToRoom(room.roomId, {
      t: 'undoRequest',
      requesterId: pending.requesterId,
      targetRevision: pending.targetRevision,
      describes: `revert the table to revision ${pending.targetRevision}`,
      approvals,
      needed,
    });
    return;
  }

  pendingUndosByRoom.delete(room.roomId);
  const table = tablesByRoom.get(room.roomId);
  const target = historiesByRoom.get(room.roomId)?.snapshotAt(pending.targetRevision);
  if (outcome === 'applied' && table && target) {
    performUndo(room, table, target, pending.requesterId);
    return;
  }
  // A target that fell out of history can't be applied; saying so beats leaving the prompt up.
  broadcastToRoom(room.roomId, {
    t: 'undoResolved',
    targetRevision: pending.targetRevision,
    outcome: outcome === 'rejected' ? 'rejected' : 'cancelled',
  });
}

// Clients drop their prompt on `undoResolved` (store.ts), so an unapplied resolution is how a
// vote gets taken off everyone's screen.
function cancelPendingUndo(roomId: RoomId): void {
  const pending = pendingUndosByRoom.get(roomId);
  if (!pending) return;
  pendingUndosByRoom.delete(roomId);
  broadcastToRoom(roomId, { t: 'undoResolved', targetRevision: pending.targetRevision, outcome: 'cancelled' });
}

function broadcastToRoom(roomId: RoomId, message: ServerMessage): void {
  const sockets = socketsByRoom.get(roomId);
  if (!sockets) return;
  for (const socket of sockets.values()) {
    send(socket, message);
  }
}

function requireRoom(socket: WebSocket, state: ConnectionState): Room | undefined {
  if (!state.roomId) {
    send(socket, { t: 'error', message: 'You’re not in a room. Join one from the start screen.' });
    return undefined;
  }
  const room = roomManager.getRoom(state.roomId);
  if (!room) {
    send(socket, { t: 'error', message: 'This room has closed. Join again from the start screen.' });
    return undefined;
  }
  return room;
}

const httpServer = createServer((req, res) => {
  // Permissive CORS: this is a private, non-commercial, known-friend-group
  // tool, and the client is served from a different origin (Vite's port) than this one, on a
  // hostname that varies with whoever is hosting. An origin allowlist can't be written down
  // ahead of time; the passphrase below is what actually gates access.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'X-Host-Secret');

  // The passphrase header makes room creation a non-simple request, so the browser preflights it.
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/rooms') {
    if (!authorized(req.headers['x-host-secret'] as string | undefined)) {
      res.writeHead(403);
      res.end();
      return;
    }
    const room = roomManager.createRoom();
    lastActivityByRoom.set(room.roomId, Date.now());
    // Saved straight away, so a room made just before a restart is still there after it.
    sessions.markDirty();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ roomId: room.roomId }));
    return;
  }

  const cardMatch = req.method === 'GET' && req.url?.match(/^\/api\/cards\/([^/]+)$/);
  if (cardMatch) {
    let scryfallId: string;
    try {
      scryfallId = decodeURIComponent(cardMatch[1]);
    } catch {
      // A malformed escape threw out of the request handler and took the server down with it.
      res.writeHead(400);
      res.end();
      return;
    }
    const card = cardIndex.findByScryfallId(scryfallId);
    if (!card) {
      res.writeHead(404);
      res.end();
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(card));
    return;
  }

  const devMatch = DEV_MODE && req.method === 'GET' && req.url?.match(/^\/api\/devtest\/(\d+)\/([^/?]+)$/);
  if (devMatch) {
    const playerAmount = Number(devMatch[1]);
    let requested: string;
    try {
      requested = decodeURIComponent(devMatch[2]);
    } catch {
      res.writeHead(400);
      res.end();
      return;
    }
    const seatName = devSeatName(playerAmount, requested);
    if (playerAmount < MIN_DEV_PLAYERS || playerAmount > MAX_DEV_PLAYERS || !seatName) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ message: `dev tables seat ${MIN_DEV_PLAYERS}-${MAX_DEV_PLAYERS} players, named in order from Alice` }));
      return;
    }
    const dev = devTableFor(playerAmount);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ roomId: dev.roomId, displayName: seatName, rejoinToken: dev.rejoinTokensByName.get(seatName) }));
    return;
  }

  res.writeHead(404);
  res.end();
});

// Built on first ask and kept until the room goes away (a server restart with no dev session
// file, say) — rebuilding per request would put every tab at a different table.
function devTableFor(playerAmount: number): { roomId: RoomId; rejoinTokensByName: Map<string, string> } {
  const existing = devRoomsByCount.get(playerAmount);
  if (existing && roomManager.getRoom(existing.roomId)) return existing;

  const { room, table, rejoinTokensByName } = buildDevTable(playerAmount, { roomManager, cardIndex });
  tablesByRoom.set(room.roomId, table);
  historiesByRoom.set(room.roomId, new TableHistory(table));
  const entry = { roomId: room.roomId, rejoinTokensByName };
  devRoomsByCount.set(playerAmount, entry);
  sessions.markDirty();
  return entry;
}

// 1 MiB: the largest real message is a decklist, and ws's 100 MiB default is parsed before any auth.
const wss = new WebSocketServer({ server: httpServer, path: '/ws', maxPayload: 1024 * 1024 });

// A socket whose far end died — a laptop that lost power, a network that went away — never errors
// until a write times out, which on an idle table can be never. Its seat stayed "connected": the
// host couldn't free it, its player couldn't reclaim it by name, and it counted in undo votes.
// So every socket is pinged (browsers answer at the protocol level) and one that misses a whole
// round is cut, which runs the close handler like any other disconnect.
const HEARTBEAT_MS = 20_000;
const answeredLastPing = new WeakSet<WebSocket>();
setInterval(() => {
  for (const socket of wss.clients) {
    if (!answeredLastPing.has(socket)) {
      socket.terminate();
      continue;
    }
    answeredLastPing.delete(socket);
    socket.ping();
  }
}, HEARTBEAT_MS).unref();

wss.on('connection', (socket) => {
  const state: ConnectionState = { roomId: null, playerId: null };
  answeredLastPing.add(socket);
  socket.on('pong', () => answeredLastPing.add(socket));

  socket.on('message', (data) => {
    const parsed = parseClientMessage(data.toString());
    if (!parsed) {
      send(socket, { t: 'error', message: 'malformed message' });
      return;
    }
    if (state.roomId && parsed.t !== 'ping') lastActivityByRoom.set(state.roomId, Date.now());
    // The last line of defence: whatever a handler still throws on costs this message, not the
    // process — and with the process, every game this server is hosting.
    try {
      handleMessage(socket, state, parsed);
    } catch (e) {
      console.error('message handler failed:', e);
      send(socket, { t: 'error', message: 'The server couldn’t handle that. Try again.' });
    }
  });

  socket.on('close', () => {
    if (state.roomId && state.playerId) {
      const room = roomManager.getRoom(state.roomId);
      const wasLive = unregisterSocket(state.roomId, state.playerId, socket);
      if (room && wasLive) {
        room.setConnected(state.playerId, false);
        broadcastRoomState(room);
        // Fewer connected players can settle a vote that was waiting on them.
        progressUndo(room);
      }
    }
  });
});

// Ctrl-C on `npm run host` shouldn't cost the last second of play.
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    sessions.flush();
    process.exit(0);
  });
}

httpServer.listen(PORT, () => {
  console.log(`Command Table server listening on :${PORT}`);
  const restoredCount = Object.keys(restored?.sessions ?? {}).length;
  if (restoredCount > 0) {
    console.log(`Restored ${restoredCount} saved table(s) from ${SESSION_PATH}`);
  }
  if (DEV_MODE) {
    console.log('DEV_MODE: no passphrase required, /api/devtest is open');
  } else {
    console.log(`Passphrase: ${HOST_SECRET}  (share it with your table; set HOST_SECRET to choose your own)`);
  }
});
