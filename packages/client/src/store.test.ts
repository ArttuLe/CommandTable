import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./api.js', () => ({ WS_URL: 'ws://test/ws' }));

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    clear: () => map.clear(),
    key: (i) => [...map.keys()][i] ?? null,
    get length() { return map.size; },
  } as Storage;
}

const sockets: FakeSocket[] = [];

class FakeSocket {
  static OPEN = 1;
  readyState = 0;
  sent: any[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((e: { data: string }) => void) | null = null;
  constructor(public url: string) { sockets.push(this); }
  send(data: string) { this.sent.push(JSON.parse(data)); }
  close() { this.closed = true; this.onclose?.(); }
  open() { this.readyState = 1; this.onopen?.(); }
  deliver(msg: unknown) { this.onmessage?.({ data: JSON.stringify(msg) }); }
  get joinMessage() { return this.sent.find((m) => m.t === 'join'); }
}

let useStore: typeof import('./store.js').useStore;

beforeEach(async () => {
  sockets.length = 0;
  vi.resetModules();
  const g = globalThis as any;
  g.window = { localStorage: memoryStorage(), sessionStorage: memoryStorage() };
  g.WebSocket = FakeSocket;
  ({ useStore } = await import('./store.js'));
});

function seat(socket: FakeSocket, roomId: string, playerId: string, hostId: string, token = 'tok') {
  socket.open();
  socket.deliver({
    t: 'joined',
    playerId,
    rejoinToken: token,
    roomState: { roomId, hostId, started: false, seats: [] },
  });
}

describe('joining rooms', () => {
  it('joins a room with no prior session', () => {
    useStore.getState().join('AAA111', 'Alice', 'pass');

    expect(sockets).toHaveLength(1);
    sockets[0].open();
    expect(sockets[0].joinMessage).toMatchObject({ roomId: 'AAA111', displayName: 'Alice', secret: 'pass' });
    expect(sockets[0].joinMessage.rejoinToken).toBeUndefined();
  });

  it('does not offer a token from a different room when joining a new one', () => {
    useStore.getState().join('AAA111', 'Alice', 'pass');
    seat(sockets[0], 'AAA111', 'p1', 'p1', 'token-for-A');
    useStore.getState().leave();

    useStore.getState().join('BBB222', 'Alice', 'pass');
    sockets.at(-1)!.open();

    expect(sockets.at(-1)!.joinMessage.roomId).toBe('BBB222');
    expect(sockets.at(-1)!.joinMessage.rejoinToken).toBeUndefined();
  });

  // The reported symptom: a guest types a room code and lands somewhere else.
  it('joins the room the guest typed, not one from a stale session', () => {
    useStore.getState().join('AAA111', 'Alice', 'pass');
    seat(sockets[0], 'AAA111', 'p1', 'p1', 'token-for-A');

    // Guest does not leave first — they just join another room (e.g. from a second screen).
    useStore.getState().join('BBB222', 'Bob', 'pass');
    const latest = sockets.at(-1)!;
    latest.open();

    expect(latest.joinMessage.roomId).toBe('BBB222');
    expect(latest.joinMessage.rejoinToken).toBeUndefined();
  });

  it('closes the previous socket when joining a different room', () => {
    useStore.getState().join('AAA111', 'Alice', 'pass');
    seat(sockets[0], 'AAA111', 'p1', 'p1');

    useStore.getState().join('BBB222', 'Bob', 'pass');

    expect(sockets[0].closed).toBe(true);
  });

  // StrictMode runs mount effects twice in dev, so App's auto-resume fires twice.
  it('does not leave two live sockets when resume is called twice', () => {
    const session = { roomId: 'AAA111', displayName: 'Alice', secret: 'pass', rejoinToken: 'tok' };
    useStore.getState().resume(session);
    useStore.getState().resume(session);

    expect(sockets.filter((s) => !s.closed)).toHaveLength(1);
  });

  it('a stale socket that closes later does not reconnect into the old room', () => {
    useStore.getState().join('AAA111', 'Alice', 'pass');
    seat(sockets[0], 'AAA111', 'p1', 'p1');
    useStore.getState().join('BBB222', 'Bob', 'pass');
    const current = sockets.at(-1)!;
    seat(current, 'BBB222', 'p2', 'p9');

    sockets[0].onclose?.();

    expect(useStore.getState().roomId).toBe('BBB222');
    expect(sockets.filter((s) => !s.closed && s !== current)).toHaveLength(0);
  });

  // The reported symptom, precisely: App's auto-resume and the room the guest typed were both
  // in flight, and whichever 'joined' landed last decided where they ended up — which could be
  // a stale room from a previous session, empty, with them as its host.
  it('a late joined from a superseded socket cannot seat you in the old room', () => {
    useStore.getState().resume({ roomId: 'STALE1', displayName: 'Bob', secret: 'pass', rejoinToken: 'old' });
    const stale = sockets[0];

    useStore.getState().join('LIVE22', 'Bob', 'pass');
    const live = sockets.at(-1)!;
    seat(live, 'LIVE22', 'p2', 'host-player');

    // The stale connection finally answers, claiming Bob is the host of an empty room.
    stale.open();
    stale.deliver({ t: 'joined', playerId: 'p1', rejoinToken: 'old', roomState: { roomId: 'STALE1', hostId: 'p1', started: false, seats: [] } });

    expect(useStore.getState().roomId).toBe('LIVE22');
    expect(useStore.getState().roomState?.roomId).toBe('LIVE22');
    expect(useStore.getState().playerId).toBe('p2');
  });

  it('a superseded socket cannot report the live connection as disconnected', () => {
    useStore.getState().join('AAA111', 'Alice', 'pass');
    const first = sockets[0];
    useStore.getState().join('BBB222', 'Alice', 'pass');
    seat(sockets.at(-1)!, 'BBB222', 'p2', 'p2');

    first.onclose?.();

    expect(useStore.getState().status).toBe('live');
  });

  it('leaving stops an in-flight connection from seating you anyway', () => {
    useStore.getState().join('AAA111', 'Alice', 'pass');
    const pending = sockets[0];

    useStore.getState().leave();
    pending.open();
    pending.deliver({ t: 'joined', playerId: 'p1', rejoinToken: 'tok', roomState: { roomId: 'AAA111', hostId: 'p1', started: false, seats: [] } });

    expect(useStore.getState().roomState).toBeNull();
    expect(useStore.getState().roomId).toBeNull();
  });
});
