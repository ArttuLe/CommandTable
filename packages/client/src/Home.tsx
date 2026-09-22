import { useState } from 'react';
import { createRoom } from './api.js';
import { clearSession, loadSession } from './session.js';
import { storedSecret, useStore } from './store.js';

export function Home() {
  const join = useStore((s) => s.join);
  const resume = useStore((s) => s.resume);
  const showError = useStore((s) => s.showError);
  // A session saved by a different tab, or by this browser before it was closed. App auto-resumes
  // the same-tab case, so anything reaching here is an offer rather than a certainty — which is
  // also what keeps a second tab opened for local testing from taking the first tab's seat.
  const [resumable, setResumable] = useState(() => {
    const stored = loadSession();
    return stored?.sameTab === false ? stored.session : null;
  });
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
    } catch {
      showError('wrong passphrase');
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

      {resumable && (
        <div className="resume-prompt">
          <button className="btn btn-lg btn-primary" onClick={() => resume(resumable)}>
            Resume as {resumable.displayName} at {resumable.roomId}
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              clearSession();
              setResumable(null);
            }}
          >
            Not me
          </button>
        </div>
      )}
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

      <div className="home-actions">
        <button className="btn btn-lg btn-primary" disabled={!canJoin || busy} onClick={handleCreate}>
          {busy ? 'Creating…' : 'Create room'}
        </button>

        <span className="home-or">or</span>

        <div className="home-join">
          <input
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value)}
            placeholder="Room code"
            maxLength={6}
          />
          <button className="btn btn-lg" disabled={!canJoin || !roomCode.trim()} onClick={handleJoin}>
            Join room
          </button>
        </div>
      </div>
    </div>
  );
}
