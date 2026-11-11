// Thin client-side mirror of server state: no complex local logic needed.
// The store just holds the last message of each kind and exposes `send`; every screen renders
// straight off it. No optimistic updates — we wait for the server's next 'state'/'room'.
//
// The one piece of real logic here is the connection lifecycle. A dropped socket
// reconnects on its own and replays the stored rejoin token, so a Wi-Fi blip, a laptop waking up,
// or the host restarting their server all recover without anyone touching the page.
//
// The change pulse is the one exception to "no complex local logic". In a client with no rules
// enforcement, shared attention is the product — four people must agree on what just happened —
// and only the client can work out which objects the last action touched from what it was
// actually sent, so nothing it may not see can leak through the highlight (see tableChanges.ts).

import { create } from 'zustand';
import { SUPERSEDED } from '@command-table/common';
import type {
  Action,
  ClientMessage,
  ClientTableState,
  DeckWarningKind,
  ObjectId,
  PlayerId,
  RoomState,
  UnresolvedLine,
} from '@command-table/common';
import { WS_URL } from './api.js';
import { changedObjectIds } from './tableChanges.js';
import { nextDelay } from './backoff.js';
import { clearSession, loadSession, saveSession, type StoredSession } from './session.js';
import { undoOutcomeText } from './undoPrompt.js';

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
  approvals: number;
  needed: number;
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
  /** Something the table should hear about that isn't an error — how an undo vote ended. */
  notice: string | null;
  pendingUndoRequest: UndoRequest | null;
  /** What the last action touched, and the revision it touched it in — the pulse's remount key. */
  changedIds: Set<ObjectId>;
  changeRevision: number;

  join(roomId: string, displayName: string, secret: string): void;
  resume(session: StoredSession): void;
  leave(): void;
  endGame(): void;
  send(message: ClientMessage): void;
  act(action: Action): void;
  showError(message: string): void;
  dismissError(): void;
  dismissNotice(): void;
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

    ws.onclose = (event) => {
      // A superseded socket closing is expected and means nothing: it must not reconnect, and it
      // must not report the live connection as down.
      if (!isCurrent()) return;
      stopTimers();
      // The server gave this seat to another socket — this seat open in another tab, most likely.
      // Reconnecting would take it back, and that tab would take it back again, forever.
      if (event.code === SUPERSEDED) {
        set({ status: 'offline', errorMessage: 'This seat was opened somewhere else, so this tab stopped. Reload to sit here again.' });
        return;
      }
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
          // A vote is the server's to re-send if it is still open (progressUndo on join); one held
          // over from before the reconnect may have been settled, or lost with a restart.
          set({
            roomId: creds.roomId,
            playerId: msg.playerId,
            roomState: msg.roomState,
            displayName: creds.displayName,
            pendingUndoRequest: null,
          });
          break;
        case 'room':
          // A room that isn't started has no table. Someone who was away when the host ended the
          // game never gets `gameEnded`, and kept rendering the old table, every action rejected.
          set(msg.roomState.started ? { roomState: msg.roomState } : { roomState: msg.roomState, tableState: null });
          break;
        // A refused action is surfaced, not dropped — a stale card or a finished game
        // otherwise looks like a frozen table.
        // The server's reason is written for the log ("no such object: 3f2a…"); the player gets what
        // it means for them, which is nearly always that the table moved under a stale click.
        case 'rejected':
          console.warn('action rejected:', msg.reason);
          set({ errorMessage: 'That didn’t go through: the table had already changed. Try again.' });
          break;
        case 'state':
          set({
            tableState: msg.state,
            changedIds: changedObjectIds(get().tableState?.objects ?? {}, msg.state.objects),
            changeRevision: msg.state.revision,
          });
          break;
        case 'deckResult':
          set({ deckResult: { warnings: msg.warnings, unresolved: msg.unresolved } });
          break;
        case 'undoRequest':
          set({
            pendingUndoRequest: {
              requesterId: msg.requesterId,
              targetRevision: msg.targetRevision,
              describes: msg.describes,
              approvals: msg.approvals,
              needed: msg.needed,
            },
          });
          break;
        case 'undoResolved': {
          // Only a vote gets an announcement: an instant self-undo had no prompt, and its revert is
          // on the table for everyone to see.
          const request = get().pendingUndoRequest;
          const players = get().tableState?.players ?? [];
          set({
            pendingUndoRequest: null,
            ...(request ? { notice: undoOutcomeText(msg.outcome, request, players, get().playerId) } : {}),
          });
          break;
        }
        // The game ended but the room didn't: App's routing renders the lobby as soon as
        // tableState clears, and the `room` broadcast just before this refreshed the seats.
        //
        // deckResult goes with it. It describes a deck submitted for the game that just ended,
        // and the server has un-submitted that deck (Room.endGame), so leaving "Deck resolved
        // with no warnings" on screen would be reporting on a submission that no longer exists.
        case 'gameEnded':
          set({ tableState: null, pendingUndoRequest: null, deckResult: null });
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
    notice: null,
    pendingUndoRequest: null,
    changedIds: new Set(),
    changeRevision: 0,

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

    dismissNotice() {
      set({ notice: null });
    },
  };
});
