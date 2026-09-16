import { useState } from 'react';
import { createRoom } from './api.js';
import { useStore } from './store.js';

export function Home() {
  const join = useStore((s) => s.join);
  const [displayName, setDisplayName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [busy, setBusy] = useState(false);

  const canJoin = displayName.trim().length > 0;

  async function handleCreate() {
    setBusy(true);
    const roomId = await createRoom();
    join(roomId, displayName.trim());
  }

  function handleJoin() {
    if (!roomCode.trim()) return;
    join(roomCode.trim().toUpperCase(), displayName.trim());
  }

  return (
    <div className="home">
      <h1>Command Table</h1>
      <label>
        Your name
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Alice" />
      </label>

      <div className="home-actions">
        <button disabled={!canJoin || busy} onClick={handleCreate}>
          Create room
        </button>

        <div className="home-join">
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="Room code"
            maxLength={6}
          />
          <button disabled={!canJoin || !roomCode.trim()} onClick={handleJoin}>
            Join room
          </button>
        </div>
      </div>
    </div>
  );
}
