import { useState } from 'react';
import { createRoom } from './api.js';
import { storedSecret, useStore } from './store.js';

export function Home() {
  const join = useStore((s) => s.join);
  const showError = useStore((s) => s.showError);
  const [displayName, setDisplayName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [secret, setSecret] = useState(storedSecret);
  const [busy, setBusy] = useState(false);

  const canJoin = displayName.trim().length > 0 && secret.length > 0;

  async function handleCreate() {
    setBusy(true);
    try {
      const roomId = await createRoom(secret);
      join(roomId, displayName.trim(), secret);
    } catch (e) {
      showError((e as Error).message);
      setBusy(false);
    }
  }

  function handleJoin() {
    if (!roomCode.trim()) return;
    join(roomCode.trim().toUpperCase(), displayName.trim(), secret);
  }

  return (
    <div className="home panel">
      <h1>Command Table</h1>

      <label>
        Your name
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alice" />
      </label>

      <label>
        Table passphrase
        <input
          type="password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          placeholder="from whoever is hosting"
        />
      </label>

      {/* Joining leads: one person makes the room and everyone else joins it. Create keeps the
          same size and loses only the accent — hosting is a normal thing to do, not a fallback. */}
      <div className="home-actions">
        <div className="home-join">
          <label>
            Room code
            <input value={roomCode} onChange={(e) => setRoomCode(e.target.value)} maxLength={6} />
          </label>
          <button className="btn btn-lg btn-primary" disabled={!canJoin || !roomCode.trim()} onClick={handleJoin}>
            Join room
          </button>
        </div>

        <span className="home-or">or</span>

        <button className="btn btn-lg" disabled={!canJoin || busy} onClick={handleCreate}>
          {busy ? 'Creating…' : 'Create room'}
        </button>
      </div>

      {!canJoin && <p className="popover-note">Enter your name and the passphrase to join or create a room.</p>}
    </div>
  );
}
