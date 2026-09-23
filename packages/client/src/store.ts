// Thin client-side mirror of server state, per design doc §4: "no complex local logic needed."
// The store just holds the last message of each kind and exposes `send`; every screen renders
// straight off it. No optimistic updates (§3.1) — we wait for the server's next 'state'/'room'.
//
// The one piece of real logic here is the connection lifecycle (§14.2). A dropped socket
// reconnects on its own and replays the stored rejoin token, so a Wi-Fi blip, a laptop waking up,
// or the host restarting their server all recover without anyone touching the page.

import { create } from 'zustand';
import type {
  Action,
  ClientMessage,
  ClientTableState,
  DeckWarningKind,
  PlayerId,
  RoomState,
  UnresolvedLine,
} from '@command-table/common';
import { WS_URL } from './api.js';
import { nextDelay } from './backoff.js';
import { clearSession, loadSession, saveSession, type StoredSession } from './session.js';

export { storedSecret } from './session.js';

const HEARTBEAT_MS = 20_000;
const PONG_TIMEOUT_MS = 10_000;

interface DeckResult {
  warnings: DeckWarningKind[];
  unresolved: UnresolvedLine[];
}

interface UndoRequest {
  requesterId: PlayerId;
  targetRevision: number;
  describes: string;
}

export type ConnectionStatus = 'offline' | 'connecting' | 'live' | 'reconnecting';

interface Store {
  ws: WebSocket | null;
  status: ConnectionStatus;
  roomId: string | null;
  playerId: PlayerId | null;
  displayName: string;
  roomState: RoomState | null;
  tableState: ClientTableState | null;
  deckResult: DeckResult | null;
  errorMessage: string | null;
  pendingUndoRequest: UndoRequest | null;

  join(roomId: string, displayName: string, secret: string): void;
  resume(session: StoredSession): void;
  leave(): void;
  endGame(): void;
  send(message: ClientMessage): void;
  act(action: Action): void;
  showError(message: string): void;
  dismissError(): void;
}

let nextClientSeq = 1;

// Connection bookkeeping lives outside the store: it is machinery, not something a component
// renders, and keeping it here avoids re-render churn on every heartbeat.
let credentials: StoredSession | null = null;
let attempt = 0;
let deliberate = false;
// Every connection attempt takes a number, and only the newest one may touch the store. Without
// this, a socket that has been superseded — by a second join, or by React's StrictMode running
// App's resume effect twice in dev — stays live and races the real one; the last 'joined' to
// arrive wins, which is how you end up seated in a room you didn't ask for.
let generation = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
let pongTimer: ReturnType<typeof setTimeout> | undefined;

function stopTimers(): void {
  clearTimeout(reconnectTimer);
  clearInterval(heartbeatTimer);
  clearTimeout(pongTimer);
  reconnectTimer = undefined;
  heartbeatTimer = undefined;
  pongTimer = undefined;
}

export const useStore = create<Store>((set, get) => {
  function connect(): void {
    const creds = credentials;
    if (!creds) return;

    const myGeneration = ++generation;
    const isCurrent = () => myGeneration === generation;

    // Whatever we were connected to before is not where we are going now.
    get().ws?.close();

    set({ status: attempt === 0 ? 'connecting' : 'reconnecting' });
    const ws = new WebSocket(WS_URL);

    ws.onopen = () => {
      if (!isCurrent()) return ws.close();
      attempt = 0;
      set({ status: 'live' });
      ws.send(
        JSON.stringify({
          t: 'join',
          roomId: creds.roomId,
          displayName: creds.displayName,
          secret: creds.secret,
          rejoinToken: creds.rejoinToken || undefined,
        }),
      );

      // A sleeping laptop often leaves a half-open socket that never fires onclose, so waiting
      // for one would strand the player. The ping/pong pair already existed in the protocol.
      heartbeatTimer = setInterval(() => {
        ws.send(JSON.stringify({ t: 'ping' }));
        pongTimer = setTimeout(() => ws.close(), PONG_TIMEOUT_MS);
      }, HEARTBEAT_MS);
    };

    ws.onclose = () => {
      // A superseded socket closing is expected and means nothing: it must not reconnect, and it
      // must not report the live connection as down.
      if (!isCurrent()) return;
      stopTimers();
      if (deliberate || !credentials) {
        set({ status: 'offline' });
        return;
      }
      set({ status: 'reconnecting' });
      reconnectTimer = setTimeout(connect, nextDelay(attempt++));
    };

    ws.onmessage = (event) => {
      if (!isCurrent()) return;
      const msg = JSON.parse(event.data);
      switch (msg.t) {
        case 'joined':
          credentials = { ...creds, rejoinToken: msg.rejoinToken };
          saveSession(credentials);
          set({ roomId: creds.roomId, playerId: msg.playerId, roomState: msg.roomState, displayName: creds.displayName });
          break;
        case 'room':
          set({ roomState: msg.roomState });
          break;
        case 'state':
          set({ tableState: msg.state });
          break;
        case 'deckResult':
          set({ deckResult: { warnings: msg.warnings, unresolved: msg.unresolved } });
          break;
        case 'undoRequest':
          set({ pendingUndoRequest: { requesterId: msg.requesterId, targetRevision: msg.targetRevision, describes: msg.describes } });
          break;
        case 'undoResolved':
          set({ pendingUndoRequest: null });
          break;
        // The game ended but the room didn't: App's routing renders the lobby as soon as
        // tableState clears, and the `room` broadcast just before this refreshed the seats.
        // deckResult is kept deliberately — the lobby shows those warnings.
        case 'gameEnded':
          set({ tableState: null, pendingUndoRequest: null });
          break;
        case 'pong':
          clearTimeout(pongTimer);
          break;
        case 'error':
          // The saved seat is gone (stale token, or the room outlived its TTL). Retrying would
          // fail identically forever, so drop the session and send them back to Home.
          if (msg.code === 'rejoin-failed') {
            get().leave();
          }
          set({ errorMessage: msg.message });
          break;
      }
    };

    set({ ws });
  }

  return {
    ws: null,
    status: 'offline',
    roomId: null,
    playerId: null,
    displayName: '',
    roomState: null,
    tableState: null,
    deckResult: null,
    errorMessage: null,
    pendingUndoRequest: null,

    join(roomId, displayName, secret) {
      const existing = loadSession()?.session;
      // Only reuse a token that belongs to the room being joined — otherwise a leftover token
      // from an earlier table would be offered as credentials for this one.
      const rejoinToken = existing?.roomId === roomId ? existing.rejoinToken : '';
      get().resume({ roomId, displayName, secret, rejoinToken });
    },

    resume(session) {
      stopTimers();
      deliberate = false;
      attempt = 0;
      credentials = session;
      connect();
    },

    leave() {
      deliberate = true;
      credentials = null;
      generation++;
      stopTimers();
      clearSession();
      get().ws?.close();
      set({
        ws: null,
        status: 'offline',
        roomId: null,
        playerId: null,
        roomState: null,
        tableState: null,
        deckResult: null,
        pendingUndoRequest: null,
      });
    },

    endGame() {
      get().send({ t: 'endGame' });
    },

    send(message) {
      get().ws?.send(JSON.stringify(message));
    },

    act(action) {
      get().send({ t: 'action', action, clientSeq: nextClientSeq++ });
    },

    showError(message) {
      set({ errorMessage: message });
    },

    dismissError() {
      set({ errorMessage: null });
    },
  };
});
