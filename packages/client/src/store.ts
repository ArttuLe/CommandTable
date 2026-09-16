// Thin client-side mirror of server state, per design doc §4: "no complex local logic needed."
// The store just holds the last message of each kind and exposes `send`; every screen renders
// straight off it. No optimistic updates (§3.1) — we wait for the server's next 'state'/'room'.

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

const REJOIN_TOKEN_KEY = 'command-table-rejoin-token';
const ROOM_ID_KEY = 'command-table-room-id';

interface DeckResult {
  warnings: DeckWarningKind[];
  unresolved: UnresolvedLine[];
}

interface UndoRequest {
  requesterId: PlayerId;
  targetRevision: number;
  describes: string;
}

interface Store {
  ws: WebSocket | null;
  connected: boolean;
  roomId: string | null;
  playerId: PlayerId | null;
  displayName: string;
  roomState: RoomState | null;
  tableState: ClientTableState | null;
  deckResult: DeckResult | null;
  errorMessage: string | null;
  pendingUndoRequest: UndoRequest | null;

  join(roomId: string, displayName: string): void;
  send(message: ClientMessage): void;
  act(action: Action): void;
  dismissError(): void;
}

let nextClientSeq = 1;

export const useStore = create<Store>((set, get) => ({
  ws: null,
  connected: false,
  roomId: null,
  playerId: null,
  displayName: '',
  roomState: null,
  tableState: null,
  deckResult: null,
  errorMessage: null,
  pendingUndoRequest: null,

  join(roomId, displayName) {
    const ws = new WebSocket(WS_URL);
    const rejoinToken = sessionStorage.getItem(REJOIN_TOKEN_KEY) ?? undefined;
    const knownRoomId = sessionStorage.getItem(ROOM_ID_KEY);
    const rejoining = rejoinToken && knownRoomId === roomId;

    ws.onopen = () => {
      set({ connected: true });
      ws.send(JSON.stringify({ t: 'join', roomId, displayName, rejoinToken: rejoining ? rejoinToken : undefined }));
    };

    ws.onclose = () => set({ connected: false });

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      switch (msg.t) {
        case 'joined':
          sessionStorage.setItem(REJOIN_TOKEN_KEY, msg.rejoinToken);
          sessionStorage.setItem(ROOM_ID_KEY, roomId);
          set({ roomId, playerId: msg.playerId, roomState: msg.roomState });
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
        case 'error':
          set({ errorMessage: msg.message });
          break;
      }
    };

    set({ ws, roomId, displayName });
  },

  send(message) {
    get().ws?.send(JSON.stringify(message));
  },

  act(action) {
    get().send({ t: 'action', action, clientSeq: nextClientSeq++ });
  },

  dismissError() {
    set({ errorMessage: null });
  },
}));
